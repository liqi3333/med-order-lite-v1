import { DrugImportContext, DrugImportPlugin, LabelTextImportInput } from "../../modules/drug-entry-plugin/types.js";
import { DrugFrontmatter, DrugLabelSections } from "../../modules/drug-kb/types.js";
import { labelTextPlugin } from "../label-text/plugin.js";

export interface CsvDrugsImportInput {
  saveMode?: "preview" | "publish";
  actor?: string;
  csv_text: string;
  defaults?: Partial<LabelTextImportInput["basic"]> & {
    dosage_form?: string;
    route?: string;
    strength?: string;
    prescription_type?: string;
  };
}

export interface GeneratedDrugDraft {
  frontmatter: DrugFrontmatter;
  label: DrugLabelSections;
  notes: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  generic_cn: ["generic_cn", "中文通用名", "通用名", "药物通用名", "药品名称", "药名"],
  generic_en: ["generic_en", "英文名", "英文通用名"],
  brand_names: ["brand_names", "商品名", "商品名/别名"],
  aliases: ["aliases", "别名", "别称"],
  system: ["system", "药物体系", "体系"],
  primary_category: ["primary_category", "一级分类", "主分类"],
  secondary_category: ["secondary_category", "二级分类", "子分类"],
  pharmacologic_class: ["pharmacologic_class", "药理分类", "药物分类"],
  prescription_type: ["prescription_type", "处方属性"],
  dosage_form: ["dosage_form", "剂型"],
  strength: ["strength", "规格"],
  route: ["route", "给药途径", "途径"],
  package_unit: ["package_unit", "包装单位"],
  manufacturer: ["manufacturer", "生产厂家", "厂家", "生产企业"],
  approval_number: ["approval_number", "批准文号"],
  risk_tags: ["risk_tags", "风险标签"],
  source_title: ["source_title", "来源标题", "说明书来源标题"],
  source_url: ["source_url", "来源URL", "来源 URL", "url"],
  revision_date: ["revision_date", "说明书修订日期", "修订日期"],
  label_text: ["label_text", "说明书文本", "说明书正文", "全文"],
  composition: ["composition", "成分", "成份"],
  character: ["character", "性状"],
  indications: ["indications", "适应症", "功能主治"],
  dosage: ["dosage", "用法用量"],
  contraindications: ["contraindications", "禁忌"],
  precautions: ["precautions", "注意事项"],
  adverse_reactions: ["adverse_reactions", "不良反应"],
  interactions: ["interactions", "药物相互作用"],
  pregnancy_lactation: ["pregnancy_lactation", "孕妇及哺乳期妇女用药", "妊娠哺乳"],
  pediatric: ["pediatric", "儿童用药"],
  geriatric: ["geriatric", "老年用药"],
  storage: ["storage", "贮藏"],
  validity: ["validity", "有效期"],
  standard: ["standard", "执行标准"]
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i += 1; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === "," || ch === "\t")) { row.push(cell.trim()); cell = ""; continue; }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((x) => x.trim())) rows.push(row);
      row = []; cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function splitList(value?: string): string[] {
  return (value || "").split(/[，,;；|]/).map((x) => x.trim()).filter(Boolean);
}

function getField(row: Record<string, string>, key: string): string {
  const aliases = HEADER_ALIASES[key] || [key];
  for (const alias of aliases) {
    const found = Object.entries(row).find(([header]) => header.trim().toLowerCase() === alias.trim().toLowerCase());
    if (found?.[1]) return found[1].trim();
  }
  return "";
}

function buildLabelText(row: Record<string, string>): string {
  const direct = getField(row, "label_text");
  if (direct) return direct;
  const sections: Array<[string, string]> = [
    ["成份", getField(row, "composition")],
    ["性状", getField(row, "character")],
    ["适应症", getField(row, "indications")],
    ["用法用量", getField(row, "dosage")],
    ["禁忌", getField(row, "contraindications")],
    ["注意事项", getField(row, "precautions")],
    ["不良反应", getField(row, "adverse_reactions")],
    ["药物相互作用", getField(row, "interactions")],
    ["孕妇及哺乳期妇女用药", getField(row, "pregnancy_lactation")],
    ["儿童用药", getField(row, "pediatric")],
    ["老年用药", getField(row, "geriatric")],
    ["贮藏", getField(row, "storage")],
    ["有效期", getField(row, "validity")],
    ["执行标准", getField(row, "standard")],
    ["批准文号", getField(row, "approval_number")],
    ["说明书修订日期", getField(row, "revision_date")]
  ];
  return sections.filter(([, value]) => value.trim()).map(([title, value]) => `【${title}】\n${value.trim()}`).join("\n\n");
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((x) => x.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

export async function buildCsvDrugDrafts(input: CsvDrugsImportInput, context: DrugImportContext): Promise<GeneratedDrugDraft[]> {
  if (!input.csv_text?.trim()) throw new Error("csv_text 不能为空，请粘贴或上传 CSV/TSV 表格内容。");
  const rows = rowsToObjects(parseCsv(input.csv_text));
  if (rows.length === 0) throw new Error("没有解析到药物行。请确认第一行为表头，后续为药物数据。");
  const drafts: GeneratedDrugDraft[] = [];
  for (const [index, row] of rows.entries()) {
    const genericCn = getField(row, "generic_cn");
    if (!genericCn) throw new Error(`第 ${index + 2} 行缺少通用名/药品名称。`);
    const labelText = buildLabelText(row);
    if (!labelText.trim()) throw new Error(`第 ${index + 2} 行缺少说明书文本或结构化说明书字段。`);
    const importInput: LabelTextImportInput = {
      saveMode: input.saveMode,
      actor: input.actor,
      basic: {
        generic_cn: genericCn,
        generic_en: getField(row, "generic_en") || input.defaults?.generic_en,
        brand_names: splitList(getField(row, "brand_names")),
        aliases: splitList(getField(row, "aliases")),
        system: getField(row, "system") || input.defaults?.system || "western_medicine",
        primary_category: getField(row, "primary_category") || input.defaults?.primary_category || "anti_infective",
        secondary_category: getField(row, "secondary_category") || input.defaults?.secondary_category,
        pharmacologic_class: getField(row, "pharmacologic_class") || input.defaults?.pharmacologic_class,
        prescription_type: getField(row, "prescription_type") || input.defaults?.prescription_type || "unknown"
      },
      forms: [{
        dosage_form: getField(row, "dosage_form") || input.defaults?.dosage_form || "other",
        strength: getField(row, "strength") || input.defaults?.strength,
        route: getField(row, "route") || input.defaults?.route || "other",
        package_unit: getField(row, "package_unit"),
        manufacturer: getField(row, "manufacturer"),
        approval_number: getField(row, "approval_number")
      }],
      risk_tags: splitList(getField(row, "risk_tags")),
      label_text: labelText,
      source: {
        title: getField(row, "source_title") || `${genericCn} 批量导入资料`,
        url: getField(row, "source_url"),
        revision_date: getField(row, "revision_date"),
        source_type: "manual_entry"
      }
    };
    const generated = await labelTextPlugin.import(importInput, context);
    generated.notes.unshift(`来自 CSV/Excel 第 ${index + 2} 行。`);
    drafts.push(generated);
  }
  return drafts;
}

export const excelCsvPlugin: DrugImportPlugin<CsvDrugsImportInput> = {
  id: "excel-csv",
  name: "Excel / CSV 批量导入",
  description: "接收 CSV/TSV 表格文本，逐行生成标准 drug.md。适合常用药清单和医院药品目录批量导入。",
  inputSchema: {
    saveMode: ["preview", "publish"],
    csv_text: "CSV 或 TSV 表格文本，第一行为表头",
    defaults: "缺省分类、剂型、给药途径等字段"
  },
  async import(input, context) {
    const drafts = await buildCsvDrugDrafts(input, context);
    if (drafts.length !== 1) throw new Error("excel-csv 是批量导入插件，请调用 /api/plugins/excel-csv/import-batch 或 /api/drugs/import/csv。");
    return drafts[0];
  },
  async importBatch(input, context) {
    return buildCsvDrugDrafts(input as CsvDrugsImportInput, context);
  }
};
