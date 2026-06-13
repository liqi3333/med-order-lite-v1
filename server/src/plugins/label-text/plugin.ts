import { slugify } from "../../utils/fs.js";
import { createEmptyLabelSections } from "../../modules/drug-kb/drug-md.js";
import {
  DrugImportPlugin,
  LabelTextImportInput,
} from "../../modules/drug-entry-plugin/types.js";
import { DrugLabelSections } from "../../modules/drug-kb/types.js";

type LabelKey = keyof Omit<DrugLabelSections, "special_populations">;
type SpecialKey = keyof NonNullable<DrugLabelSections["special_populations"]>;

const headingMap: Array<{ key: LabelKey; patterns: RegExp[] }> = [
  {
    key: "composition",
    patterns: [/^成[份分]$/i, /^主要成[份分]$/i, /^活性成[份分]$/i, /^组成$/i],
  },
  { key: "character", patterns: [/^性状$/i, /^性状特征$/i] },
  {
    key: "indications",
    patterns: [/^适应症$/i, /^适应证$/i, /^功能主治$/i, /^主治$/i, /^用途$/i],
  },
  {
    key: "dosage",
    patterns: [
      /^用法用量$/i,
      /^用法与用量$/i,
      /^用量用法$/i,
      /^给药方法$/i,
      /^使用方法$/i,
    ],
  },
  { key: "contraindications", patterns: [/^禁忌$/i, /^禁忌症$/i, /^禁用$/i] },
  {
    key: "precautions",
    patterns: [
      /^注意事项$/i,
      /^警告和注意事项$/i,
      /^警告$/i,
      /^注意$/i,
      /^特别警告$/i,
    ],
  },
  { key: "adverse_reactions", patterns: [/^不良反应$/i, /^副作用$/i] },
  {
    key: "interactions",
    patterns: [/^药物相互作用$/i, /^相互作用$/i, /^药物交互作用$/i],
  },
  {
    key: "pharmacology_toxicology",
    patterns: [/^药理毒理$/i, /^药理作用$/i, /^药效学$/i],
  },
  { key: "pharmacokinetics", patterns: [/^药代动力学$/i, /^药物代谢动力学$/i] },
  { key: "storage", patterns: [/^贮藏$/i, /^储藏$/i, /^保存$/i, /^贮法$/i] },
  { key: "packaging", patterns: [/^包装$/i, /^包装规格$/i] },
  { key: "validity", patterns: [/^有效期$/i] },
  { key: "standard", patterns: [/^执行标准$/i, /^药品标准$/i] },
  {
    key: "approval_number",
    patterns: [/^批准文号$/i, /^注册证号$/i, /^进口药品注册证号$/i],
  },
  {
    key: "revision_date",
    patterns: [
      /^说明书修订日期$/i,
      /^说明书修订$/i,
      /^核准日期$/i,
      /^修订日期$/i,
    ],
  },
];

const specialMap: Array<{ key: SpecialKey; patterns: RegExp[] }> = [
  { key: "pregnancy", patterns: [/妊娠/i, /孕妇/i, /孕产妇/i] },
  { key: "lactation", patterns: [/哺乳/i, /乳母/i] },
  { key: "pediatric", patterns: [/儿童/i, /小儿/i, /儿科/i] },
  { key: "geriatric", patterns: [/老年/i, /老人/i] },
  { key: "renal_impairment", patterns: [/肾功能/i, /肾损害/i, /肾衰/i] },
  { key: "hepatic_impairment", patterns: [/肝功能/i, /肝损害/i, /肝衰/i] },
  { key: "driving_or_machines", patterns: [/驾驶/i, /机械/i, /操作机器/i] },
];

function normalizeTitle(value: string): string {
  return value
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^[（(]?(?:第)?[一二三四五六七八九十百\d]+[、.．)）]\s*/, "")
    .replace(/[【】\[\]（）()]/g, "")
    .replace(/\s+/g, "")
    .replace(/[：:]+$/g, "")
    .trim();
}

function matchHeading(title: string): LabelKey | null {
  const normalized = normalizeTitle(title);
  for (const item of headingMap) {
    if (item.patterns.some((pattern) => pattern.test(normalized)))
      return item.key;
  }
  return null;
}

function matchSpecialHeadings(title: string): SpecialKey[] {
  const normalized = normalizeTitle(title);
  return specialMap
    .filter((item) => item.patterns.some((pattern) => pattern.test(normalized)))
    .map((item) => item.key);
}

function parseHeadingLine(
  line: string,
): { title: string; rest: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const markdown = trimmed.match(/^#{1,6}\s+(.+?)\s*$/);
  if (markdown) return { title: markdown[1], rest: "" };

  const bracket = trimmed.match(
    /^[【\[]([^】\]]{1,40})[】\]]\s*[:：]?\s*(.*)$/,
  );
  if (bracket) return { title: bracket[1], rest: bracket[2] || "" };

  const parenthesis = trimmed.match(
    /^[（(]([^）)]{1,40})[）)]\s*[:：]?\s*(.*)$/,
  );
  if (parenthesis) return { title: parenthesis[1], rest: parenthesis[2] || "" };

  const numbered = trimmed.match(
    /^(?:第?[一二三四五六七八九十百\d]+[、.．)）]\s*)([^：:]{1,40})(?:[:：]\s*(.*))?$/,
  );
  if (numbered) return { title: numbered[1], rest: numbered[2] || "" };

  const colon = trimmed.match(/^([^：:]{1,40})[:：]\s*(.*)$/);
  if (colon) return { title: colon[1], rest: colon[2] || "" };

  if (/^[\u4e00-\u9fa5A-Za-z0-9/、（）()\s]{2,24}$/.test(trimmed)) {
    return { title: trimmed, rest: "" };
  }

  return null;
}

function assignLabelValue(
  label: DrugLabelSections,
  key: LabelKey,
  value: string,
): void {
  const cleaned = value.trim();
  if (!cleaned) return;
  const existing = label[key];
  label[key] = existing?.trim() ? `${existing.trim()}\n${cleaned}` : cleaned;
}

function assignSpecialValue(
  label: DrugLabelSections,
  keys: SpecialKey[],
  value: string,
): void {
  const cleaned = value.trim();
  if (!cleaned || keys.length === 0) return;
  label.special_populations = label.special_populations || {};
  for (const key of keys) {
    const existing = label.special_populations[key];
    label.special_populations[key] = existing?.trim()
      ? `${existing.trim()}\n${cleaned}`
      : cleaned;
  }
}

function extractInlineField(text: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bracket = new RegExp(
      `(?:【${escaped}】|${escaped}[：:])\\s*([^\\n]+)`,
      "i",
    ).exec(text);
    if (bracket?.[1]?.trim()) return bracket[1].trim();
  }
  return undefined;
}

function extractSections(text: string): DrugLabelSections {
  const label = createEmptyLabelSections();
  const normalizedText = (text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ");
  const lines = normalizedText.split("\n");
  let currentKey: LabelKey | null = null;
  let currentSpecialKeys: SpecialKey[] = [];
  let buffer: string[] = [];

  function flush(): void {
    const value = buffer.join("\n").trim();
    if (currentKey) assignLabelValue(label, currentKey, value);
    if (currentSpecialKeys.length > 0)
      assignSpecialValue(label, currentSpecialKeys, value);
    buffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const parsed = parseHeadingLine(line);
    if (parsed) {
      const matched = matchHeading(parsed.title);
      const special = matchSpecialHeadings(parsed.title);
      if (matched || special.length > 0) {
        flush();
        currentKey = matched;
        currentSpecialKeys = special;
        if (parsed.rest.trim()) buffer.push(parsed.rest.trim());
        continue;
      }
    }

    if (currentKey || currentSpecialKeys.length > 0) buffer.push(line);
  }
  flush();

  label.approval_number =
    label.approval_number ||
    extractInlineField(normalizedText, [
      "批准文号",
      "注册证号",
      "进口药品注册证号",
    ]) ||
    "";
  label.revision_date =
    label.revision_date ||
    extractInlineField(normalizedText, [
      "说明书修订日期",
      "核准日期",
      "修订日期",
    ]) ||
    "";

  return label;
}

function nonEmptyKeys(label: DrugLabelSections): string[] {
  const result: string[] = [];
  for (const [key, value] of Object.entries(label)) {
    if (key === "special_populations") continue;
    if (typeof value === "string" && value.trim()) result.push(key);
  }
  for (const [key, value] of Object.entries(label.special_populations || {})) {
    if (typeof value === "string" && value.trim())
      result.push(`special_populations.${key}`);
  }
  return result;
}

export const labelTextPlugin: DrugImportPlugin<LabelTextImportInput> = {
  id: "label-text",
  name: "说明书文本导入",
  description:
    "接收粘贴的药品说明书文本，支持【标题】内容、标题：内容、编号标题和 Markdown 标题等格式，生成标准 drug.md 预览或正式药物文件。",
  inputSchema: {
    saveMode: ["preview", "publish"],
    basic: "药物基础信息与分类",
    forms: "剂型、规格和给药途径列表",
    label_text: "说明书全文文本",
    source: "说明书来源",
  },
  async import(input, context) {
    const genericCn = input.basic?.generic_cn?.trim();
    if (!genericCn) throw new Error("basic.generic_cn 不能为空");
    if (!input.label_text?.trim())
      throw new Error("label_text 不能为空，请粘贴药品说明书文本。");

    const id = input.basic?.id?.trim() || `drug-${slugify(genericCn)}`;
    const sourceType = input.source?.source_type || "package_insert";
    const label = extractSections(input.label_text || "");
    const extracted = nonEmptyKeys(label);

    return {
      frontmatter: {
        id,
        type: "drug",
        status: "draft",
        names: {
          generic_cn: genericCn,
          generic_en: input.basic.generic_en?.trim() || undefined,
          brand_names: input.basic.brand_names || [],
          aliases: input.basic.aliases || [],
        },
        classification: {
          system: input.basic.system,
          primary_category: input.basic.primary_category,
          secondary_category: input.basic.secondary_category,
          pharmacologic_class: input.basic.pharmacologic_class,
          prescription_type: input.basic.prescription_type,
        },
        forms: input.forms || [],
        risk_tags: input.risk_tags || [],
        sources: [
          {
            source_id: `source-${id}-${Date.now()}`,
            source_type: sourceType,
            title: input.source?.title || `${genericCn}说明书`,
            url: input.source?.url,
            file_path: input.source?.file_path,
            imported_at: context.now,
            imported_by: context.actor,
            revision_date: input.source?.revision_date || label.revision_date,
          },
        ],
        review: {
          review_status: "draft",
          lifecycle: "inactive",
          created_by: context.actor,
          updated_at: context.now.slice(0, 10),
          version: 1,
        },
      },
      label,
      notes: [
        `说明书解析完成，已抽取 ${extracted.length} 个字段。`,
        extracted.length > 0
          ? `已抽取字段：${extracted.join("、")}`
          : "未识别到结构化标题，请检查说明书文本是否包含【适应症】【用法用量】等标题。",
        "请由药师逐项校对，尤其是用法用量、禁忌、特殊人群和相互作用。",
      ],
    };
  },
};
