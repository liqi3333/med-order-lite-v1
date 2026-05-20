import { generateOrder } from "../api/order-api.js";
import { renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { escapeHtml, optionHtml, qs, splitList, valueOf } from "../utils/html.js";
import { showToast } from "../utils/toast.js";
function getParam(name) {
    return new URLSearchParams((window.location.hash.split("?")[1] || "")).get(name) || "";
}
function scenarioToLabel(value) {
    return { outpatient: "门诊", inpatient_long_term: "住院长期", inpatient_stat: "住院临时", emergency: "急诊" }[value] || value;
}
function renderOrderResult(order) {
    return `<div class="success-panel"><strong>候选医嘱模板</strong><pre class="order-output">${escapeHtml(order.templateText)}</pre><div class="actions" style="margin-top:12px;"><button id="copy-order" class="btn secondary">复制医嘱文本</button></div></div>
  <div class="grid two" style="margin-top:14px;"><div class="card"><h3>风险提示</h3><div class="list">${order.warnings.map((w) => `<div class="item"><span class="tag ${w.level === "block" ? "danger" : w.level === "warning" ? "warning" : "info"}">${escapeHtml(w.level)}</span><p>${escapeHtml(w.source ? `${w.source}：${w.message}` : w.message)}</p></div>`).join("") || "无结构化风险提示"}</div></div><div class="card"><h3>来源片段</h3><div class="list">${order.sourceSections.map((s) => `<div class="item"><strong>${escapeHtml(s.section)}</strong><p>${escapeHtml(s.text)}</p></div>`).join("") || "无来源片段"}</div></div></div>
  <div class="warning-panel" style="margin-top:14px;">${escapeHtml(order.disclaimer)}</div>`;
}
export function renderOrderPage() {
    const selectedDrug = getParam("drug") || state.drugs[0]?.id || "";
    renderShell(`
    <section class="card"><h3>生成候选医嘱</h3><p class="muted">轻量版只根据所选药物的说明书字段生成候选医嘱模板，不再依赖疾病库或审核中心。</p><div class="form-grid">
      <div class="form-field"><label>药物 <span class="required">*</span></label><select id="order-drug" class="select">${optionHtml(state.drugs.map((d) => ({ value: d.id, label: d.generic_cn })), selectedDrug, "请选择药物")}</select></div>
      <div class="form-field"><label>医嘱场景</label><select id="scenario" class="select"><option value="outpatient">门诊</option><option value="inpatient_long_term">住院长期</option><option value="inpatient_stat">住院临时</option><option value="emergency">急诊</option></select></div>
      <div class="form-field"><label>诊断/用途说明</label><input id="diagnosis" class="input" placeholder="可选，例如：感染相关治疗" /></div>
      <div class="form-field"><label>年龄</label><input id="age" class="input" placeholder="可选" /></div>
      <div class="form-field"><label>体重</label><input id="weight" class="input" placeholder="可选" /></div>
      <div class="form-field"><label>过敏史</label><input id="allergies" class="input" placeholder="多个用逗号分隔" /></div>
      <div class="form-field"><label>肾功能</label><input id="renal" class="input" placeholder="未知 / 正常 / 异常" /></div>
      <div class="form-field"><label>肝功能</label><input id="hepatic" class="input" placeholder="未知 / 正常 / 异常" /></div>
      <div class="form-field"><label>妊娠</label><select id="pregnancy" class="select"><option value="false">否/未知</option><option value="true">是</option></select></div>
      <div class="form-field"><label>哺乳</label><select id="lactation" class="select"><option value="false">否/未知</option><option value="true">是</option></select></div>
    </div><div class="actions" style="margin-top:14px;"><button id="generate-order" class="btn">生成候选医嘱</button><a class="btn secondary" href="#/drugs">返回药物库</a></div></section>
    <section id="order-result" style="margin-top:16px;"></section>
  `, "医嘱生成", "选择药物后，根据说明书生成候选医嘱模板。");
    const scenario = qs("#scenario");
    if (scenario)
        scenario.value = "outpatient";
    qs("#generate-order")?.addEventListener("click", async () => {
        const drugId = valueOf("#order-drug");
        if (!drugId)
            return showToast("请选择药物", "warning");
        const target = qs("#order-result");
        if (target)
            target.innerHTML = `<div class="card flat">正在根据药物说明书生成候选医嘱...</div>`;
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
            if (target)
                target.innerHTML = renderOrderResult(order);
            qs("#copy-order")?.addEventListener("click", async () => {
                await navigator.clipboard?.writeText(order.templateText);
                showToast(`${scenarioToLabel(order.scenario)}候选医嘱已复制`, "success");
            });
            showToast("候选医嘱已生成", "success");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (target)
                target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
            showToast(message, "danger");
        }
    });
}
