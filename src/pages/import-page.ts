import {
  importCsvDrugs,
  importLabelText,
  importMarkdown,
  importPdfLabel,
  listPlugins,
  DrugBatchImportResult,
  DrugImportResult,
  ValidationIssue,
} from "../api/import-api.js";
import { getDrug, getRawDrugMarkdown, searchDrugs } from "../api/drug-api.js";
import { rebuildIndexes } from "../api/system-api.js";
import { parseLabelWithAI, getAIConfig } from "../api/ai-api.js";
import { renderShell } from "../components/shell.js";
import { state } from "../state.js";
import { DrugDocumentResponse } from "../types/drug.js";
import {
  escapeHtml,
  optionHtml,
  qs,
  splitList,
  valueOf,
} from "../utils/html.js";
import { showToast } from "../utils/toast.js";

const SAMPLE_LABEL_TEXT = `【药品名称】
示例药物

【成份】
本品主要成份为示例成份。

【性状】
本品为白色或类白色片。

【适应症】
用于示例适应症相关场景。实际使用必须以正式说明书和医生判断为准。

【用法用量】
请根据正式说明书、患者情况和医生判断填写具体用法用量。本示例不可用于真实临床。

【禁忌】
对本品任何成份过敏者禁用。

【注意事项】
肝肾功能异常、妊娠、哺乳、儿童和老年患者使用前需由医生评估。

【不良反应】
可能出现示例不良反应，具体以正式说明书为准。

【药物相互作用】
与其他药物合用时需评估相互作用。

【孕妇及哺乳期妇女用药】
妊娠及哺乳期用药需权衡获益和风险。

【儿童用药】
儿童用药需遵医嘱。

【老年用药】
老年患者需注意肝肾功能和合并用药。

【贮藏】
密封保存。

【有效期】
24个月。

【批准文号】
示例批准文号。

【说明书修订日期】
2026-05-18。`;

const SAMPLE_CSV = `中文通用名,英文名,药物体系,一级分类,二级分类,剂型,规格,给药途径,风险标签,适应症,用法用量,禁忌,注意事项
示例批量药物A,Example Drug A,western_medicine,anti_infective,other_antibacterials,tablet,0.25g,oral,allergy_check_required,请按本地说明书补充适应症,请按本地说明书补充用法用量,请按本地说明书补充禁忌,请按本地说明书补充注意事项
示例批量药物B,Example Drug B,western_medicine,cardiovascular,other_cardiovascular_drugs,tablet,5mg,oral,renal_adjustment_required,请按本地说明书补充适应症,请按本地说明书补充用法用量,请按本地说明书补充禁忌,请按本地说明书补充注意事项`;

const PACKAGE_UNIT_OPTIONS = [
  { value: "box", label: "盒" },
  { value: "bottle", label: "瓶" },
  { value: "vial", label: "瓶 / 西林瓶" },
  { value: "ampoule", label: "支 / 安瓿" },
  { value: "syringe", label: "支 / 预充式注射器" },
  { value: "bag", label: "袋" },
  { value: "tube", label: "管" },
  { value: "tablet", label: "片" },
  { value: "capsule", label: "粒 / 胶囊" },
  { value: "patch", label: "贴" },
  { value: "dose", label: "剂" },
  { value: "local_package_insert", label: "按本地说明书填写" },
];

type ImportKind = "label" | "csv" | "pdf";
type Defaults = {
  genericCn?: string;
  genericEn?: string;
  aliases?: string;
  actor?: string;
  system?: string;
  primary?: string;
  secondary?: string;
  pharmacologicClass?: string;
  prescription?: string;
  dosageForm?: string;
  strength?: string;
  route?: string;
  packageUnit?: string;
  manufacturer?: string;
  approvalNumber?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  revisionDate?: string;
  dosageSummary?: string;
  labelText?: string;
  rawMarkdown?: string;
  riskTags?: string[];
};

let editingDrugId = "";
let editingOriginal: DrugDocumentResponse | null = null;

function taxonomies() {
  return (
    state.taxonomies || {
      drugCategories: { systems: [], categories: [] },
      dosageForms: [],
      routes: [],
      prescriptionTypes: [],
      riskTags: [],
      frequencies: [],
    }
  );
}
function categoriesForSystem(system: string) {
  return taxonomies()
    .drugCategories.categories.filter((cat) => !system || cat.system === system)
    .map((cat) => ({ value: cat.value, label: cat.label }));
}
function childrenForCategory(primary: string) {
  return (
    taxonomies().drugCategories.categories.find((cat) => cat.value === primary)
      ?.children || []
  );
}
function firstValue<T extends { value: string }>(
  items: T[],
  fallback = "",
): string {
  return items[0]?.value || fallback;
}
function selectedCheckboxValues(name: string): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[name="${name}"]:checked`,
    ),
  ).map((item) => item.value);
}
function getParam(name: string): string {
  return (
    new URLSearchParams(window.location.hash.split("?")[1] || "").get(name) ||
    ""
  );
}
function attr(value?: string): string {
  return escapeHtml(value || "");
}
function sectionValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function updatePrimaryOptions(): void {
  const system = valueOf("#system");
  const primary = qs<HTMLSelectElement>("#primary");
  if (!primary) return;
  const options = categoriesForSystem(system);
  const current = primary.value;
  const nextValue = options.some((item) => item.value === current)
    ? current
    : firstValue(options);
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
  const nextValue = options.some((item) => item.value === current)
    ? current
    : firstValue(options);
  secondary.innerHTML = optionHtml(options, nextValue, "请选择二级分类");
  secondary.value = nextValue;
}

function labelSectionsToText(label: DrugDocumentResponse["label"]): string {
  const rows: Array<[string, string]> = [
    ["成份", sectionValue(label.composition)],
    ["性状", sectionValue(label.character)],
    ["适应症", sectionValue(label.indications)],
    ["用法用量", sectionValue(label.dosage)],
    ["禁忌", sectionValue(label.contraindications)],
    ["注意事项", sectionValue(label.precautions)],
    ["不良反应", sectionValue(label.adverse_reactions)],
    ["药物相互作用", sectionValue(label.interactions)],
    ["药理毒理", sectionValue(label.pharmacology_toxicology)],
    ["药代动力学", sectionValue(label.pharmacokinetics)],
    ["贮藏", sectionValue(label.storage)],
    ["包装", sectionValue(label.packaging)],
    ["有效期", sectionValue(label.validity)],
    ["执行标准", sectionValue(label.standard)],
    ["批准文号", sectionValue(label.approval_number)],
    ["说明书修订日期", sectionValue(label.revision_date)],
  ];
  const specialLabels: Record<string, string> = {
    pregnancy: "孕妇及哺乳期妇女用药",
    lactation: "哺乳期妇女用药",
    pediatric: "儿童用药",
    geriatric: "老年用药",
    renal_impairment: "肾功能不全",
    hepatic_impairment: "肝功能不全",
    driving_or_machines: "驾驶与机械操作",
  };
  const special = label.special_populations || {};
  for (const [key, title] of Object.entries(specialLabels))
    rows.push([title, special[key] || ""]);
  return rows
    .filter(([, text]) => text.trim())
    .map(([title, text]) => `【${title}】\n${text.trim()}`)
    .join("\n\n");
}

function sectionLabel(key: string): string {
  const labels: Record<string, string> = {
    composition: "成分",
    character: "性状",
    indications: "适应症/功能主治",
    dosage: "用法用量",
    contraindications: "禁忌",
    precautions: "注意事项",
    adverse_reactions: "不良反应",
    interactions: "药物相互作用",
    pharmacology_toxicology: "药理毒理",
    pharmacokinetics: "药代动力学",
    storage: "贮藏",
    packaging: "包装",
    validity: "有效期",
    standard: "执行标准",
    approval_number: "批准文号",
    revision_date: "说明书修订日期",
    pregnancy: "妊娠",
    lactation: "哺乳",
    pediatric: "儿童",
    geriatric: "老年",
    renal_impairment: "肾功能不全",
    hepatic_impairment: "肝功能不全",
    driving_or_machines: "驾驶与机械操作",
  };
  return labels[key] || key;
}
function renderIssues(
  title: string,
  issues: ValidationIssue[],
  tone: "danger" | "warning",
): string {
  if (issues.length === 0) return "";
  return `<div class="${tone === "danger" ? "warning-panel" : "note-panel"}"><strong>${escapeHtml(title)}</strong><ul>${issues.map((item) => `<li>${escapeHtml(item.field ? `${item.field}：${item.message}` : item.message)}</li>`).join("")}</ul></div>`;
}
function renderExtractedSections(result: DrugImportResult): string {
  const label = result.document?.label || {};
  const rows: string[] = [];
  for (const [key, value] of Object.entries(label)) {
    if (key === "special_populations") continue;
    if (typeof value === "string" && value.trim())
      rows.push(
        `<tr><th>${escapeHtml(sectionLabel(key))}</th><td>${escapeHtml(value.slice(0, 500))}${value.length > 500 ? "..." : ""}</td></tr>`,
      );
  }
  const special = (label.special_populations || {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(special)) {
    if (typeof value === "string" && value.trim())
      rows.push(
        `<tr><th>特殊人群：${escapeHtml(sectionLabel(key))}</th><td>${escapeHtml(value.slice(0, 500))}${value.length > 500 ? "..." : ""}</td></tr>`,
      );
  }
  if (rows.length === 0)
    return `<div class="warning-panel">未识别到结构化章节。请确认文本中包含【适应症】【用法用量】【禁忌】【注意事项】等标题。</div>`;
  return `<div class="table-wrap"><table class="data-table"><tbody>${rows.join("")}</tbody></table></div>`;
}
function renderEditDiff(result: DrugImportResult): string {
  if (!editingOriginal || !result.document) return "";
  const oldLabel = editingOriginal.label;
  const nextLabel = result.document.label;
  const keys: Array<keyof typeof oldLabel> = [
    "indications",
    "dosage",
    "contraindications",
    "precautions",
    "adverse_reactions",
    "interactions",
  ];
  const rows = keys
    .map((key) => {
      const before = sectionValue(oldLabel[key]);
      const after = sectionValue(nextLabel[key]);
      if (before.trim() === after.trim()) return "";
      return `<tr><th>${escapeHtml(sectionLabel(String(key)))}</th><td><strong>原内容</strong><p>${escapeHtml(before || "空")}</p><strong>新内容</strong><p>${escapeHtml(after || "空")}</p></td></tr>`;
    })
    .filter(Boolean)
    .join("");
  if (!rows)
    return `<section class="card flat"><h3>修改差异</h3><p class="muted">核心字段暂未发现变化。确认保存后仍会更新维护时间和索引。</p></section>`;
  return `<section class="card flat"><h3>修改差异</h3><div class="table-wrap"><table class="data-table"><tbody>${rows}</tbody></table></div></section>`;
}
function renderImportResult(
  result: DrugImportResult,
  kind?: ImportKind,
): string {
  const validation = result.validation;
  const isPreview = result.status === "preview";
  const statusText = result.savedPath
    ? `已保存到药物库：${result.savedPath}`
    : "仅预览，未写入文件";
  const indexText =
    result.status === "published"
      ? result.indexRebuilt
        ? `索引已自动重建，当前索引药物数：${result.indexCount ?? "未知"}`
        : `索引未自动重建成功${result.indexWarning ? `：${result.indexWarning}` : ""}`
      : "预览模式不重建索引；确认保存后会自动更新索引";
  const indexTone =
    result.status === "published" && !result.indexRebuilt
      ? "warning-panel"
      : "success-panel";
  const previewActions =
    isPreview && kind
      ? `<button id="confirm-import-save" data-kind="${kind}" class="btn btn-primary">确认保存并更新索引</button><button id="back-to-edit" class="btn btn-ghost">修改表单</button>`
      : "";
  const drugLink =
    result.status === "published"
      ? `<a class="btn btn-ghost" href="#/drugs/${encodeURIComponent(result.drugId)}">查看药物</a><a class="btn btn-ghost" href="#/orders?drug=${encodeURIComponent(result.drugId)}">生成医嘱</a><a class="btn btn-ghost" href="#/import?edit=${encodeURIComponent(result.drugId)}">继续修改</a><button id="rebuild-index-after-import" class="btn btn-ghost">手动重建索引</button>`
      : "";
  return `
    <div class="success-panel"><strong>${isPreview ? "解析预览完成" : "保存完成"}</strong><p>药物 ID：<code>${escapeHtml(result.drugId)}</code>；状态：<code>${escapeHtml(result.status)}</code>；${escapeHtml(statusText)}</p><div class="actions" style="margin-top:12px;">${previewActions}${drugLink}</div></div>
    <div class="${indexTone}"><strong>索引状态</strong><p>${escapeHtml(indexText)}</p></div>
    ${renderIssues("校验错误", validation.errors || [], "danger")}
    ${renderIssues("校验提醒", validation.warnings || [], "warning")}
    ${renderEditDiff(result)}
    <section class="card flat"><h3>结构化字段预览</h3>${renderExtractedSections(result)}</section>
    <details class="advanced-panel card flat"><summary>高级：查看生成的 drug.md</summary><textarea id="markdown-preview" class="textarea monospace" rows="18" readonly>${escapeHtml(result.markdown || "")}</textarea><div class="actions" style="margin-top:12px;"><button id="copy-md" class="btn btn-ghost">复制 Markdown</button></div></details>`;
}
function renderBatchResult(result: DrugBatchImportResult): string {
  const indexText =
    result.status === "published"
      ? result.indexRebuilt
        ? `索引已自动重建，当前索引药物数：${result.indexCount ?? "未知"}`
        : `索引未自动重建成功${result.indexWarning ? `：${result.indexWarning}` : ""}`
      : "预览模式不重建索引";
  const indexTone =
    result.status === "published" && !result.indexRebuilt
      ? "warning-panel"
      : "success-panel";
  const rows = result.results.map((item) => {
    const validation = item.validation;
    const errorCount = (validation.errors || []).length;
    const warnCount = (validation.warnings || []).length;
    return `<tr><td>${escapeHtml(item.drugId)}</td><td>${escapeHtml(item.status)}</td><td>${errorCount} 错误 / ${warnCount} 提醒</td><td>${item.savedPath ? `<a href="#/drugs/${encodeURIComponent(item.drugId)}">查看</a>` : "未保存"}</td></tr>`;
  });
  const previewActions =
    result.status === "preview"
      ? `<button id="confirm-batch-save" class="btn btn-primary">确认保存全部并更新索引</button><button id="back-to-edit" class="btn btn-ghost">修改表单</button>`
      : "";
  return `
    <div class="success-panel"><strong>批量导入${result.status === "preview" ? "预览" : "完成"}</strong><p>共 ${result.total} 条，成功 ${result.succeeded} 条，失败 ${result.failed} 条。</p><div class="actions" style="margin-top:12px;">${previewActions}</div></div>
    <div class="${indexTone}"><strong>索引状态</strong><p>${escapeHtml(indexText)}</p></div>
    ${renderIssues("导入错误", result.errors.map((e) => ({ level: "error" as const, code: "batch_error", message: e.message })), "danger")}
    <div class="table-wrap"><table class="data-table"><thead><tr><th>药物 ID</th><th>状态</th><th>校验</th><th>链接</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function defaultsFromDrug(
  detail: DrugDocumentResponse,
  raw: string,
): Defaults {
  const fm = detail.frontmatter;
  const label = detail.label;
  return {
    genericCn: fm.names.generic_cn,
    genericEn: fm.names.generic_en,
    aliases: [
      ...(fm.names.brand_names || []),
      ...(fm.names.aliases || []),
    ].join(", "),
    system: fm.classification.system,
    primary: fm.classification.primary_category,
    secondary: fm.classification.secondary_category,
    pharmacologicClass: fm.classification.pharmacologic_class,
    prescription: fm.classification.prescription_type,
    dosageForm: fm.forms[0]?.dosage_form,
    strength: fm.forms[0]?.strength,
    route: fm.forms[0]?.route,
    packageUnit: fm.forms[0]?.package_unit,
    manufacturer: fm.forms[0]?.manufacturer,
    approvalNumber: fm.forms[0]?.approval_number,
    sourceTitle: fm.sources[0]?.title,
    sourceUrl: fm.sources[0]?.url,
    revisionDate: fm.sources[0]?.revision_date,
    dosageSummary: labelSectionsToText(label),
    labelText: raw || labelSectionsToText(label),
    rawMarkdown: raw,
    riskTags: fm.risk_tags,
  };
}

function renderBasicForm(defaults: Defaults): string {
  const tx = taxonomies();
  const defaultSystem =
    defaults.system ||
    firstValue(tx.drugCategories.systems, "western_medicine");
  const defaultPrimary =
    defaults.primary || firstValue(categoriesForSystem(defaultSystem), "");
  const defaultSecondary =
    defaults.secondary || firstValue(childrenForCategory(defaultPrimary), "");
  return `
    <details class="advanced-panel card" id="import-workflow"><summary>${editingDrugId ? "修改药物信息" : "导入基础信息"}</summary>
      <div style="margin-top:16px;">
        ${editingDrugId ? `<div class="info-panel" style="margin-bottom:14px;"><strong>正在维护已保存药物：</strong><code>${escapeHtml(editingDrugId)}</code><p>确认保存后会覆盖原药物文件、自动重建索引，并递增维护版本。若修改分类导致文件路径变化，旧文件会自动移除。</p></div>` : ""}
        <div id="duplicate-hint"></div>
        <div class="form-grid">
          <div class="form-field"><label>中文通用名 <span class="required">*</span></label><input id="generic-cn" class="input" value="${attr(defaults.genericCn)}" placeholder="例如：某某药物" /></div>
          <div class="form-field"><label>药物体系 <span class="required">*</span></label><select id="system" class="select">${optionHtml(tx.drugCategories.systems, defaultSystem, "请选择药物体系")}</select></div>
          <div class="form-field"><label>药物分类 <span class="required">*</span></label><select id="primary" class="select">${optionHtml(categoriesForSystem(defaultSystem), defaultPrimary, "请选择一级分类")}</select></div>
          <div class="form-field"><label>剂型 <span class="required">*</span></label><select id="dosage-form" class="select">${optionHtml(tx.dosageForms, defaults.dosageForm || firstValue(tx.dosageForms), "请选择剂型")}</select></div>
          <div class="form-field"><label>给药途径 <span class="required">*</span></label><select id="route" class="select">${optionHtml(tx.routes, defaults.route || firstValue(tx.routes), "请选择给药途径")}</select></div>
          <div class="form-field"><label>规格</label><input id="strength" class="input" value="${attr(defaults.strength)}" placeholder="自由输入，例如：0.25g / 5mg / 100ml:0.9g" /></div>
        </div>
        <div class="form-field" style="margin-top:14px;"><label>用法用量</label><textarea id="dosage-summary" class="textarea" rows="4" placeholder="可直接填写常用用法用量；系统会作为说明书结构化字段的一部分。">${escapeHtml(defaults.dosageSummary || "")}</textarea></div>
        <details class="advanced-panel" style="margin-top:14px;"><summary>更多信息</summary>
          <div class="form-grid" style="margin-top:14px;">
            <div class="form-field"><label>英文名</label><input id="generic-en" class="input" value="${attr(defaults.genericEn)}" /></div>
            <div class="form-field"><label>商品名 / 别名</label><input id="aliases" class="input" value="${attr(defaults.aliases)}" placeholder="多个用逗号分隔" /></div>
            <div class="form-field"><label>二级分类</label><select id="secondary" class="select">${optionHtml(childrenForCategory(defaultPrimary), defaultSecondary, "请选择二级分类")}</select></div>
            <div class="form-field"><label>药理分类</label><input id="pharm-class" class="input" value="${attr(defaults.pharmacologicClass)}" placeholder="如：β-内酰胺类抗菌药" /></div>
            <div class="form-field"><label>处方属性</label><select id="prescription" class="select">${optionHtml(tx.prescriptionTypes, defaults.prescription || firstValue(tx.prescriptionTypes), "请选择处方属性")}</select></div>
            <div class="form-field"><label>包装单位</label><select id="package-unit" class="select">${optionHtml(PACKAGE_UNIT_OPTIONS, defaults.packageUnit || "box", "请选择包装单位")}</select></div>
            <div class="form-field"><label>生产厂家</label><input id="manufacturer" class="input" value="${attr(defaults.manufacturer)}" /></div>
            <div class="form-field"><label>批准文号</label><input id="approval-number" class="input" value="${attr(defaults.approvalNumber)}" /></div>
            <div class="form-field"><label>来源标题</label><input id="source-title" class="input" value="${attr(defaults.sourceTitle)}" placeholder="例如：某某药物说明书" /></div>
            <div class="form-field"><label>来源 URL</label><input id="source-url" class="input" value="${attr(defaults.sourceUrl)}" placeholder="可选" /></div>
            <div class="form-field"><label>说明书修订日期</label><input id="revision-date" class="input" value="${attr(defaults.revisionDate)}" placeholder="例如：2026-05-18" /></div>
            <div class="form-field"><label>录入 / 修改人</label><input id="actor" class="input" value="${attr(defaults.actor || "web-user")}" /></div>
          </div>
          <div class="form-field" style="margin-top:12px;"><label>风险标签</label><div class="checkbox-grid">${tx.riskTags.map((x) => `<label><input type="checkbox" name="risk" value="${escapeHtml(x.value)}" ${(defaults.riskTags || []).includes(x.value) ? "checked" : ""} /> ${escapeHtml(x.label)}</label>`).join("") || "暂无风险标签"}</div></div>
        </details>
        <div class="actions" style="margin-top:14px;"><button id="fill-sample" class="btn btn-ghost">填入文本示例</button><button id="clear-form" class="btn btn-ghost">清空全部</button></div>
      </div>
    </details>`;
}

function collectFormData(): Defaults {
  return {
    genericCn: valueOf("#generic-cn"),
    genericEn: valueOf("#generic-en"),
    aliases: valueOf("#aliases"),
    actor: valueOf("#actor"),
    system: valueOf("#system"),
    primary: valueOf("#primary"),
    secondary: valueOf("#secondary"),
    pharmacologicClass: valueOf("#pharm-class"),
    prescription: valueOf("#prescription"),
    dosageForm: valueOf("#dosage-form"),
    strength: valueOf("#strength"),
    route: valueOf("#route"),
    packageUnit: valueOf("#package-unit"),
    manufacturer: valueOf("#manufacturer"),
    approvalNumber: valueOf("#approval-number"),
    sourceTitle: valueOf("#source-title"),
    sourceUrl: valueOf("#source-url"),
    revisionDate: valueOf("#revision-date"),
    dosageSummary: valueOf("#dosage-summary"),
    labelText: valueOf("#label-text"),
    riskTags: selectedCheckboxValues("risk"),
  };
}

function validateRequiredFields(): string[] {
  const errors: string[] = [];
  if (!valueOf("#generic-cn").trim()) errors.push("中文通用名");
  if (!valueOf("#system").trim()) errors.push("药物体系");
  if (!valueOf("#primary").trim()) errors.push("药物分类");
  if (!valueOf("#dosage-form").trim()) errors.push("剂型");
  if (!valueOf("#route").trim()) errors.push("给药途径");
  return errors;
}

function buildLabelPayload(): Record<string, unknown> {
  const defaults = collectFormData();
  return {
    text: valueOf("#label-text"),
    generic_cn: defaults.genericCn,
    generic_en: defaults.genericEn,
    aliases: defaults.aliases,
    system: defaults.system,
    primary_category: defaults.primary,
    secondary_category: defaults.secondary,
    pharmacologic_class: defaults.pharmacologicClass,
    prescription_type: defaults.prescription,
    dosage_form: defaults.dosageForm,
    strength: defaults.strength,
    route: defaults.route,
    package_unit: defaults.packageUnit,
    manufacturer: defaults.manufacturer,
    approval_number: defaults.approvalNumber,
    source_title: defaults.sourceTitle,
    source_url: defaults.sourceUrl,
    revision_date: defaults.revisionDate,
    actor: defaults.actor,
    risk_tags: defaults.riskTags,
    dosage_summary: defaults.dosageSummary,
  };
}

async function confirmSave(kind: ImportKind): Promise<void> {
  const target = qs("#import-result") || qs("#csv-import-result") || qs("#pdf-import-result");
  if (target) target.innerHTML = `<div class="loading">正在保存...</div>`;
  try {
    const payload = buildLabelPayload();
    let result: DrugImportResult;
    if (kind === "label") {
      result = await importLabelText({ ...payload, saveMode: "publish" });
    } else if (kind === "pdf") {
      result = await importPdfLabel({ ...payload, saveMode: "publish" });
    } else {
      return;
    }
    if (target) target.innerHTML = renderImportResult(result, kind);
    wireResultEvents(result, kind);
    showToast("药物已保存", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
    showToast(message, "danger");
  }
}

async function confirmBatchSave(): Promise<void> {
  const target = qs("#csv-import-result");
  if (target) target.innerHTML = `<div class="loading">正在保存...</div>`;
  try {
    const result = await importCsvDrugs({ csv: valueOf("#csv-text"), saveMode: "publish" });
    if (target) target.innerHTML = renderBatchResult(result);
    wireBatchResultEvents(result);
    showToast("批量导入已保存", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
    showToast(message, "danger");
  }
}

function wireResultEvents(result: DrugImportResult, kind?: ImportKind): void {
  qs("#confirm-import-save")?.addEventListener("click", () => {
    if (kind) confirmSave(kind);
  });
  qs("#back-to-edit")?.addEventListener("click", () => {
    const panel = qs(`[data-import-panel="${kind}"]`);
    if (panel) {
      const resultEl = panel.querySelector<HTMLElement>("#import-result, #pdf-import-result");
      if (resultEl) resultEl.innerHTML = "";
    }
  });
  qs("#copy-md")?.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(result.markdown || "");
    showToast("Markdown 已复制", "success");
  });
  qs("#rebuild-index-after-import")?.addEventListener("click", async () => {
    try {
      await rebuildIndexes();
      showToast("索引重建完成", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "danger");
    }
  });
}

function wireBatchResultEvents(result: DrugBatchImportResult): void {
  qs("#confirm-batch-save")?.addEventListener("click", () => {
    confirmBatchSave();
  });
  qs("#back-to-edit")?.addEventListener("click", () => {
    const panel = qs(`[data-import-panel="csv"]`);
    if (panel) {
      const resultEl = panel.querySelector<HTMLElement>("#csv-import-result");
      if (resultEl) resultEl.innerHTML = "";
    }
  });
}

function wireImportPage(): void {
  qs("#system")?.addEventListener("change", updatePrimaryOptions);
  qs("#primary")?.addEventListener("change", updateSecondaryOptions);

  qs("#import-method")?.addEventListener("change", () => {
    const method = valueOf("#import-method");
    document.querySelectorAll<HTMLElement>("[data-import-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.importPanel !== method;
    });
  });

  qs("#fill-sample")?.addEventListener("click", () => {
    const fm = qs("#generic-cn") as HTMLInputElement;
    if (fm) fm.value = "示例药物";
    const ta = qs("#dosage-summary") as HTMLTextAreaElement;
    if (ta) ta.value = "口服，一次1片，一日3次";
    const lt = qs("#label-text") as HTMLTextAreaElement;
    if (lt) lt.value = SAMPLE_LABEL_TEXT;
  });

  qs("#clear-form")?.addEventListener("click", () => {
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "#import-workflow input, #import-workflow textarea, #import-workflow select",
    ).forEach((el) => {
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        el.checked = false;
      } else if (el instanceof HTMLSelectElement) {
        el.selectedIndex = 0;
      } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        el.value = "";
      }
    });
    updatePrimaryOptions();
  });

  qs("#parse-label")?.addEventListener("click", async () => {
    const missing = validateRequiredFields();
    if (missing.length) {
      showToast(`请填写必填项：${missing.join("、")}`, "danger");
      return;
    }
    const text = valueOf("#label-text");
    if (!text.trim()) {
      showToast("请输入说明书文本", "danger");
      return;
    }
    const target = qs("#import-result");
    if (target) target.innerHTML = `<div class="loading">正在解析...</div>`;
    try {
      const payload = buildLabelPayload();
      const result = await importLabelText(payload);
      if (target) target.innerHTML = renderImportResult(result, "label");
      wireResultEvents(result, "label");
      showToast("解析完成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
      showToast(message, "danger");
    }
  });

  qs("#parse-pdf")?.addEventListener("click", async () => {
    const missing = validateRequiredFields();
    if (missing.length) {
      showToast(`请填写必填项：${missing.join("、")}`, "danger");
      return;
    }
    const input = document.getElementById("pdf-file") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      showToast("请选择 PDF 文件", "danger");
      return;
    }
    const target = qs("#pdf-import-result");
    if (target) target.innerHTML = `<div class="loading">正在解析 PDF...</div>`;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const payload = buildLabelPayload();
      const result = await importPdfLabel({ ...payload, filename: file.name, data: base64 });
      if (target) target.innerHTML = renderImportResult(result, "pdf");
      wireResultEvents(result, "pdf");
      showToast("PDF 解析完成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
      showToast(message, "danger");
    }
  });

  qs("#fill-csv-sample")?.addEventListener("click", () => {
    const ta = qs("#csv-text") as HTMLTextAreaElement;
    if (ta) ta.value = SAMPLE_CSV;
  });

  qs("#parse-csv")?.addEventListener("click", async () => {
    const text = valueOf("#csv-text");
    if (!text.trim()) {
      showToast("请输入 CSV 内容或上传文件", "danger");
      return;
    }
    const target = qs("#csv-import-result");
    if (target) target.innerHTML = `<div class="loading">正在批量解析...</div>`;
    try {
      const result = await importCsvDrugs({ csv: text });
      if (target) target.innerHTML = renderBatchResult(result);
      wireBatchResultEvents(result);
      showToast("批量解析完成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
      showToast(message, "danger");
    }
  });

  qs("#csv-file")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const ta = qs("#csv-text") as HTMLTextAreaElement;
      if (ta) ta.value = text;
    } catch {
      showToast("无法读取文件", "danger");
    }
  });

  qs("#import-md")?.addEventListener("click", async () => {
    const md = valueOf("#md-import");
    if (!md.trim()) {
      showToast("请输入 drug.md 内容", "danger");
      return;
    }
    const target = qs("#md-import-result");
    if (target) target.innerHTML = `<div class="loading">正在保存...</div>`;
    try {
      const result = await importMarkdown(md);
      if (target) target.innerHTML = renderImportResult(result);
      wireResultEvents(result);
      showToast("drug.md 已保存", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
      showToast(message, "danger");
    }
  });

  // AI import
  (async () => {
    try {
      const aiCfg = await getAIConfig();
      const statusEl = qs("#ai-status");
      if (statusEl) {
        if (aiCfg.enabled && aiCfg.api_key_set) {
          statusEl.innerHTML = `<span class="ai-status-ok">AI 已启用</span> <span class="muted">(${escapeHtml(aiCfg.provider)} / ${escapeHtml(aiCfg.model)})</span>`;
        } else {
          statusEl.innerHTML = `<span class="ai-status-warn">AI 未启用</span> <span class="muted">请先在导航栏点击 ⚙️ 配置 API Key</span>`;
        }
      }
    } catch { /* ignore */ }
  })();

  qs("#parse-ai")?.addEventListener("click", async () => {
    const text = valueOf("#ai-label-text");
    if (!text.trim()) {
      showToast("请输入说明书文本", "danger");
      return;
    }
    const missing = validateRequiredFields();
    if (missing.length) {
      showToast(`请填写必填项：${missing.join("、")}`, "danger");
      return;
    }
    const target = qs("#ai-import-result");
    if (target) target.innerHTML = `<div class="loading">AI 正在解析...</div>`;
    try {
      const aiResult = await parseLabelWithAI(text, {
        generic_cn: valueOf("#generic-cn"),
        system: valueOf("#system"),
        primary_category: valueOf("#primary"),
        secondary_category: valueOf("#secondary"),
      });
      if (!aiResult.success || !aiResult.data) {
        throw new Error(aiResult.error || "AI 解析失败");
      }
      const data = aiResult.data;
      // Fill form fields from AI result
      const setVal = (sel: string, val: string) => {
        const el = qs<HTMLInputElement>(sel);
        if (el && val) el.value = val;
      };
      if (data.names.generic_cn) setVal("#generic-cn", data.names.generic_cn);
      if (data.names.generic_en) setVal("#generic-en", data.names.generic_en);
      if (data.classification.system) {
        setVal("#system", data.classification.system);
        updatePrimaryOptions();
      }
      if (data.classification.primary_category) setVal("#primary", data.classification.primary_category);
      if (data.classification.secondary_category) setVal("#secondary", data.classification.secondary_category);
      if (data.classification.pharmacologic_class) setVal("#pharm-class", data.classification.pharmacologic_class);
      if (data.classification.prescription_type) setVal("#prescription", data.classification.prescription_type);
      if (data.forms[0]) {
        if (data.forms[0].dosage_form) setVal("#dosage-form", data.forms[0].dosage_form);
        if (data.forms[0].strength) setVal("#strength", data.forms[0].strength);
        if (data.forms[0].route) setVal("#route", data.forms[0].route);
        if (data.forms[0].manufacturer) setVal("#manufacturer", data.forms[0].manufacturer);
        if (data.forms[0].approval_number) setVal("#approval-number", data.forms[0].approval_number);
      }
      // Use AI label to do a standard import
      const payload = buildLabelPayload();
      payload.label_text = text;
      const result = await importLabelText({ ...payload, saveMode: "preview" });
      if (target) {
        const confPct = Math.round(data.confidence * 100);
        const confClass = data.confidence >= 0.8 ? "ai-conf-high" : data.confidence >= 0.5 ? "ai-conf-mid" : "ai-conf-low";
        let html = `<div class="ai-parse-info"><span class="ai-badge ${confClass}">置信度 ${confPct}%</span> <span class="muted">provider: ${escapeHtml(aiResult.provider)} / ${escapeHtml(aiResult.model)} / ${aiResult.parse_time_ms}ms</span></div>`;
        if (data.warnings.length > 0) {
          html += `<div class="ai-warnings">${data.warnings.map((w) => `<div class="ai-warning-item">⚠️ ${escapeHtml(w)}</div>`).join("")}</div>`;
        }
        html += renderImportResult(result, "label");
        target.innerHTML = html;
      }
      wireResultEvents(result, "label");
      showToast("AI 解析完成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (target) target.innerHTML = `<div class="warning-panel">${escapeHtml(message)}</div>`;
      showToast(message, "danger");
    }
  });
}

export async function renderImportPage(): Promise<void> {
  editingDrugId = getParam("edit");
  editingOriginal = null;
  let defaults: Defaults = {};
  if (editingDrugId) {
    try {
      const detail = await getDrug(editingDrugId);
      const raw = await getRawDrugMarkdown(editingDrugId).catch(() => "");
      editingOriginal = detail;
      defaults = defaultsFromDrug(detail, raw);
    } catch {
      showToast("无法加载药物信息", "danger");
    }
  }
  const plugins = await listPlugins().catch(() => ({ plugins: [] }));
  renderShell(
    `
    ${renderBasicForm(defaults)}
    <section class="card" style="margin-top:16px;"><h3>选择导入方式</h3><p class="muted">先解析并预览，检查后再确认保存；需要调整时点"修改表单"。</p><div class="form-field"><label>导入方式</label><select id="import-method" class="select"><option value="label">粘贴说明书文本 / OCR 后文本</option><option value="ai">AI 智能解析</option><option value="pdf">上传文字型 PDF</option><option value="csv">Excel / CSV 批量导入</option></select></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="label"><h3>说明书文本</h3><p class="muted">可粘贴完整说明书，也可粘贴手机/系统 OCR 后的文本。</p><textarea id="label-text" class="textarea" rows="14" placeholder="粘贴完整说明书文本。建议包含【适应症】【用法用量】【禁忌】【注意事项】【不良反应】【药物相互作用】等标题。">${escapeHtml(defaults.labelText || "")}</textarea><div class="actions" style="margin-top:14px;"><button id="parse-label" data-import-action="label" class="btn btn-primary">解析并预览</button></div><div id="import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="ai" hidden><h3>AI 智能解析</h3><p class="muted">使用 AI 自动解析药品说明书，提取结构化信息。支持任意格式文本，自动推断分类。</p><div id="ai-status" class="ai-status-bar"></div><textarea id="ai-label-text" class="textarea" rows="14" placeholder="粘贴完整说明书文本。AI 将自动识别药品名称、分类、适应症、用法用量等字段。">${escapeHtml(defaults.labelText || "")}</textarea><div class="actions" style="margin-top:14px;"><button id="parse-ai" data-import-action="ai" class="btn btn-primary">AI 解析并预览</button></div><div id="ai-import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="pdf" hidden><h3>PDF 说明书</h3><p class="muted">上传文字型 PDF。扫描件请先用外部 OCR 识别，再粘贴到"说明书文本"。</p><input id="pdf-file" class="input" type="file" accept="application/pdf,.pdf" /><div class="actions" style="margin-top:12px;"><button id="parse-pdf" data-import-action="pdf" class="btn btn-primary">解析并预览</button></div><div id="pdf-import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="csv" hidden><h3>Excel / CSV 批量导入</h3><p class="muted">上传 CSV 文件或粘贴 Excel 复制出的表格文本。第一行为表头。</p><input id="csv-file" class="input" type="file" accept=".csv,.tsv,.txt" /><textarea id="csv-text" class="textarea monospace" rows="10" placeholder="粘贴 CSV/TSV 内容，或上传 CSV 文件。"></textarea><div class="actions" style="margin-top:12px;"><button id="fill-csv-sample" class="btn btn-ghost">填入 CSV 示例</button><button id="parse-csv" data-import-action="csv" class="btn btn-primary">批量解析并预览</button></div><div id="csv-import-result" style="margin-top:16px;"></div></section>
    <details class="advanced-panel card" style="margin-top:16px;"><summary>高级维护工具</summary>
      <div class="grid two" style="margin-top:16px;">
        <div><h3>可用插件</h3><div class="list">${plugins.plugins.map((p) => `<div class="item"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.description)}</p><span class="tag">${escapeHtml(p.id)}</span></div>`).join("") || "暂无插件"}</div></div>
        <div><h3>标准 drug.md 导入 / 维护</h3><p class="muted">适合开发者或维护人员直接修改完整 Markdown。保存后会覆盖同 ID 药物并重建索引。</p><textarea id="md-import" class="textarea monospace" rows="16" placeholder="粘贴完整 drug.md 内容，包括 JSON frontmatter 和药物说明正文。">${escapeHtml(defaults.rawMarkdown || "")}</textarea><div class="actions" style="margin-top:12px;"><button id="import-md" class="btn btn-primary">保存 drug.md 并更新索引</button></div><div id="md-import-result" style="margin-top:16px;"></div></div>
      </div>
    </details>
  `,
    editingDrugId ? "维护药物" : "导入药物",
    "导入和维护统一为：填写核心信息 → 解析预览 → 修改 / 确认保存 → 自动更新索引。",
  );
  wireImportPage();
}
