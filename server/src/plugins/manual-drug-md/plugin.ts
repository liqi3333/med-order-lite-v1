import { DrugImportPlugin, ManualDrugInput } from "../../modules/drug-entry-plugin/types.js";

export const manualDrugMdPlugin: DrugImportPlugin<ManualDrugInput> = {
  id: "manual-drug-md",
  name: "手工结构化药物录入",
  description: "接收完整结构化 JSON，生成标准 drug.md 预览文件或正式药物文件。适合药师通过录入表单提交。",
  inputSchema: {
    saveMode: ["preview", "publish"],
    frontmatter: "DrugFrontmatter",
    label: "DrugLabelSections"
  },
  async import(input, context) {
    const frontmatter = input.frontmatter;
    const label = input.label;
    frontmatter.type = "drug";
    frontmatter.review = {
      review_status: frontmatter.review?.review_status || "draft",
      lifecycle: frontmatter.review?.lifecycle || "inactive",
      created_by: frontmatter.review?.created_by || context.actor,
      reviewed_by: frontmatter.review?.reviewed_by,
      reviewed_at: frontmatter.review?.reviewed_at,
      updated_at: context.now.slice(0, 10),
      version: frontmatter.review?.version || 1
    };
    frontmatter.sources = frontmatter.sources || [];
    frontmatter.risk_tags = frontmatter.risk_tags || [];
    return {
      frontmatter,
      label,
      notes: ["已通过手工结构化药物录入插件生成 drug.md。"]
    };
  }
};
