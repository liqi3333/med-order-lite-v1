import { importLabelText, importMarkdown, listPlugins, DrugImportResult, ValidationIssue } from "../api/import-api.js";
import { renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { escapeHtml, optionHtml, qs, splitList, valueOf } from "../utils/html.js";
import { showToast } from "../utils/toast.js";

const SAMPLE_LABEL_TEXT = `【药品名称】\n示例药物\n\n【成份】\n本品主要成份为示例成份。\n\n【性状】\n本品为白色或类白色片。\n\n【适应症】\n用于示例适应症相关场景。实际使用必须以正式说明书和医生判断为准。\n\n【用法用量】\n请根据正式说明书、患者情况和医生判断填写具体用法用量。本示例不可用于真实临床。\n\n【禁忌】\n对本品任何成份过敏者禁用。\n\n【注意事项】\n肝肾功能异常、妊娠、哺乳、儿童和老年患者使用前需由医生评估。\n\n【不良反应】\n可能出现示例不良反应，具体以正式说明书为准。\n\n【药物相互作用】\n与其他药物合用时需评估相互作用。\n\n【孕妇及哺乳期妇女用药】\n妊娠及哺乳期用药需权衡获益和风险。\n\n【儿童用药】\n儿童用药需遵医嘱。\n\n【老年用药】\n老年患者需注意肝肾功能和合并用药。\n\n【贮藏】\n密封保存。\n\n【有效期】\n24个月。\n\n【批准文号】\n示例批准文号。\n\n【说明书修订日期】\n2026-05-18。`;

function taxonomies() {
  return state.taxonomies || { drugCategories: { systems: [], categories: [] }, dosageForms: [], routes: [], prescriptionTypes: [], riskTags: [], frequencies: [] };
}
function categoriesForSystem(system: string) {
  return taxonomies().drugCategories.categories.filter((cat) => !system || cat.system === system).map((cat) => ({ value: cat.value, label: cat.label }));
}
function childrenForCategory(primary: string) {
  return taxonomies().drugCategories.categories.find((cat) => cat.value === primary)?.children || [];
}
function firstValue<T extends { value: string }>(items: T[], fallback = ""): string { return items[0]?.value || fallback; }
function selectedCheckboxValues(name: string): string[] { return Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map((item) => item.value); }
function updatePrimaryOptions(): void {
  const system = valueOf("#system");
  const primary = qs<HTMLSelectElement>("#primary");
  if (!primary) return;
  const options = categoriesForSystem(system);
  const current = primary.value;
  const nextValue = options.some((item) => item.value === current) ? current : firstValue(options);
  primary.innerHTML = optionHtml(options, nextValue, "请选择一级分类");
  primary.value = nextValue;
  updateSecondaryOptions();
}
function updateSecondaryOptions(): void {
  const primaryValue = valueOf("#primary");
  const secondary = qs<HTMLSelectElement>("#secondary");
  if (!secondary) return;
  const options = childrenForCategory(primaryValue);
  const current = secondary.value;
  const nextValue = options.some((item) => item.value === current) ? current : firstValue(options);
  secondary.innerHTML = optionHtml(options, nextValue, "请选择二级分类");
  secondary.value = nextValue;
}
function sectionLabel(key: string): string {
  const labels: Record<string, string> = { composition: "成分", character: "性状", indications: "适应症/功能主治", dosage: "用法用量", contraindications: "禁忌", precautions: "注意事项", adverse_reactions: "不良反应", interactions: "药物相互作用", pharmacology_toxicology: "药理毒理", pharmacokinetics: "药代动力学", storage: "贮藏", packaging: "包装", validity: "有效期", standard: "执行标准", approval_number: "批准文号", revision_date: "说明书修订日期", pregnancy: "妊娠", lactation: "哺乳", pediatric: "儿童", geriatric: "老年", renal_impairment: "肾功能不全", hepatic_impairment: "肝功能不全", driving_or_machines: "驾驶与机械操作" };
  return labels[key] || key;
}
function renderIssues(title: string, issues: ValidationIssue[], tone: "danger" | "warning"): string {
  if (issues.length === 0) return "";
  return `<div class="${tone === "danger" ? "warning-panel" : "note-panel"}"><strong>${escapeHtml(title)}</strong><ul>${issues.map((item) => `<li>${escapeHtml(item.field ? `${item.field}：${item.message}` : item.message)}</li>`).join("")}</ul></div>`;
}
function renderExtractedSections(result: DrugImportResult): string {
  const label = result.document?.label || {};
  const rows: string[] = [];
  for (const [key, value] of Object.entries(label)) {
    if (key === "special_populations") continue;
    if (typeof value === "string" && value.trim()) rows.push(`<tr><th>${escapeHtml(sectionLabel(key))}</th><td>${escapeHtml(value.slice(0, 500))}${value.length > 500 ? "..." : ""}</td></tr>`);
  }
  const special = (label.special_populations || {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(special)) {
    if (typeof value === "string" && value.trim()) rows.push(`<tr><th>特殊人群：${escapeHtml(sectionLabel(key))}</th><td>${escapeHtml(value.slice(0, 500))}${value.length > 500 ? "..." : ""}</td></tr>`);
  }
  if (rows.length === 0) return `<div class="warning-panel">未识别到结构化章节。请确认文本中包含【适应症】【用法用量】【禁忌】【注意事项】等标题。</div>`;
  return `<div class="table-wrap"><table class="data-table"><tbody>${rows.join("")}</tbody></table></div>`;
}
function renderImportResult(result: DrugImportResult): string {
  const validation = result.validation;
  const statusText = result.savedPath ? `已保存到药物库：${result.savedPath}` : "仅预览，未写入文件";
  const drugLink = result.status === "published" ? `<a class="btn secondary" href="#/drugs/${encodeURIComponent(result.drugId)}">查看药物</a><a class="btn" href="#/orders?drug=${encodeURIComponent(result.drugId)}">生成医嘱</a>` : "";
  return `
    <div class="success-panel"><strong>处理完成</strong><p>药物 ID：<code>${escapeHtml(result.drugId)}</code>；状态：<code>${escapeHtml(result.status)}</code>；${escapeHtml(statusText)}</p></div>
    ${renderIssues("校验错误", validation.errors || [], "danger")}
    ${renderIssues("校验提醒", validation.warnings || [], "warning")}
    <section class="card flat"><h3>插件备注</h3><ul>${(result.notes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>无</li>"}</ul></section>
    <section class="card flat"><h3>结构化字段预览</h3>${renderExtractedSections(result)}</section>
    <section class="card flat"><h3>生成的 drug.md</h3><textarea id="markdown-preview" class="textarea monospace" rows="18" readonly>${escapeHtml(result.markdown || "")}</textarea><div class="actions" style="margin-top:12px;"><button id="copy-md" class="btn secondary">复制 Markdown</button>${drugLink}<a class="btn ghost" href="#/drugs">打开药物库</a></div></section>
  `;
}
function buildImportBody(saveMode: "preview" | "publish"): Record<string, unknown> {
  const brandAndAliases = splitList(valueOf("#aliases"));
  return {
    saveMode,
    actor: valueOf("#actor") || "web-user",
    basic: { generic_cn: valueOf("#generic-cn"), generic_en: valueOf("#generic-en") || undefined, brand_names: brandAndAliases, aliases: brandAndAliases, system: valueOf("#system"), primary_category: valueOf("#primary"), secondary_category: valueOf("#secondary"), pharmacologic_class: valueOf("#pharm-class") || undefined, prescription_type: valueOf("#prescription") || undefined },
    forms: [{ dosage_form: valueOf("#dosage-form"), strength: valueOf("#strength") || undefined, route: valueOf("#route"), package_unit: valueOf("#package-unit") || undefined, manufacturer: valueOf("#manufacturer") || undefined, approval_number: valueOf("#approval-number") || undefined }],
    risk_tags: selectedCheckboxValues("risk"),
    source: { title: valueOf("#source-title") || `${valueOf("#generic-cn")} 说明书`, url: valueOf("#source-url") || undefined, revision_date: valueOf("#revision-date") || undefined, source_type: "manual_entry" },
    label_text: valueOf("#label-text")
  };
}
function validateForm(): string[] {
  const errors: string[] = [];
  if (!valueOf("#generic-cn").trim()) errors.push("请填写中文通用名。");
  if (!valueOf("#system")) errors.push("请选择药物体系。");
  if (!valueOf("#primary")) errors.push("请选择一级分类。");
  if (!valueOf("#dosage-form")) errors.push("请选择剂型。");
  if (!valueOf("#route")) errors.push("请选择给药途径。");
  if (!valueOf("#label-text").trim()) errors.push("请粘贴说明书文本。");
  return errors;
}
async function runLabelImport(saveMode: "preview" | "publish"): Promise<void> {
  const resultPanel = qs("#import-result");
  const submitButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-import-mode]"));
  const errors = validateForm();
  if (errors.length > 0) {
    if (resultPanel) resultPanel.innerHTML = `<div class="warning-panel"><strong>无法导入</strong><ul>${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
    showToast(errors[0], "danger");
    return;
  }
  try {
    submitButtons.forEach((button) => { button.disabled = true; });
    if (resultPanel) resultPanel.innerHTML = `<div class="card flat">正在调用 <code>label-text</code> 插件解析说明书...</div>`;
    const result = await importLabelText(buildImportBody(saveMode));
    if (resultPanel) resultPanel.innerHTML = renderImportResult(result);
    wireMarkdownCopy();
    showToast(saveMode === "preview" ? "预览完成" : "已保存到药物库", result.validation.ok ? "success" : "warning");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (resultPanel) resultPanel.innerHTML = `<div class="warning-panel"><strong>导入失败</strong><p>${escapeHtml(message)}</p></div>`;
    showToast(message, "danger");
  } finally { submitButtons.forEach((button) => { button.disabled = false; }); }
}
async function runMarkdownImport(): Promise<void> {
  const markdown = valueOf("#md-import");
  const resultPanel = qs("#md-import-result");
  if (!markdown.trim()) return showToast("请粘贴 drug.md 内容", "warning");
  try {
    if (resultPanel) resultPanel.innerHTML = `<div class="card flat">正在校验并保存 drug.md...</div>`;
    const result = await importMarkdown(markdown);
    if (resultPanel) resultPanel.innerHTML = renderImportResult(result);
    wireMarkdownCopy();
    showToast("Markdown 药物文件已导入", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (resultPanel) resultPanel.innerHTML = `<div class="warning-panel"><strong>导入失败</strong><p>${escapeHtml(message)}</p></div>`;
    showToast(message, "danger");
  }
}
function wireMarkdownCopy(): void {
  qs("#copy-md")?.addEventListener("click", async () => {
    const text = qs<HTMLTextAreaElement>("#markdown-preview")?.value || "";
    await navigator.clipboard?.writeText(text);
    showToast("已复制 Markdown", "success");
  });
}
function wireImportPage(): void {
  qs("#system")?.addEventListener("change", updatePrimaryOptions);
  qs("#primary")?.addEventListener("change", updateSecondaryOptions);
  document.querySelectorAll<HTMLButtonElement>("[data-import-mode]").forEach((button) => button.addEventListener("click", () => void runLabelImport(button.dataset.importMode as "preview" | "publish")));
  qs("#import-md")?.addEventListener("click", () => void runMarkdownImport());
  qs("#fill-sample")?.addEventListener("click", () => {
    const name = qs<HTMLInputElement>("#generic-cn"); const strength = qs<HTMLInputElement>("#strength"); const label = qs<HTMLTextAreaElement>("#label-text"); const sourceTitle = qs<HTMLInputElement>("#source-title");
    if (name && !name.value) name.value = "示例导入药物";
    if (strength && !strength.value) strength.value = "示例规格";
    if (sourceTitle && !sourceTitle.value) sourceTitle.value = "示例导入药物说明书";
    if (label) label.value = SAMPLE_LABEL_TEXT;
    showToast("已填入示例说明书文本", "info");
  });
  qs("#clear-form")?.addEventListener("click", () => { document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((el) => { if (el.type === "checkbox") (el as HTMLInputElement).checked = false; else el.value = ""; }); const resultPanel = qs("#import-result"); if (resultPanel) resultPanel.innerHTML = ""; });
}

export async function renderImportPage(): Promise<void> {
  const plugins = await listPlugins().catch(() => ({ plugins: [] }));
  const tx = taxonomies();
  const defaultSystem = firstValue(tx.drugCategories.systems, "western_medicine");
  const defaultPrimary = firstValue(categoriesForSystem(defaultSystem), "");
  const defaultSecondary = firstValue(childrenForCategory(defaultPrimary), "");
  renderShell(`
    <section class="grid two">
      <div class="card"><h3>可用药物导入插件</h3><div class="list">${plugins.plugins.map((p) => `<div class="item"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.description)}</p><span class="tag">${escapeHtml(p.id)}</span></div>`).join("") || "暂无插件"}</div></div>
      <div class="card"><h3>导入流程</h3><p>轻量版已移除审核中心。导入后可以先预览，也可以直接保存到正式药物库并自动重建索引。</p><div class="tag-row"><span class="tag">说明书文本</span><span class="tag">插件解析</span><span class="tag">drug.md</span><span class="tag">药物库</span></div></div>
    </section>
    <section class="card" style="margin-top:16px;"><h3>方式一：说明书文本导入</h3><p class="muted">支持 <code>【适应症】内容</code>、<code>适应症：内容</code>、<code>一、适应症</code>、<code>## 适应症</code> 等格式。</p>
      <div class="form-grid">
        <div class="form-field"><label>中文通用名 <span class="required">*</span></label><input id="generic-cn" class="input" placeholder="例如：某某药物" /></div>
        <div class="form-field"><label>英文名</label><input id="generic-en" class="input" placeholder="可选" /></div>
        <div class="form-field"><label>商品名/别名</label><input id="aliases" class="input" placeholder="多个用逗号分隔" /></div>
        <div class="form-field"><label>录入人</label><input id="actor" class="input" placeholder="web-user" /></div>
        <div class="form-field"><label>药物体系 <span class="required">*</span></label><select id="system" class="select">${optionHtml(tx.drugCategories.systems, defaultSystem, "请选择药物体系")}</select></div>
        <div class="form-field"><label>一级分类 <span class="required">*</span></label><select id="primary" class="select">${optionHtml(categoriesForSystem(defaultSystem), defaultPrimary, "请选择一级分类")}</select></div>
        <div class="form-field"><label>二级分类</label><select id="secondary" class="select">${optionHtml(childrenForCategory(defaultPrimary), defaultSecondary, "请选择二级分类")}</select></div>
        <div class="form-field"><label>药理分类</label><input id="pharm-class" class="input" placeholder="如：β-内酰胺类抗菌药" /></div>
        <div class="form-field"><label>处方属性</label><select id="prescription" class="select">${optionHtml(tx.prescriptionTypes, firstValue(tx.prescriptionTypes), "请选择处方属性")}</select></div>
        <div class="form-field"><label>剂型 <span class="required">*</span></label><select id="dosage-form" class="select">${optionHtml(tx.dosageForms, firstValue(tx.dosageForms), "请选择剂型")}</select></div>
        <div class="form-field"><label>规格</label><input id="strength" class="input" placeholder="例如：0.25g" /></div>
        <div class="form-field"><label>给药途径 <span class="required">*</span></label><select id="route" class="select">${optionHtml(tx.routes, firstValue(tx.routes), "请选择给药途径")}</select></div>
        <div class="form-field"><label>包装单位</label><input id="package-unit" class="input" placeholder="例如：盒、瓶、支" /></div>
        <div class="form-field"><label>生产厂家</label><input id="manufacturer" class="input" /></div>
        <div class="form-field"><label>批准文号</label><input id="approval-number" class="input" /></div>
        <div class="form-field"><label>说明书来源标题</label><input id="source-title" class="input" placeholder="例如：某某药物说明书" /></div>
        <div class="form-field"><label>来源 URL</label><input id="source-url" class="input" placeholder="可选" /></div>
        <div class="form-field"><label>说明书修订日期</label><input id="revision-date" class="input" placeholder="例如：2026-05-18" /></div>
      </div>
      <div class="form-field" style="margin-top:12px;"><label>风险标签</label><div class="checkbox-grid">${tx.riskTags.map((x) => `<label><input type="checkbox" name="risk" value="${escapeHtml(x.value)}" /> ${escapeHtml(x.label)}</label>`).join("") || "暂无风险标签"}</div></div>
      <div class="form-field" style="margin-top:12px;"><label>说明书文本 <span class="required">*</span></label><textarea id="label-text" class="textarea" rows="16" placeholder="粘贴完整说明书文本。建议包含【适应症】【用法用量】【禁忌】【注意事项】【不良反应】【药物相互作用】等标题。"></textarea></div>
      <div class="actions" style="margin-top:14px;"><button id="fill-sample" class="btn secondary">填入示例</button><button id="clear-form" class="btn ghost">清空</button><button data-import-mode="preview" class="btn secondary">预览抽取结果</button><button data-import-mode="publish" class="btn">保存到药物库</button></div>
      <div id="import-result" style="margin-top:16px;"></div>
    </section>
    <section class="card" style="margin-top:16px;"><h3>方式二：导入标准 drug.md</h3><p class="muted">适合从其他系统或手工维护的标准 Markdown 药物文件导入。保存后直接进入药物库。</p><textarea id="md-import" class="textarea monospace" rows="14" placeholder="粘贴完整 drug.md 内容，包括 YAML frontmatter 和药物说明正文。"></textarea><div class="actions" style="margin-top:12px;"><button id="import-md" class="btn">导入 drug.md</button></div><div id="md-import-result" style="margin-top:16px;"></div></section>
  `, "导入药物", "通过插件或标准 drug.md 文件导入药物信息。")
  wireImportPage();
}
