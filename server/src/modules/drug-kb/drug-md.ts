import { DrugDocument, DrugFrontmatter, DrugLabelSections } from "./types.js";

const sectionTitleByKey: Record<
  keyof Omit<DrugLabelSections, "special_populations">,
  string
> = {
  composition: "成分",
  character: "性状",
  indications: "适应症",
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
};

const specialPopulationTitles: Record<
  keyof NonNullable<DrugLabelSections["special_populations"]>,
  string
> = {
  pregnancy: "妊娠",
  lactation: "哺乳",
  pediatric: "儿童",
  geriatric: "老年",
  renal_impairment: "肾功能不全",
  hepatic_impairment: "肝功能不全",
  driving_or_machines: "驾驶与机械操作",
};

const keyBySectionTitle = Object.fromEntries(
  Object.entries(sectionTitleByKey).map(([key, title]) => [title, key]),
) as Record<string, keyof Omit<DrugLabelSections, "special_populations">>;

const specialKeyByTitle = Object.fromEntries(
  Object.entries(specialPopulationTitles).map(([key, title]) => [title, key]),
) as Record<
  string,
  keyof NonNullable<DrugLabelSections["special_populations"]>
>;

export function parseDrugMarkdown(markdown: string): DrugDocument {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match)
    throw new Error(
      "药物 Markdown 缺少 JSON frontmatter。请以 --- 包裹结构化数据。",
    );
  let frontmatter: DrugFrontmatter;
  try {
    frontmatter = JSON.parse(match[1]) as DrugFrontmatter;
  } catch (error) {
    throw new Error(`frontmatter 不是合法 JSON：${String(error)}`);
  }
  const body = markdown.slice(match[0].length);
  return {
    frontmatter,
    label: parseLabelSections(body),
    rawMarkdown: markdown,
  };
}

export function stringifyDrugMarkdown(
  frontmatter: DrugFrontmatter,
  label: DrugLabelSections,
): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(JSON.stringify(frontmatter, null, 2));
  lines.push("---");
  lines.push("");
  lines.push(`# ${frontmatter.names.generic_cn}`);
  lines.push("");
  lines.push(
    "> 本文件为药物知识库源文件。候选医嘱需由医生结合患者情况最终确认。AI 或系统生成内容不得直接替代临床判断。",
  );
  lines.push("");

  for (const [key, title] of Object.entries(sectionTitleByKey)) {
    const value =
      label[key as keyof Omit<DrugLabelSections, "special_populations">];
    lines.push(`## ${title}`);
    lines.push("");
    lines.push(value?.trim() || "待补充");
    lines.push("");
  }

  lines.push("## 特殊人群");
  lines.push("");
  const special = label.special_populations || {};
  for (const [key, title] of Object.entries(specialPopulationTitles)) {
    const value =
      special[
        key as keyof NonNullable<DrugLabelSections["special_populations"]>
      ];
    lines.push(`### ${title}`);
    lines.push("");
    lines.push(value?.trim() || "待补充");
    lines.push("");
  }

  lines.push("## 来源与审核");
  lines.push("");
  if (frontmatter.sources.length === 0) {
    lines.push("- 来源：待补充");
  } else {
    for (const source of frontmatter.sources) {
      lines.push(
        `- ${source.source_type}：${source.title || source.source_id}${source.url ? ` (${source.url})` : ""}`,
      );
    }
  }
  lines.push("");
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

export function parseLabelSections(body: string): DrugLabelSections {
  const label: DrugLabelSections = { special_populations: {} };
  const lines = body.split(/\r?\n/);
  let currentKey: keyof DrugLabelSections | null = null;
  let currentSpecialKey:
    | keyof NonNullable<DrugLabelSections["special_populations"]>
    | null = null;
  let buffer: string[] = [];

  function flush(): void {
    const text = buffer.join("\n").trim();
    if (currentSpecialKey) {
      label.special_populations = label.special_populations || {};
      label.special_populations[currentSpecialKey] = text;
    } else if (currentKey && currentKey !== "special_populations") {
      (label as Record<string, unknown>)[currentKey] = text;
    }
    buffer = [];
  }

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)\s*$/);
    const h3 = line.match(/^###\s+(.+)\s*$/);
    if (h2) {
      flush();
      const title = h2[1].trim();
      currentSpecialKey = null;
      currentKey =
        title === "特殊人群"
          ? "special_populations"
          : keyBySectionTitle[title] || null;
      continue;
    }
    if (h3 && currentKey === "special_populations") {
      flush();
      currentSpecialKey = specialKeyByTitle[h3[1].trim()] || null;
      continue;
    }
    if (currentKey || currentSpecialKey) buffer.push(line);
  }
  flush();
  return label;
}

export function createEmptyLabelSections(): DrugLabelSections {
  return {
    composition: "",
    character: "",
    indications: "",
    dosage: "",
    contraindications: "",
    precautions: "",
    adverse_reactions: "",
    interactions: "",
    pharmacology_toxicology: "",
    pharmacokinetics: "",
    storage: "",
    packaging: "",
    validity: "",
    standard: "",
    approval_number: "",
    revision_date: "",
    special_populations: {
      pregnancy: "",
      lactation: "",
      pediatric: "",
      geriatric: "",
      renal_impairment: "",
      hepatic_impairment: "",
      driving_or_machines: "",
    },
  };
}
