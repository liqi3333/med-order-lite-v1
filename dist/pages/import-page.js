import { importCsvDrugs, importLabelText, importMarkdown, importOcrLabel, importPdfLabel, listPlugins } from "../api/import-api.js";
import { rebuildIndexes } from "../api/system-api.js";
import { renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { escapeHtml, optionHtml, qs, splitList, valueOf } from "../utils/html.js";
import { showToast } from "../utils/toast.js";
const SAMPLE_LABEL_TEXT = `【药品名称】\n示例药物\n\n【成份】\n本品主要成份为示例成份。\n\n【性状】\n本品为白色或类白色片。\n\n【适应症】\n用于示例适应症相关场景。实际使用必须以正式说明书和医生判断为准。\n\n【用法用量】\n请根据正式说明书、患者情况和医生判断填写具体用法用量。本示例不可用于真实临床。\n\n【禁忌】\n对本品任何成份过敏者禁用。\n\n【注意事项】\n肝肾功能异常、妊娠、哺乳、儿童和老年患者使用前需由医生评估。\n\n【不良反应】\n可能出现示例不良反应，具体以正式说明书为准。\n\n【药物相互作用】\n与其他药物合用时需评估相互作用。\n\n【孕妇及哺乳期妇女用药】\n妊娠及哺乳期用药需权衡获益和风险。\n\n【儿童用药】\n儿童用药需遵医嘱。\n\n【老年用药】\n老年患者需注意肝肾功能和合并用药。\n\n【贮藏】\n密封保存。\n\n【有效期】\n24个月。\n\n【批准文号】\n示例批准文号。\n\n【说明书修订日期】\n2026-05-18。`;
const SAMPLE_CSV = `中文通用名,英文名,药物体系,一级分类,二级分类,剂型,规格,给药途径,风险标签,适应症,用法用量,禁忌,注意事项\n示例批量药物A,Example Drug A,western_medicine,anti_infective,other_antibacterials,tablet,0.25g,oral,allergy_check_required,请按本地说明书补充适应症,请按本地说明书补充用法用量,请按本地说明书补充禁忌,请按本地说明书补充注意事项\n示例批量药物B,Example Drug B,western_medicine,cardiovascular,other_cardiovascular_drugs,tablet,5mg,oral,renal_adjustment_required,请按本地说明书补充适应症,请按本地说明书补充用法用量,请按本地说明书补充禁忌,请按本地说明书补充注意事项`;
function taxonomies() {
    return state.taxonomies || { drugCategories: { systems: [], categories: [] }, dosageForms: [], routes: [], prescriptionTypes: [], riskTags: [], frequencies: [] };
}
function categoriesForSystem(system) {
    return taxonomies().drugCategories.categories.filter((cat) => !system || cat.system === system).map((cat) => ({ value: cat.value, label: cat.label }));
}
function childrenForCategory(primary) {
    return taxonomies().drugCategories.categories.find((cat) => cat.value === primary)?.children || [];
}
function firstValue(items, fallback = "") { return items[0]?.value || fallback; }
function selectedCheckboxValues(name) { return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((item) => item.value); }
function updatePrimaryOptions() {
    const system = valueOf("#system");
    const primary = qs("#primary");
    if (!primary)
        return;
    const options = categoriesForSystem(system);
    const current = primary.value;
    const nextValue = options.some((item) => item.value === current) ? current : firstValue(options);
    primary.innerHTML = optionHtml(options, nextValue, "请选择一级分类");
    primary.value = nextValue;
    updateSecondaryOptions();
}
function updateSecondaryOptions() {
    const primaryValue = valueOf("#primary");
    const secondary = qs("#secondary");
    if (!secondary)
        return;
    const options = childrenForCategory(primaryValue);
    const current = secondary.value;
    const nextValue = options.some((item) => item.value === current) ? current : firstValue(options);
    secondary.innerHTML = optionHtml(options, nextValue, "请选择二级分类");
    secondary.value = nextValue;
}
function sectionLabel(key) {
    const labels = { composition: "成分", character: "性状", indications: "适应症/功能主治", dosage: "用法用量", contraindications: "禁忌", precautions: "注意事项", adverse_reactions: "不良反应", interactions: "药物相互作用", pharmacology_toxicology: "药理毒理", pharmacokinetics: "药代动力学", storage: "贮藏", packaging: "包装", validity: "有效期", standard: "执行标准", approval_number: "批准文号", revision_date: "说明书修订日期", pregnancy: "妊娠", lactation: "哺乳", pediatric: "儿童", geriatric: "老年", renal_impairment: "肾功能不全", hepatic_impairment: "肝功能不全", driving_or_machines: "驾驶与机械操作" };
    return labels[key] || key;
}
function renderIssues(title, issues, tone) {
    if (issues.length === 0)
        return "";
    return `<div class="${tone === "danger" ? "warning-panel" : "note-panel"}"><strong>${escapeHtml(title)}</strong><ul>${issues.map((item) => `<li>${escapeHtml(item.field ? `${item.field}：${item.message}` : item.message)}</li>`).join("")}</ul></div>`;
}
function renderExtractedSections(result) {
    const label = result.document?.label || {};
    const rows = [];
    for (const [key, value] of Object.entries(label)) {
        if (key === "special_populations")
            continue;
        if (typeof value === "string" && value.trim())
            rows.push(`<tr><th>${escapeHtml(sectionLabel(key))}</th><td>${escapeHtml(value.slice(0, 500))}${value.length > 500 ? "..." : ""}</td></tr>`);
    }
    const special = (label.special_populations || {});
    for (const [key, value] of Object.entries(special)) {
        if (typeof value === "string" && value.trim())
            rows.push(`<tr><th>特殊人群：${escapeHtml(sectionLabel(key))}</th><td>${escapeHtml(value.slice(0, 500))}${value.length > 500 ? "..." : ""}</td></tr>`);
    }
    if (rows.length === 0)
        return `<div class="warning-panel">未识别到结构化章节。请确认文本中包含【适应症】【用法用量】【禁忌】【注意事项】等标题。</div>`;
    return `<div class="table-wrap"><table class="data-table"><tbody>${rows.join("")}</tbody></table></div>`;
}
function renderImportResult(result) {
    const validation = result.validation;
    const statusText = result.savedPath ? `已保存到药物库：${result.savedPath}` : "仅预览，未写入文件";
    const indexText = result.status === "published" ? (result.indexRebuilt ? `索引已自动重建，当前索引药物数：${result.indexCount ?? "未知"}` : `索引未自动重建成功${result.indexWarning ? `：${result.indexWarning}` : ""}`) : "预览模式不重建索引";
    const indexTone = result.status === "published" && !result.indexRebuilt ? "warning-panel" : "success-panel";
    const drugLink = result.status === "published" ? `<a class="btn secondary" href="#/drugs/${encodeURIComponent(result.drugId)}">查看药物</a><a class="btn" href="#/orders?drug=${encodeURIComponent(result.drugId)}">生成医嘱</a><button id="rebuild-index-after-import" class="btn ghost">手动重建索引</button>` : "";
    return `
    <div class="success-panel"><strong>处理完成</strong><p>药物 ID：<code>${escapeHtml(result.drugId)}</code>；状态：<code>${escapeHtml(result.status)}</code>；${escapeHtml(statusText)}</p></div>
    <div class="${indexTone}"><strong>索引状态</strong><p>${escapeHtml(indexText)}</p></div>
    ${renderIssues("校验错误", validation.errors || [], "danger")}
    ${renderIssues("校验提醒", validation.warnings || [], "warning")}
    <section class="card flat"><h3>插件备注</h3><ul>${(result.notes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>无</li>"}</ul></section>
    <section class="card flat"><h3>结构化字段预览</h3>${renderExtractedSections(result)}</section>
    <section class="card flat"><h3>生成的 drug.md</h3><textarea id="markdown-preview" class="textarea monospace" rows="18" readonly>${escapeHtml(result.markdown || "")}</textarea><div class="actions" style="margin-top:12px;"><button id="copy-md" class="btn secondary">复制 Markdown</button>${drugLink}<a class="btn ghost" href="#/drugs">打开药物库</a></div></section>
  `;
}
function renderBatchResult(result) {
    const rows = result.results.map((item) => `<tr><td><code>${escapeHtml(item.drugId)}</code></td><td>${escapeHtml(item.status)}</td><td>${item.savedPath ? "已保存" : "预览/未保存"}</td><td>${item.validation.ok ? "通过" : "未通过"}</td></tr>`).join("");
    const errors = result.errors.length ? `<div class="warning-panel"><strong>批量导入错误</strong><ul>${result.errors.map((x) => `<li>${escapeHtml(`${x.row ? `第 ${x.row} 行：` : ""}${x.drugId ? `${x.drugId}：` : ""}${x.message}`)}</li>`).join("")}</ul></div>` : "";
    return `<div class="${result.failed ? "note-panel" : "success-panel"}"><strong>批量处理完成</strong><p>总数：${result.total}；成功：${result.succeeded}；失败：${result.failed}；${result.indexRebuilt ? `索引已重建，当前药物数：${result.indexCount ?? "未知"}` : result.indexWarning ? `索引重建失败：${escapeHtml(result.indexWarning)}` : "预览模式未重建索引"}</p></div>${errors}<div class="table-wrap"><table class="data-table"><thead><tr><th>药物 ID</th><th>状态</th><th>保存</th><th>校验</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function buildImportBody(saveMode, labelText, sourceType = "manual_entry", extra = {}) {
    const brandAndAliases = splitList(valueOf("#aliases"));
    return {
        saveMode,
        actor: valueOf("#actor") || "web-user",
        basic: { generic_cn: valueOf("#generic-cn"), generic_en: valueOf("#generic-en") || undefined, brand_names: brandAndAliases, aliases: brandAndAliases, system: valueOf("#system"), primary_category: valueOf("#primary"), secondary_category: valueOf("#secondary"), pharmacologic_class: valueOf("#pharm-class") || undefined, prescription_type: valueOf("#prescription") || undefined },
        forms: [{ dosage_form: valueOf("#dosage-form"), strength: valueOf("#strength") || undefined, route: valueOf("#route"), package_unit: valueOf("#package-unit") || undefined, manufacturer: valueOf("#manufacturer") || undefined, approval_number: valueOf("#approval-number") || undefined }],
        risk_tags: selectedCheckboxValues("risk"),
        source: { title: valueOf("#source-title") || `${valueOf("#generic-cn")} 说明书`, url: valueOf("#source-url") || undefined, revision_date: valueOf("#revision-date") || undefined, source_type: sourceType },
        label_text: labelText ?? valueOf("#label-text"),
        ...extra
    };
}
function validateCommonBasic() {
    const errors = [];
    if (!valueOf("#generic-cn").trim())
        errors.push("请填写中文通用名。");
    if (!valueOf("#system"))
        errors.push("请选择药物体系。");
    if (!valueOf("#primary"))
        errors.push("请选择一级分类。");
    if (!valueOf("#dosage-form"))
        errors.push("请选择剂型。");
    if (!valueOf("#route"))
        errors.push("请选择给药途径。");
    return errors;
}
function validateLabelForm() {
    const errors = validateCommonBasic();
    if (!valueOf("#label-text").trim())
        errors.push("请粘贴说明书文本。");
    return errors;
}
function showValidationErrors(panel, errors) {
    if (panel)
        panel.innerHTML = `<div class="warning-panel"><strong>无法导入</strong><ul>${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
    showToast(errors[0], "danger");
}
async function runLabelImport(saveMode) {
    const resultPanel = qs("#import-result");
    const submitButtons = Array.from(document.querySelectorAll("[data-import-mode]"));
    const errors = validateLabelForm();
    if (errors.length > 0)
        return showValidationErrors(resultPanel, errors);
    try {
        submitButtons.forEach((button) => { button.disabled = true; });
        if (resultPanel)
            resultPanel.innerHTML = `<div class="card flat">正在调用 <code>label-text</code> 插件解析说明书...</div>`;
        const result = await importLabelText(buildImportBody(saveMode));
        if (resultPanel)
            resultPanel.innerHTML = renderImportResult(result);
        wireMarkdownCopy();
        showToast(saveMode === "preview" ? "预览完成" : "已保存到药物库", result.validation.ok ? "success" : "warning");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (resultPanel)
            resultPanel.innerHTML = `<div class="warning-panel"><strong>导入失败</strong><p>${escapeHtml(message)}</p></div>`;
        showToast(message, "danger");
    }
    finally {
        submitButtons.forEach((button) => { button.disabled = false; });
    }
}
async function runMarkdownImport() {
    const markdown = valueOf("#md-import");
    const resultPanel = qs("#md-import-result");
    if (!markdown.trim())
        return showToast("请粘贴 drug.md 内容", "warning");
    try {
        if (resultPanel)
            resultPanel.innerHTML = `<div class="card flat">正在校验并保存 drug.md...</div>`;
        const result = await importMarkdown(markdown);
        if (resultPanel)
            resultPanel.innerHTML = renderImportResult(result);
        wireMarkdownCopy();
        showToast("Markdown 药物文件已导入", "success");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (resultPanel)
            resultPanel.innerHTML = `<div class="warning-panel"><strong>导入失败</strong><p>${escapeHtml(message)}</p></div>`;
        showToast(message, "danger");
    }
}
async function readFileAsText(inputId) {
    const file = qs(inputId)?.files?.[0];
    if (!file)
        return "";
    return file.text();
}
async function readFileAsBase64(inputId) {
    const file = qs(inputId)?.files?.[0];
    if (!file)
        return null;
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
    });
    return { base64, name: file.name };
}
async function runCsvImport(saveMode) {
    const panel = qs("#csv-import-result");
    const fileText = await readFileAsText("#csv-file");
    const csvText = fileText || valueOf("#csv-text");
    if (!csvText.trim())
        return showToast("请粘贴 CSV/Excel 表格文本或上传 CSV 文件", "warning");
    try {
        if (panel)
            panel.innerHTML = `<div class="card flat">正在批量解析表格...</div>`;
        const result = await importCsvDrugs({ saveMode, actor: valueOf("#actor") || "web-user", csv_text: csvText, defaults: { system: valueOf("#system") || "western_medicine", primary_category: valueOf("#primary") || "anti_infective", secondary_category: valueOf("#secondary") || undefined, dosage_form: valueOf("#dosage-form") || "other", route: valueOf("#route") || "other", prescription_type: valueOf("#prescription") || "unknown" } });
        if (panel)
            panel.innerHTML = renderBatchResult(result);
        showToast(saveMode === "preview" ? "批量预览完成" : `批量导入完成：${result.succeeded}/${result.total}`, result.failed ? "warning" : "success");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (panel)
            panel.innerHTML = `<div class="warning-panel"><strong>批量导入失败</strong><p>${escapeHtml(message)}</p></div>`;
        showToast(message, "danger");
    }
}
async function runPdfImport(saveMode) {
    const panel = qs("#pdf-import-result");
    const errors = validateCommonBasic();
    const pdf = await readFileAsBase64("#pdf-file");
    if (!pdf)
        errors.push("请上传 PDF 说明书文件。");
    if (errors.length > 0)
        return showValidationErrors(panel, errors);
    try {
        if (panel)
            panel.innerHTML = `<div class="card flat">正在提取 PDF 文本并解析说明书...</div>`;
        const result = await importPdfLabel(buildImportBody(saveMode, undefined, "package_insert", { pdf_base64: pdf.base64, file_name: pdf.name }));
        if (panel)
            panel.innerHTML = renderImportResult(result);
        wireMarkdownCopy();
        showToast(saveMode === "preview" ? "PDF 预览完成" : "PDF 已导入药物库", result.validation.ok ? "success" : "warning");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (panel)
            panel.innerHTML = `<div class="warning-panel"><strong>PDF 导入失败</strong><p>${escapeHtml(message)}</p><p class="muted">若是扫描型 PDF，请使用图片/OCR 导入，并粘贴 OCR 文本。</p></div>`;
        showToast(message, "danger");
    }
}
async function runOcrImport(saveMode) {
    const panel = qs("#ocr-import-result");
    const errors = validateCommonBasic();
    const ocrText = valueOf("#ocr-text");
    if (!ocrText.trim())
        errors.push("请粘贴 OCR/识别后的说明书文本。");
    const image = await readFileAsBase64("#ocr-file");
    if (errors.length > 0)
        return showValidationErrors(panel, errors);
    try {
        if (panel)
            panel.innerHTML = `<div class="card flat">正在解析 OCR 文本...</div>`;
        const result = await importOcrLabel(buildImportBody(saveMode, undefined, "ocr", { image_base64: image?.base64, file_name: image?.name, ocr_text: ocrText }));
        if (panel)
            panel.innerHTML = renderImportResult(result);
        wireMarkdownCopy();
        showToast(saveMode === "preview" ? "OCR 预览完成" : "OCR 文本已导入药物库", result.validation.ok ? "success" : "warning");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (panel)
            panel.innerHTML = `<div class="warning-panel"><strong>OCR 导入失败</strong><p>${escapeHtml(message)}</p></div>`;
        showToast(message, "danger");
    }
}
async function runManualRebuildIndex() {
    const button = qs("#rebuild-index-after-import");
    try {
        if (button) {
            button.disabled = true;
            button.textContent = "重建中...";
        }
        const result = await rebuildIndexes();
        showToast(`索引重建完成，共 ${result.drugs} 个药物`, "success");
        if (button)
            button.textContent = "索引已重建";
    }
    catch (error) {
        showToast(error instanceof Error ? error.message : String(error), "danger");
        if (button) {
            button.disabled = false;
            button.textContent = "手动重建索引";
        }
    }
}
function wireMarkdownCopy() {
    qs("#copy-md")?.addEventListener("click", async () => {
        const text = qs("#markdown-preview")?.value || "";
        await navigator.clipboard?.writeText(text);
        showToast("已复制 Markdown", "success");
    });
    qs("#rebuild-index-after-import")?.addEventListener("click", () => void runManualRebuildIndex());
}
function wireImportPage() {
    qs("#system")?.addEventListener("change", updatePrimaryOptions);
    qs("#primary")?.addEventListener("change", updateSecondaryOptions);
    document.querySelectorAll("[data-import-mode]").forEach((button) => button.addEventListener("click", () => void runLabelImport(button.dataset.importMode)));
    document.querySelectorAll("[data-csv-mode]").forEach((button) => button.addEventListener("click", () => void runCsvImport(button.dataset.csvMode)));
    document.querySelectorAll("[data-pdf-mode]").forEach((button) => button.addEventListener("click", () => void runPdfImport(button.dataset.pdfMode)));
    document.querySelectorAll("[data-ocr-mode]").forEach((button) => button.addEventListener("click", () => void runOcrImport(button.dataset.ocrMode)));
    qs("#import-md")?.addEventListener("click", () => void runMarkdownImport());
    qs("#fill-sample")?.addEventListener("click", () => {
        const name = qs("#generic-cn");
        const strength = qs("#strength");
        const label = qs("#label-text");
        const sourceTitle = qs("#source-title");
        if (name && !name.value)
            name.value = "示例导入药物";
        if (strength && !strength.value)
            strength.value = "示例规格";
        if (sourceTitle && !sourceTitle.value)
            sourceTitle.value = "示例导入药物说明书";
        if (label)
            label.value = SAMPLE_LABEL_TEXT;
        showToast("已填入示例说明书文本", "info");
    });
    qs("#fill-csv-sample")?.addEventListener("click", () => { const csv = qs("#csv-text"); if (csv)
        csv.value = SAMPLE_CSV; showToast("已填入 CSV 示例", "info"); });
    qs("#clear-form")?.addEventListener("click", () => { document.querySelectorAll("input, textarea").forEach((el) => { if (el.type === "checkbox")
        el.checked = false;
    else
        el.value = ""; }); ["#import-result", "#csv-import-result", "#pdf-import-result", "#ocr-import-result", "#md-import-result"].forEach((id) => { const el = qs(id); if (el)
        el.innerHTML = ""; }); });
}
export async function renderImportPage() {
    const plugins = await listPlugins().catch(() => ({ plugins: [] }));
    const tx = taxonomies();
    const defaultSystem = firstValue(tx.drugCategories.systems, "western_medicine");
    const defaultPrimary = firstValue(categoriesForSystem(defaultSystem), "");
    const defaultSecondary = firstValue(childrenForCategory(defaultPrimary), "");
    renderShell(`
    <section class="grid two">
      <div class="card"><h3>可用药物导入插件</h3><div class="list">${plugins.plugins.map((p) => `<div class="item"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.description)}</p><span class="tag">${escapeHtml(p.id)}</span></div>`).join("") || "暂无插件"}</div></div>
      <div class="card"><h3>导入流程</h3><p>所有导入方式最终都会生成标准 <code>drug.md</code>，保存到药物库并自动重建索引。PDF 第一版支持文字型 PDF；扫描件请用 OCR 文本导入。</p><div class="tag-row"><span class="tag">文本</span><span class="tag">Excel/CSV</span><span class="tag">PDF</span><span class="tag">OCR</span><span class="tag">drug.md</span></div></div>
    </section>
    <section class="card" style="margin-top:16px;"><h3>药物基础信息</h3><p class="muted">说明书文本、PDF、OCR 导入会使用这里的基础信息；CSV 可在表格内逐行填写，也可使用这里的默认值。</p>
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
      <div class="actions" style="margin-top:14px;"><button id="fill-sample" class="btn secondary">填入文本示例</button><button id="clear-form" class="btn ghost">清空全部</button></div>
    </section>
    <section class="card" style="margin-top:16px;"><h3>方式一：说明书文本导入</h3><p class="muted">复制说明书文字，插件自动整理成 drug.md。</p><textarea id="label-text" class="textarea" rows="14" placeholder="粘贴完整说明书文本。建议包含【适应症】【用法用量】【禁忌】【注意事项】【不良反应】【药物相互作用】等标题。"></textarea><div class="actions" style="margin-top:14px;"><button data-import-mode="preview" class="btn secondary">预览抽取结果</button><button data-import-mode="publish" class="btn">保存到药物库</button></div><div id="import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;"><h3>方式二：Excel / CSV 批量导入</h3><p class="muted">上传 CSV 文件或粘贴 Excel 复制出的表格文本。第一行为表头。支持通用名、分类、剂型、途径、适应症、用法用量等列。</p><input id="csv-file" class="input" type="file" accept=".csv,.tsv,.txt" /><textarea id="csv-text" class="textarea monospace" rows="10" placeholder="粘贴 CSV/TSV 内容，或上传 CSV 文件。"></textarea><div class="actions" style="margin-top:12px;"><button id="fill-csv-sample" class="btn secondary">填入 CSV 示例</button><button data-csv-mode="preview" class="btn secondary">批量预览</button><button data-csv-mode="publish" class="btn">批量保存到药物库</button></div><div id="csv-import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;"><h3>方式三：PDF 说明书导入</h3><p class="muted">上传文字型 PDF，系统提取文字后生成 drug.md。扫描型 PDF 请使用 OCR 导入。</p><input id="pdf-file" class="input" type="file" accept="application/pdf,.pdf" /><div class="actions" style="margin-top:12px;"><button data-pdf-mode="preview" class="btn secondary">解析 PDF 预览</button><button data-pdf-mode="publish" class="btn">保存 PDF 解析结果</button></div><div id="pdf-import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;"><h3>方式四：图片 / 扫描件 OCR 导入</h3><p class="muted">当前版本不内置 OCR 引擎。请上传图片用于来源记录，并把手机/系统 OCR 识别后的文字粘贴到文本框。</p><input id="ocr-file" class="input" type="file" accept="image/*,.png,.jpg,.jpeg,.webp" /><textarea id="ocr-text" class="textarea" rows="10" placeholder="粘贴 OCR 识别后的说明书文本。"></textarea><div class="actions" style="margin-top:12px;"><button data-ocr-mode="preview" class="btn secondary">解析 OCR 文本预览</button><button data-ocr-mode="publish" class="btn">保存 OCR 解析结果</button></div><div id="ocr-import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;"><h3>方式五：导入标准 drug.md</h3><p class="muted">适合从其他系统或手工维护的标准 Markdown 药物文件导入。保存后直接进入药物库。</p><textarea id="md-import" class="textarea monospace" rows="14" placeholder="粘贴完整 drug.md 内容，包括 JSON frontmatter 和药物说明正文。"></textarea><div class="actions" style="margin-top:12px;"><button id="import-md" class="btn">导入 drug.md</button></div><div id="md-import-result" style="margin-top:16px;"></div></section>
  `, "导入药物", "通过说明书文本、Excel/CSV、PDF、OCR 或标准 drug.md 导入药物信息。");
    wireImportPage();
}
