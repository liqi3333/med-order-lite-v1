import { generateOrder } from "../api/order-api.js";
import { searchDrugs } from "../api/drug-api.js";
import { renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { CandidateOrderTemplate } from "../types/order.js";
import { escapeHtml, optionHtml, qs, splitList, valueOf } from "../utils/html.js";
import { showToast } from "../utils/toast.js";

function getParam(name: string): string {
  return new URLSearchParams((window.location.hash.split("?")[1] || "")).get(name) || "";
}
function scenarioToLabel(value: string): string {
  return { outpatient: "门诊", inpatient_long_term: "住院长期", inpatient_stat: "住院临时", emergency: "急诊" }[value] || value;
}
function renderOrderResult(order: CandidateOrderTemplate): string {
  const simpleTemplate = order.simplifiedTemplateText || [
    `药品：${order.drugName}`,
    `剂量：请医生填写剂量`,
    `规格：${order.structured.medication_name}`,
    `频次：${order.structured.frequency}`,
    `途径：${order.structured.route}`,
    `用法用量：${order.structured.dosage}`
  ].join("\n");
  return `<div class="success-panel"><strong>候选医嘱模板（简化版）</strong><pre class="order-output">${escapeHtml(simpleTemplate)}</pre><div class="actions" style="margin-top:12px;"><button id="copy-simple-order" class="btn secondary">复制简化版</button></div></div>
  <div class="card" style="margin-top:14px;"><h3>候选医嘱模板（完整版）</h3><pre class="order-output">${escapeHtml(order.templateText)}</pre><div class="actions" style="margin-top:12px;"><button id="copy-order" class="btn secondary">复制完整版</button></div></div>
  <div class="grid two" style="margin-top:14px;"><div class="card"><h3>风险提示</h3><div class="list">${order.warnings.map((w) => `<div class="item"><span class="tag ${w.level === "block" ? "danger" : w.level === "warning" ? "warning" : "info"}">${escapeHtml(w.level)}</span><p>${escapeHtml(w.source ? `${w.source}：${w.message}` : w.message)}</p></div>`).join("") || "无结构化风险提示"}</div></div><div class="card"><h3>来源片段</h3><div class="list">${order.sourceSections.map((s) => `<div class="item"><strong>${escapeHtml(s.section)}</strong><p>${escapeHtml(s.text)}</p></div>`).join("") || "无来源片段"}</div></div></div>
  <div class="warning-panel" style="margin-top:14px;">${escapeHtml(order.disclaimer)}</div>`;
}

export async function renderOrderPage(): Promise<void> {
  if (state.drugs.length === 0) {
    try {
      const result = await searchDrugs({});
      state.drugs = result.items;
    } catch { /* ignore */ }
  }
  const selectedDrug = getParam("drug") || state.drugs[0]?.id || "";
  renderShell(`
    <section class="card"><h3>生成候选医嘱</h3><p class="muted">默认只填写药物、医嘱场景和诊断/用途；患者信息作为补充项折叠展示。</p><div class="form-grid">
      <div class="form-field"><label>药物 <span class="required">*</span></label><select id="order-drug" class="select">${optionHtml(state.drugs.map((d) => ({ value: d.id, label: d.generic_cn })), selectedDrug, "请选择药物")}</select></div>
      <div class="form-field"><label>医嘱场景</label><select id="scenario" class="select"><option value="outpatient">门诊</option><option value="inpatient_long_term">住院长期</option><option value="inpatient_stat">住院临时</option><option value="emergency">急诊</option></select></div>
      <div class="form-field"><label>诊断/用途说明</label><input id="diagnosis" class="input" placeholder="可选，例如：感染相关治疗" /></div>
    </div>
    <details class="advanced-panel" style="margin-top:14px;"><summary>补充患者情况</summary><div class="form-grid" style="margin-top:14px;">
      <div class="form-field"><label>年龄</label><input id="age" class="input" placeholder="可选" /></div>
      <div class="form-field"><label>体重</label><input id="weight" class="input" placeholder="可选" /></div>
      <div class="form-field"><label>过敏史</label><input id="allergies" class="input" placeholder="多个用逗号分隔" /></div>
      <div class="form-field"><label>肾功能</label><input id="renal" class="input" placeholder="未知 / 正常 / 异常" /></div>
      <div class="form-field"><label>肝功能</label><input id="hepatic" class="input" placeholder="未知 / 正常 / 异常" /></div>
      <div class="form-field"><label>妊娠</label><select id="pregnancy" class="select"><option value="false">否/未知</option><option value="true">是</option></select></div>
      <div class="form-field"><label>哺乳</label><select id="lactation" class="select"><option value="false">否/未知</option><option value="true">是</option></select></div>
    </div></details>
    <div class="actions" style="margin-top:14px;"><button id="generate-order" class="btn">生成候选医嘱</button><a class="btn secondary" href="#/drugs">返回药物查询</a></div></section>
    <section id="order-result" style="margin-top:16px;"></section>
  `, "候选医嘱", "从药物详情或本页选择药物，根据说明书字段生成候选医嘱模板。")
  const scenario = qs<HTMLSelectElement>("#scenario");
  if (scenario) scenario.value = "outpatient";
  qs("#generate-order")?.addEventListener("click", async () => {
    const drugId = valueOf("#order-drug");
    if (!drugId) return showToast("请选择药物", "warning");
    const target = qs("#order-result");
    if (target) target.innerHTML = `<div class="card flat">正在根据药物说明书生成候选医嘱...</div>`;
    try {
      const order = await generateOrder({
        drugId,
        diagnosis: valueOf("#diagnosis") || undefined,
        scenario: valueOf("#scenario") || "outpatient",
        patientContext: {
          age: valueOf("#age"),
          weight: valueOf("#weight"),
          allergies: splitList(valueOf("#allergies")),
          renalFunction: valueOf("#renal"),
          hepaticFunction: valueOf("#hepatic"),
          pregnancy: valueOf("#pregnancy") === "true",
          lactation: valueOf("#lactation") === "true"
        }
      });
      if (target) target.innerHTML = renderOrderResult(order);
      qs("#copy-simple-order")?.addEventListener("click", async () => {
        await navigator.clipboard?.writeText(order.simplifiedTemplateText || "");
        showToast(`${scenarioToLabel(order.scenario)}简化版医嘱已复制`, "success");
      });
      qs("#copy-order")?.addEventListener("click", async () => {
        await navigator.clipboard?.writeText(order.templateText);
        showToast(`${scenarioToLabel(order.scenario)}完整版医嘱已复制`, "success");
      });
      showToast("候选医嘱已生成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
      showToast(message, "danger");
    }
  });
}
