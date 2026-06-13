import { TaxonomyService } from "../taxonomy/taxonomy.service.js";
import { DrugDocument, ValidationIssue, ValidationResult } from "./types.js";

function issue(level: "error" | "warning", code: string, message: string, field?: string): ValidationIssue {
  return { level, code, message, field };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export class DrugValidator {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  async validate(document: DrugDocument, mode: "draft" | "publish" = "draft"): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const fm = document.frontmatter;
    const label = document.label;

    if (isBlank(fm.id)) errors.push(issue("error", "missing_id", "药物 id 不能为空。", "id"));
    if (fm.type !== "drug") errors.push(issue("error", "invalid_type", "type 必须为 drug。", "type"));
    if (!fm.names || isBlank(fm.names.generic_cn)) errors.push(issue("error", "missing_generic_cn", "中文通用名不能为空。", "names.generic_cn"));
    if (!fm.classification) errors.push(issue("error", "missing_classification", "药物分类不能为空。", "classification"));
    if (!Array.isArray(fm.forms) || fm.forms.length === 0) errors.push(issue("error", "missing_forms", "至少需要录入一个剂型/规格/给药途径。", "forms"));
    if (!fm.review || !fm.review.review_status) errors.push(issue("error", "missing_review", "审核状态不能为空。", "review.review_status"));

    if (fm.classification) {
      const { system, primary_category, secondary_category, prescription_type } = fm.classification;
      if (!(await this.taxonomyService.isValidSystem(system))) {
        errors.push(issue("error", "invalid_system", `药物体系不存在：${system}`, "classification.system"));
      }
      if (!(await this.taxonomyService.isValidCategory(system, primary_category))) {
        errors.push(issue("error", "invalid_primary_category", `一级分类不存在或不属于该体系：${primary_category}`, "classification.primary_category"));
      }
      if (!(await this.taxonomyService.isValidSecondaryCategory(primary_category, secondary_category))) {
        errors.push(issue("error", "invalid_secondary_category", `二级分类不存在或不属于该一级分类：${secondary_category}`, "classification.secondary_category"));
      }
      if (prescription_type && !(await this.taxonomyService.isValidOption("prescription-types", prescription_type))) {
        errors.push(issue("error", "invalid_prescription_type", `处方属性不存在：${prescription_type}`, "classification.prescription_type"));
      }
    }

    for (const [index, form] of (fm.forms || []).entries()) {
      if (isBlank(form.dosage_form)) errors.push(issue("error", "missing_dosage_form", `第 ${index + 1} 个剂型不能为空。`, `forms.${index}.dosage_form`));
      if (isBlank(form.route)) errors.push(issue("error", "missing_route", `第 ${index + 1} 个给药途径不能为空。`, `forms.${index}.route`));
      if (form.dosage_form && !(await this.taxonomyService.isValidOption("dosage-forms", form.dosage_form))) {
        errors.push(issue("error", "invalid_dosage_form", `剂型不存在：${form.dosage_form}`, `forms.${index}.dosage_form`));
      }
      if (form.route && !(await this.taxonomyService.isValidOption("routes", form.route))) {
        errors.push(issue("error", "invalid_route", `给药途径不存在：${form.route}`, `forms.${index}.route`));
      }
    }

    for (const riskTag of fm.risk_tags || []) {
      if (!(await this.taxonomyService.isValidOption("risk-tags", riskTag))) {
        errors.push(issue("error", "invalid_risk_tag", `风险标签不存在：${riskTag}`, "risk_tags"));
      }
    }

    if (isBlank(label.indications)) warnings.push(issue("warning", "missing_indications", "适应症为空，查询和医嘱生成的可用性会降低。", "label.indications"));
    if (isBlank(label.contraindications)) warnings.push(issue("warning", "missing_contraindications", "禁忌为空，发布前建议药师补充或确认“无明确禁忌”。", "label.contraindications"));
    if (isBlank(label.precautions)) warnings.push(issue("warning", "missing_precautions", "注意事项为空，发布前建议补充。", "label.precautions"));

    if (mode === "publish") {
      if (isBlank(label.dosage)) errors.push(issue("error", "missing_dosage", "发布前必须填写用法用量。", "label.dosage"));
      if (!Array.isArray(fm.sources) || fm.sources.length === 0) errors.push(issue("error", "missing_sources", "发布前必须填写来源。", "sources"));
      if (fm.review.review_status !== "approved") errors.push(issue("error", "not_approved", "只有 approved 状态可以发布到正式药物库。", "review.review_status"));
    } else if (isBlank(label.dosage)) {
      warnings.push(issue("warning", "missing_dosage", "用法用量为空，目前只能保存草稿，不能发布。", "label.dosage"));
    }

    return { ok: errors.length === 0, errors, warnings };
  }
}
