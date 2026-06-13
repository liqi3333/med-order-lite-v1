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

const SAMPLE_LABEL_TEXT = `【药品名称】\n示例药物\n\n【成份】\n本品主要成份为示例成份。\n\n【性状】\n本品为白色或类白色片。\n\n【适应症】\n用于示例适应症相关场景。实际使用必须以正式说明书和医生判断为准。\n\n【用法用量】\n请根据正式说明书、患者情况和医生判断填写具体用法用量。本示例不可用于真实临床。\n\n【禁忌】\n对本品任何成份过敏者禁用。\n\n【注意事项】\n肝肾功能异常、妊娠、哺乳、儿童和老年患者使用前需由医生评估。\n\n【不良反应】\n可能出现示例不良反应，具体以正式说明书为准。\n\n【药物相互作用】\n与其他药物合用时需评估相互作用。\n\n【孕妇及哺乳期妇女用药】\n妊娠及哺乳期用药需权衡获益和风险。\n\n【儿童用药】\n儿童用药需遵医嘱。\n\n【老年用药】\n老年患者需注意肝肾功能和合并用药。\n\n【贮藏】\n密封保存。\n\n【有效期】\n24个月。\n\n【批准文号】\n示例批准文号。\n\n【说明书修订日期】\n2026-05-18。`;
const SAMPLE_CSV = `中文通用名,英文名,药物体系,一级分类,二级分类,剂型,规格,给药途径,风险标签,适应症,用法用量,禁忌,注意事项\n示例批量药物A,Example Drug A,western_medicine,anti_infective,other_antibacterials,tablet,0.25g,oral,allergy_check_required,请按本地说明书补充适应症,请按本地说明书补充用法用量,请按本地说明书补充禁忌,请按本地说明书补充注意事项\n示例批量药物B,Example Drug B,western_medicine,cardiovascular,other_cardiovascular_drugs,tablet,5mg,oral,renal_adjustment_required,请按本地说明书补充适应症,请按本地说明书补充用法用量,请按本地说明书补充禁忌,请按本地说明书补充注意事项`;

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
      ? `<button id="confirm-import-save" data-kind="${kind}" class="btn">确认保存并更新索引</button><button id="back-to-edit" class="btn secondary">修改表单</button>`
      : "";
  const drugLink =
    result.status === "published"
      ? `<a class="btn secondary" href="#/drugs/${encodeURIComponent(result.drugId)}">查看药物</a><a class="btn" href="#/orders?drug=${encodeURIComponent(result.drugId)}">生成医嘱</a><a class="btn ghost" href="#/import?edit=${encodeURIComponent(result.drugId)}">继续修改</a><button id="rebuild-index-after-import" class="btn ghost">手动重建索引</button>`
      : "";
  return `
    <div class="success-panel"><strong>${isPreview ? "解析预览完成" : "保存完成"}</strong><p>药物 ID：<code>${escapeHtml(result.drugId)}</code>；状态：<code>${escapeHtml(result.status)}</code>；${escapeHtml(statusText)}</p><div class="actions" style="margin-top:12px;">${previewActions}${drugLink}</div></div>
    <div class="${indexTone}"><strong>索引状态</strong><p>${escapeHtml(indexText)}</p></div>
    ${renderIssues("校验错误", validation.errors || [], "danger")}
    ${renderIssues("校验提醒", validation.warnings || [], "warning")}
    ${renderEditDiff(result)}
    <section class="card flat"><h3>结构化字段预览</h3>${renderExtractedSections(result)}</section>
    <details class="advanced-panel card flat"><summary>高级：查看生成的 drug.md</summary><textarea id="markdown-preview" class="textarea monospace" rows="18" readonly>${escapeHtml(result.markdown || "")}</textarea><div class="actions" style="margin-top:12px;"><button id="copy-md" class="btn secondary">复制 Markdown</button></div></details>
    <section class="card flat"><h3>插件备注</h3><ul>${(result.notes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>无</li>"}</ul></section>
  `;
}
function renderBatchResult(
  result: DrugBatchImportResult,
  kind?: ImportKind,
): string {
  const rows = result.results
    .map(
      (item) =>
        `<tr><td><code>${escapeHtml(item.drugId)}</code></td><td>${escapeHtml(item.status)}</td><td>${item.savedPath ? "已保存" : "预览/未保存"}</td><td>${item.validation.ok ? "通过" : "未通过"}</td></tr>`,
    )
    .join("");
  const errors = result.errors.length
    ? `<div class="warning-panel"><strong>批量导入错误</strong><ul>${result.errors.map((x) => `<li>${escapeHtml(`${x.row ? `第 ${x.row} 行：` : ""}${x.drugId ? `${x.drugId}：` : ""}${x.message}`)}</li>`).join("")}</ul></div>`
    : "";
  const previewActions =
    result.status === "preview" && kind
      ? `<div class="actions" style="margin-top:12px;"><button id="confirm-import-save" data-kind="${kind}" class="btn">确认批量保存并更新索引</button><button id="back-to-edit" class="btn secondary">修改表格</button></div>`
      : "";
  return `<div class="${result.failed ? "note-panel" : "success-panel"}"><strong>批量处理完成</strong><p>总数：${result.total}；成功：${result.succeeded}；失败：${result.failed}；${result.indexRebuilt ? `索引已重建，当前药物数：${result.indexCount ?? "未知"}` : result.indexWarning ? `索引重建失败：${escapeHtml(result.indexWarning)}` : "预览模式未重建索引"}</p>${previewActions}</div>${errors}<div class="table-wrap"><table class="data-table"><thead><tr><th>药物 ID</th><th>状态</th><th>保存</th><th>校验</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function composeLabelText(): string {
  const raw = valueOf("#label-text");
  const dosage = valueOf("#dosage-summary").trim();
  if (!dosage) return raw;
  if (/【?用法[与和]?用量】?|用量用法|给药方法/.test(raw)) return raw;
  return `${raw.trim()}\n\n【用法用量】\n${dosage}`.trim();
}
function buildImportBody(
  saveMode: "preview" | "publish",
  labelText?: string,
  sourceType: "manual_entry" | "package_insert" = "manual_entry",
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const brandAndAliases = splitList(valueOf("#aliases"));
  return {
    saveMode,
    actor: valueOf("#actor") || "web-user",
    basic: {
      id: editingDrugId || undefined,
      generic_cn: valueOf("#generic-cn"),
      generic_en: valueOf("#generic-en") || undefined,
      brand_names: brandAndAliases,
      aliases: brandAndAliases,
      system: valueOf("#system"),
      primary_category: valueOf("#primary"),
      secondary_category: valueOf("#secondary"),
      pharmacologic_class: valueOf("#pharm-class") || undefined,
      prescription_type: valueOf("#prescription") || undefined,
    },
    forms: [
      {
        dosage_form: valueOf("#dosage-form"),
        strength: valueOf("#strength") || undefined,
        route: valueOf("#route"),
        package_unit: valueOf("#package-unit") || undefined,
        manufacturer: valueOf("#manufacturer") || undefined,
        approval_number: valueOf("#approval-number") || undefined,
      },
    ],
    risk_tags: selectedCheckboxValues("risk"),
    source: {
      title: valueOf("#source-title") || `${valueOf("#generic-cn")} 说明书`,
      url: valueOf("#source-url") || undefined,
      revision_date: valueOf("#revision-date") || undefined,
      source_type: sourceType,
    },
    label_text: labelText ?? composeLabelText(),
    ...extra,
  };
}
function validateCommonBasic(): string[] {
  const errors: string[] = [];
  if (!valueOf("#generic-cn").trim()) errors.push("请填写中文通用名。");
  if (!valueOf("#system")) errors.push("请选择药物体系。");
  if (!valueOf("#primary")) errors.push("请选择一级分类。");
  if (!valueOf("#dosage-form")) errors.push("请选择剂型。");
  if (!valueOf("#route")) errors.push("请选择给药途径。");
  return errors;
}
function validateLabelForm(): string[] {
  const errors = validateCommonBasic();
  if (!composeLabelText().trim())
    errors.push("请粘贴说明书文本或填写用法用量。");
  return errors;
}
function showValidationErrors(panel: Element | null, errors: string[]): void {
  if (panel)
    panel.innerHTML = `<div class="warning-panel"><strong>无法继续</strong><ul>${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
  showToast(errors[0], "danger");
}
async function showDuplicateHint(): Promise<void> {
  const panel = qs("#duplicate-hint");
  const name = valueOf("#generic-cn").trim();
  if (!panel || !name) {
    if (panel) panel.innerHTML = "";
    return;
  }
  const result = await searchDrugs({ q: name }).catch(() => ({ items: [] }));
  const matches = result.items.filter(
    (item) =>
      item.generic_cn === name ||
      item.aliases.includes(name) ||
      item.brand_names.includes(name),
  );
  const otherMatches = editingDrugId
    ? matches.filter((item) => item.id !== editingDrugId)
    : matches;
  if (otherMatches.length === 0) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = `<div class="note-panel"><strong>可能重复</strong><p>药物库中已有相同或相近药物：${otherMatches.map((item) => `<a href="#/drugs/${encodeURIComponent(item.id)}">${escapeHtml(item.generic_cn)}</a>`).join("、")}。保存前请确认是否为同一药物。</p></div>`;
}
function wireResultActions(kind?: ImportKind): void {
  qs("#copy-md")?.addEventListener("click", async () => {
    const text = qs<HTMLTextAreaElement>("#markdown-preview")?.value || "";
    await navigator.clipboard?.writeText(text);
    showToast("已复制 Markdown", "success");
  });
  qs("#rebuild-index-after-import")?.addEventListener(
    "click",
    () => void runManualRebuildIndex(),
  );
  qs("#back-to-edit")?.addEventListener("click", () =>
    qs("#import-workflow")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    }),
  );
  qs("#confirm-import-save")?.addEventListener("click", () => {
    const nextKind =
      (qs<HTMLButtonElement>("#confirm-import-save")?.dataset.kind as
        | ImportKind
        | undefined) || kind;
    if (nextKind === "csv") void runCsvImport("publish");
    else if (nextKind === "pdf") void runPdfImport("publish");
    else void runLabelImport("publish");
  });
}
async function runLabelImport(saveMode: "preview" | "publish"): Promise<void> {
  const resultPanel = qs("#import-result");
  const errors = validateLabelForm();
  if (errors.length > 0) return showValidationErrors(resultPanel, errors);
  await showDuplicateHint();
  try {
    setImportButtonsDisabled(true);
    if (resultPanel)
      resultPanel.innerHTML = `<div class="card flat">正在解析说明书文本...</div>`;
    const result = await importLabelText(buildImportBody(saveMode));
    if (resultPanel)
      resultPanel.innerHTML = renderImportResult(
        result,
        saveMode === "preview" ? "label" : undefined,
      );
    wireResultActions("label");
    showToast(
      saveMode === "preview"
        ? "预览完成，请检查后确认保存"
        : "已保存到药物库并更新索引",
      result.validation.ok ? "success" : "warning",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (resultPanel)
      resultPanel.innerHTML = `<div class="warning-panel"><strong>处理失败</strong><p>${escapeHtml(message)}</p></div>`;
    showToast(message, "danger");
  } finally {
    setImportButtonsDisabled(false);
  }
}
async function runMarkdownImport(): Promise<void> {
  const markdown = valueOf("#md-import");
  const resultPanel = qs("#md-import-result");
  if (!markdown.trim())
    return showToast("请粘贴或修改 drug.md 内容", "warning");
  try {
    if (resultPanel)
      resultPanel.innerHTML = `<div class="card flat">正在校验并保存 drug.md...</div>`;
    const result = await importMarkdown(markdown);
    if (resultPanel) resultPanel.innerHTML = renderImportResult(result);
    wireResultActions();
    showToast("Markdown 药物文件已保存并更新索引", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (resultPanel)
      resultPanel.innerHTML = `<div class="warning-panel"><strong>导入失败</strong><p>${escapeHtml(message)}</p></div>`;
    showToast(message, "danger");
  }
}
async function readFileAsText(inputId: string): Promise<string> {
  const file = qs<HTMLInputElement>(inputId)?.files?.[0];
  if (!file) return "";
  return file.text();
}
async function readFileAsBase64(
  inputId: string,
): Promise<{ base64: string; name: string } | null> {
  const file = qs<HTMLInputElement>(inputId)?.files?.[0];
  if (!file) return null;
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  return { base64, name: file.name };
}
async function runCsvImport(saveMode: "preview" | "publish"): Promise<void> {
  const panel = qs("#csv-import-result");
  const fileText = await readFileAsText("#csv-file");
  const csvText = fileText || valueOf("#csv-text");
  if (!csvText.trim())
    return showToast("请粘贴 CSV/Excel 表格文本或上传 CSV 文件", "warning");
  try {
    setImportButtonsDisabled(true);
    if (panel)
      panel.innerHTML = `<div class="card flat">正在批量解析表格...</div>`;
    const result = await importCsvDrugs({
      saveMode,
      actor: valueOf("#actor") || "web-user",
      csv_text: csvText,
      defaults: {
        system: valueOf("#system") || "western_medicine",
        primary_category: valueOf("#primary") || "anti_infective",
        secondary_category: valueOf("#secondary") || undefined,
        dosage_form: valueOf("#dosage-form") || "other",
        route: valueOf("#route") || "other",
        prescription_type: valueOf("#prescription") || "unknown",
      },
    });
    if (panel)
      panel.innerHTML = renderBatchResult(
        result,
        saveMode === "preview" ? "csv" : undefined,
      );
    wireResultActions("csv");
    showToast(
      saveMode === "preview"
        ? "批量预览完成，请确认后保存"
        : `批量导入完成：${result.succeeded}/${result.total}`,
      result.failed ? "warning" : "success",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (panel)
      panel.innerHTML = `<div class="warning-panel"><strong>批量导入失败</strong><p>${escapeHtml(message)}</p></div>`;
    showToast(message, "danger");
  } finally {
    setImportButtonsDisabled(false);
  }
}
async function runPdfImport(saveMode: "preview" | "publish"): Promise<void> {
  const panel = qs("#pdf-import-result");
  const errors = validateCommonBasic();
  const pdf = await readFileAsBase64("#pdf-file");
  if (!pdf) errors.push("请上传 PDF 说明书文件。");
  if (errors.length > 0 || !pdf) return showValidationErrors(panel, errors);
  try {
    setImportButtonsDisabled(true);
    if (panel)
      panel.innerHTML = `<div class="card flat">正在提取 PDF 文本并解析说明书...</div>`;
    const result = await importPdfLabel(
      buildImportBody(saveMode, undefined, "package_insert", {
        pdf_base64: pdf.base64,
        file_name: pdf.name,
      }),
    );
    if (panel)
      panel.innerHTML = renderImportResult(
        result,
        saveMode === "preview" ? "pdf" : undefined,
      );
    wireResultActions("pdf");
    showToast(
      saveMode === "preview"
        ? "PDF 预览完成，请确认后保存"
        : "PDF 已导入药物库",
      result.validation.ok ? "success" : "warning",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (panel)
      panel.innerHTML = `<div class="warning-panel"><strong>PDF 导入失败</strong><p>${escapeHtml(message)}</p><p class="muted">若是扫描型 PDF，请先使用外部 OCR 识别，再粘贴到“说明书文本”入口。</p></div>`;
    showToast(message, "danger");
  } finally {
    setImportButtonsDisabled(false);
  }
}
async function runManualRebuildIndex(): Promise<void> {
  const button = qs<HTMLButtonElement>("#rebuild-index-after-import");
  try {
    if (button) {
      button.disabled = true;
      button.textContent = "重建中...";
    }
    const result = await rebuildIndexes();
    showToast(`索引重建完成，共 ${result.drugs} 个药物`, "success");
    if (button) button.textContent = "索引已重建";
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), "danger");
    if (button) {
      button.disabled = false;
      button.textContent = "手动重建索引";
    }
  }
}
function setImportButtonsDisabled(disabled: boolean): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-import-action], #import-md")
    .forEach((button) => {
      button.disabled = disabled;
    });
}
function showMethod(kind: string): void {
  document
    .querySelectorAll<HTMLElement>("[data-import-panel]")
    .forEach((panel) => {
      panel.hidden = panel.dataset.importPanel !== kind;
    });
}
function wireImportPage(): void {
  qs("#system")?.addEventListener("change", updatePrimaryOptions);
  qs("#primary")?.addEventListener("change", updateSecondaryOptions);
  qs("#generic-cn")?.addEventListener("blur", () => void showDuplicateHint());
  qs("#import-method")?.addEventListener("change", () =>
    showMethod(valueOf("#import-method") || "label"),
  );
  qs("#parse-label")?.addEventListener(
    "click",
    () => void runLabelImport("preview"),
  );
  qs("#parse-csv")?.addEventListener(
    "click",
    () => void runCsvImport("preview"),
  );
  qs("#parse-pdf")?.addEventListener(
    "click",
    () => void runPdfImport("preview"),
  );
  qs("#import-md")?.addEventListener("click", () => void runMarkdownImport());
  qs("#fill-sample")?.addEventListener("click", () => {
    const name = qs<HTMLInputElement>("#generic-cn");
    const strength = qs<HTMLInputElement>("#strength");
    const label = qs<HTMLTextAreaElement>("#label-text");
    const sourceTitle = qs<HTMLInputElement>("#source-title");
    const dosage = qs<HTMLTextAreaElement>("#dosage-summary");
    if (name && !name.value) name.value = "示例导入药物";
    if (strength && !strength.value) strength.value = "0.25g";
    if (sourceTitle && !sourceTitle.value)
      sourceTitle.value = "示例导入药物说明书";
    if (dosage && !dosage.value)
      dosage.value = "请根据正式说明书、患者情况和医生判断填写具体用法用量。";
    if (label) label.value = SAMPLE_LABEL_TEXT;
    showToast("已填入示例说明书文本", "info");
  });
  qs("#fill-csv-sample")?.addEventListener("click", () => {
    const csv = qs<HTMLTextAreaElement>("#csv-text");
    if (csv) csv.value = SAMPLE_CSV;
    showToast("已填入 CSV 示例", "info");
  });
  qs("#clear-form")?.addEventListener("click", () => {
    document
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea")
      .forEach((el) => {
        if (el.type === "checkbox") (el as HTMLInputElement).checked = false;
        else el.value = "";
      });
    [
      "#import-result",
      "#csv-import-result",
      "#pdf-import-result",
      "#md-import-result",
      "#duplicate-hint",
    ].forEach((id) => {
      const el = qs(id);
      if (el) el.innerHTML = "";
    });
  });
  showMethod(valueOf("#import-method") || "label");
}

function defaultsFromDrug(
  detail: DrugDocumentResponse,
  rawMarkdown: string,
): Defaults {
  const fm = detail.frontmatter;
  const form = fm.forms[0] || { dosage_form: "", route: "" };
  const source = fm.sources[0] || { title: "", url: "", revision_date: "" };
  const aliases = Array.from(
    new Set([...(fm.names.brand_names || []), ...(fm.names.aliases || [])]),
  ).join("，");
  return {
    genericCn: fm.names.generic_cn,
    genericEn: fm.names.generic_en || "",
    aliases,
    actor: "web-user",
    system: fm.classification.system,
    primary: fm.classification.primary_category,
    secondary: fm.classification.secondary_category || "",
    pharmacologicClass: fm.classification.pharmacologic_class || "",
    prescription: fm.classification.prescription_type || "",
    dosageForm: form.dosage_form,
    strength: form.strength || "",
    route: form.route,
    packageUnit: form.package_unit || "",
    manufacturer: form.manufacturer || "",
    approvalNumber: form.approval_number || "",
    sourceTitle: source.title || `${fm.names.generic_cn} 说明书`,
    sourceUrl: source.url || "",
    revisionDate:
      source.revision_date || sectionValue(detail.label.revision_date),
    dosageSummary: sectionValue(detail.label.dosage),
    labelText: labelSectionsToText(detail.label),
    rawMarkdown,
    riskTags: fm.risk_tags || [],
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
    <section class="card" id="import-workflow"><div class="section-title"><div><h3>${editingDrugId ? "修改药物信息" : "导入基础信息"}</h3><p class="muted">首屏只保留核心字段；其它维护字段收进“更多信息”。</p></div>${editingDrugId ? `<a class="btn ghost" href="#/drugs/${encodeURIComponent(editingDrugId)}">返回药物详情</a>` : ""}</div>
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
      <div class="actions" style="margin-top:14px;"><button id="fill-sample" class="btn secondary">填入文本示例</button><button id="clear-form" class="btn ghost">清空全部</button></div>
    </section>`;
}

export async function renderImportPage(): Promise<void> {
  editingDrugId = getParam("edit");
  editingOriginal = null;
  let defaults: Defaults = {};
  if (editingDrugId) {
    const detail = await getDrug(editingDrugId);
    const raw = await getRawDrugMarkdown(editingDrugId).catch(() => "");
    editingOriginal = detail;
    defaults = defaultsFromDrug(detail, raw);
  }
  const plugins = await listPlugins().catch(() => ({ plugins: [] }));
  renderShell(
    `
    ${renderBasicForm(defaults)}
    <section class="card" style="margin-top:16px;"><h3>选择导入方式</h3><p class="muted">先解析并预览，检查后再确认保存；需要调整时点“修改表单”。</p><div class="form-field"><label>导入方式</label><select id="import-method" class="select"><option value="label">粘贴说明书文本 / OCR 后文本</option><option value="pdf">上传文字型 PDF</option><option value="csv">Excel / CSV 批量导入</option></select></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="label"><h3>说明书文本</h3><p class="muted">可粘贴完整说明书，也可粘贴手机/系统 OCR 后的文本。</p><textarea id="label-text" class="textarea" rows="14" placeholder="粘贴完整说明书文本。建议包含【适应症】【用法用量】【禁忌】【注意事项】【不良反应】【药物相互作用】等标题。">${escapeHtml(defaults.labelText || "")}</textarea><div class="actions" style="margin-top:14px;"><button id="parse-label" data-import-action="label" class="btn">解析并预览</button></div><div id="import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="pdf" hidden><h3>PDF 说明书</h3><p class="muted">上传文字型 PDF。扫描件请先用外部 OCR 识别，再粘贴到“说明书文本”。</p><input id="pdf-file" class="input" type="file" accept="application/pdf,.pdf" /><div class="actions" style="margin-top:12px;"><button id="parse-pdf" data-import-action="pdf" class="btn">解析并预览</button></div><div id="pdf-import-result" style="margin-top:16px;"></div></section>
    <section class="card" style="margin-top:16px;" data-import-panel="csv" hidden><h3>Excel / CSV 批量导入</h3><p class="muted">上传 CSV 文件或粘贴 Excel 复制出的表格文本。第一行为表头。</p><input id="csv-file" class="input" type="file" accept=".csv,.tsv,.txt" /><textarea id="csv-text" class="textarea monospace" rows="10" placeholder="粘贴 CSV/TSV 内容，或上传 CSV 文件。"></textarea><div class="actions" style="margin-top:12px;"><button id="fill-csv-sample" class="btn secondary">填入 CSV 示例</button><button id="parse-csv" data-import-action="csv" class="btn">批量解析并预览</button></div><div id="csv-import-result" style="margin-top:16px;"></div></section>
    <details class="advanced-panel card" style="margin-top:16px;"><summary>高级维护工具</summary>
      <div class="grid two" style="margin-top:16px;">
        <div><h3>可用插件</h3><div class="list">${plugins.plugins.map((p) => `<div class="item"><strong>${escapeHtml(p.name)}</strong><p>${escapeHtml(p.description)}</p><span class="tag">${escapeHtml(p.id)}</span></div>`).join("") || "暂无插件"}</div></div>
        <div><h3>标准 drug.md 导入 / 维护</h3><p class="muted">适合开发者或维护人员直接修改完整 Markdown。保存后会覆盖同 ID 药物并重建索引。</p><textarea id="md-import" class="textarea monospace" rows="16" placeholder="粘贴完整 drug.md 内容，包括 JSON frontmatter 和药物说明正文。">${escapeHtml(defaults.rawMarkdown || "")}</textarea><div class="actions" style="margin-top:12px;"><button id="import-md" class="btn">保存 drug.md 并更新索引</button></div><div id="md-import-result" style="margin-top:16px;"></div></div>
      </div>
    </details>
  `,
    editingDrugId ? "维护药物" : "导入药物",
    "导入和维护统一为：填写核心信息 → 解析预览 → 修改 / 确认保存 → 自动更新索引。",
  );
  wireImportPage();
}
