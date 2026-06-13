import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDrugMarkdown, stringifyDrugMarkdown, parseLabelSections, createEmptyLabelSections } from "./drug-md.js";
import type { DrugFrontmatter, DrugLabelSections } from "./types.js";

function buildFrontmatter(overrides: Partial<DrugFrontmatter> = {}): DrugFrontmatter {
  return {
    id: "drug-test",
    type: "drug",
    names: { generic_cn: "测试药物", generic_en: "Test Drug" },
    classification: { system: "western_medicine", primary_category: "anti_infective" },
    forms: [{ dosage_form: "tablet", route: "oral" }],
    risk_tags: [],
    sources: [],
    review: { review_status: "approved", lifecycle: "active", updated_at: "2026-01-01", version: 1 },
    ...overrides,
  };
}

function buildLabel(overrides: Partial<DrugLabelSections> = {}): DrugLabelSections {
  return {
    indications: "用于测试",
    dosage: "每日一次",
    contraindications: "对本品过敏者禁用",
    precautions: "慎用",
    ...overrides,
  };
}

function buildMarkdown(fm?: Partial<DrugFrontmatter>, label?: Partial<DrugLabelSections>): string {
  const frontmatter = buildFrontmatter(fm);
  const sections = buildLabel(label);
  return stringifyDrugMarkdown(frontmatter, sections);
}

describe("parseDrugMarkdown", () => {
  it("parses valid frontmatter and body", () => {
    const md = buildMarkdown({}, { indications: "治疗感冒", dosage: "口服一次1片" });
    const doc = parseDrugMarkdown(md);
    assert.equal(doc.frontmatter.id, "drug-test");
    assert.equal(doc.frontmatter.names.generic_cn, "测试药物");
    assert.equal(doc.label.indications, "治疗感冒");
    assert.equal(doc.label.dosage, "口服一次1片");
  });

  it("throws on missing frontmatter", () => {
    assert.throws(() => parseDrugMarkdown("# 没有 frontmatter\n\n一些内容"), /缺少 JSON frontmatter/);
  });

  it("throws on invalid JSON frontmatter", () => {
    const md = "---\n{invalid json}\n---\n\n# 内容";
    assert.throws(() => parseDrugMarkdown(md), /不是合法 JSON/);
  });

  it("throws on YAML-style frontmatter", () => {
    const md = "---\nid: drug-test\ntype: drug\n---\n\n# 内容";
    assert.throws(() => parseDrugMarkdown(md), /不是合法 JSON/);
  });

  it("preserves rawMarkdown", () => {
    const md = buildMarkdown();
    const doc = parseDrugMarkdown(md);
    assert.equal(doc.rawMarkdown, md);
  });
});

describe("parseLabelSections", () => {
  it("extracts H2 sections", () => {
    const body = "## 适应症\n\n治疗感冒\n\n## 禁忌\n\n对本品过敏者禁用\n";
    const label = parseLabelSections(body);
    assert.equal(label.indications, "治疗感冒");
    assert.equal(label.contraindications, "对本品过敏者禁用");
  });

  it("extracts special population sub-sections", () => {
    const body = "## 特殊人群\n\n### 妊娠\n\n孕妇禁用\n\n### 哺乳\n\n暂停哺乳\n";
    const label = parseLabelSections(body);
    assert.equal(label.special_populations?.pregnancy, "孕妇禁用");
    assert.equal(label.special_populations?.lactation, "暂停哺乳");
  });

  it("ignores unknown H2 sections", () => {
    const body = "## 未知章节\n\n一些内容\n\n## 适应症\n\n治疗感冒\n";
    const label = parseLabelSections(body);
    assert.equal(label.indications, "治疗感冒");
  });

  it("handles empty sections", () => {
    const body = "## 适应症\n\n## 禁忌\n\n对本品过敏者禁用\n";
    const label = parseLabelSections(body);
    assert.equal(label.indications, "");
    assert.equal(label.contraindications, "对本品过敏者禁用");
  });

  it("extracts all standard sections", () => {
    const body = [
      "## 成分", "药物成分", "## 性状", "白色片剂",
      "## 适应症", "治疗感冒", "## 用法用量", "一次1片",
      "## 禁忌", "过敏者禁用", "## 注意事项", "慎用",
      "## 不良反应", "偶见皮疹", "## 药物相互作用", "不宜与X合用",
    ].join("\n\n");
    const label = parseLabelSections(body);
    assert.equal(label.composition, "药物成分");
    assert.equal(label.character, "白色片剂");
    assert.equal(label.indications, "治疗感冒");
    assert.equal(label.dosage, "一次1片");
    assert.equal(label.contraindications, "过敏者禁用");
    assert.equal(label.precautions, "慎用");
    assert.equal(label.adverse_reactions, "偶见皮疹");
    assert.equal(label.interactions, "不宜与X合用");
  });
});

describe("stringifyDrugMarkdown", () => {
  it("produces valid frontmatter delimited by ---", () => {
    const md = stringifyDrugMarkdown(buildFrontmatter(), buildLabel());
    assert.ok(md.startsWith("---\n"));
    const doc = parseDrugMarkdown(md);
    assert.equal(doc.frontmatter.id, "drug-test");
  });

  it("includes all section headings", () => {
    const md = stringifyDrugMarkdown(buildFrontmatter(), buildLabel());
    assert.ok(md.includes("## 适应症"));
    assert.ok(md.includes("## 用法用量"));
    assert.ok(md.includes("## 禁忌"));
    assert.ok(md.includes("## 注意事项"));
    assert.ok(md.includes("## 特殊人群"));
    assert.ok(md.includes("## 来源与审核"));
  });

  it("writes 待补充 for empty sections", () => {
    const md = stringifyDrugMarkdown(buildFrontmatter(), { indications: "" });
    assert.ok(md.includes("## 适应症\n\n待补充"));
  });

  it("includes special population sub-headings", () => {
    const md = stringifyDrugMarkdown(buildFrontmatter(), buildLabel());
    assert.ok(md.includes("### 妊娠"));
    assert.ok(md.includes("### 哺乳"));
    assert.ok(md.includes("### 儿童"));
    assert.ok(md.includes("### 老年"));
  });
});

describe("roundtrip", () => {
  it("parse → stringify → parse preserves data", () => {
    const fm = buildFrontmatter();
    const label = buildLabel({ special_populations: { pregnancy: "孕妇禁用", lactation: "暂停哺乳" } });
    const md1 = stringifyDrugMarkdown(fm, label);
    const doc = parseDrugMarkdown(md1);
    const md2 = stringifyDrugMarkdown(doc.frontmatter, doc.label);
    assert.equal(md2, md1);
  });
});

describe("createEmptyLabelSections", () => {
  it("returns all fields as empty strings", () => {
    const empty = createEmptyLabelSections();
    assert.equal(empty.indications, "");
    assert.equal(empty.dosage, "");
    assert.equal(empty.contraindications, "");
    assert.equal(empty.special_populations?.pregnancy, "");
    assert.equal(empty.special_populations?.lactation, "");
    assert.equal(empty.special_populations?.pediatric, "");
  });
});
