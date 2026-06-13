import { DrugRepository } from "../drug-kb/drug-repository.js";
import { DrugDocument } from "../drug-kb/types.js";
import { TaxonomyService } from "../taxonomy/taxonomy.service.js";
import { CandidateOrderTemplate, OrderGenerationRequest } from "./types.js";

export function firstNonBlank(...values: Array<string | undefined>): string {
  return (
    values.find((value) => value && value.trim())?.trim() ||
    "请医生根据说明书和患者情况填写"
  );
}
export function clip(text: string | undefined, max = 500): string {
  const value = text?.trim() || "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}
export async function selectPrimaryRoute(document: DrugDocument, taxonomyService: TaxonomyService): Promise<string> {
  const routeKey = document.frontmatter.forms[0]?.route;
  if (!routeKey) return "请医生选择给药途径";
  const routes = await taxonomyService.getOptions("routes");
  const option = routes.find((r) => r.value === routeKey);
  return option?.label || routeKey;
}
export function scenarioLabel(value: string | undefined): string {
  const map: Record<string, string> = {
    outpatient: "门诊",
    inpatient_long_term: "住院长期",
    inpatient_stat: "住院临时",
    emergency: "急诊",
  };
  return map[value || ""] || value || "门诊";
}
export function patientWarnings(
  request: OrderGenerationRequest,
  document: DrugDocument,
): CandidateOrderTemplate["warnings"] {
  const warnings: CandidateOrderTemplate["warnings"] = [];
  const ctx = request.patientContext || {};
  const risks = document.frontmatter.risk_tags || [];
  if (
    (ctx.allergies || []).length > 0 ||
    risks.includes("allergy_check_required")
  )
    warnings.push({
      level: "warning",
      source: "过敏史",
      message: "请核对患者过敏史与药物成分/类别。",
    });
  if (ctx.pregnancy || risks.includes("pregnancy_check_required"))
    warnings.push({
      level: "warning",
      source: "妊娠",
      message: "请核对妊娠相关用药安全信息。",
    });
  if (ctx.lactation)
    warnings.push({
      level: "warning",
      source: "哺乳",
      message: "请核对哺乳期用药安全信息。",
    });
  if (
    ctx.renalFunction &&
    ctx.renalFunction !== "正常" &&
    ctx.renalFunction !== "normal"
  )
    warnings.push({
      level: "warning",
      source: "肾功能",
      message: "请核对肾功能异常时是否需要调整剂量或禁用。",
    });
  if (
    ctx.hepaticFunction &&
    ctx.hepaticFunction !== "正常" &&
    ctx.hepaticFunction !== "normal"
  )
    warnings.push({
      level: "warning",
      source: "肝功能",
      message: "请核对肝功能异常时是否需要调整剂量或禁用。",
    });
  return warnings;
}

export class OrderGeneratorService {
  constructor(
    private readonly drugRepository: DrugRepository,
    private readonly taxonomyService: TaxonomyService,
  ) {}

  async generateFromDrugLabel(
    request: OrderGenerationRequest,
  ): Promise<CandidateOrderTemplate> {
    const document = await this.drugRepository.readById(request.drugId);
    if (!document) throw new Error(`未找到药物：${request.drugId}`);
    const drugName = document.frontmatter.names.generic_cn;
    const diagnosis = request.diagnosis || "请填写诊断/用途";
    const route = await selectPrimaryRoute(document, this.taxonomyService);
    const form = document.frontmatter.forms[0];
    const medicationLine = [drugName, form?.strength].filter(Boolean).join(" ");
    const structured = {
      medication_name: medicationLine || drugName,
      dosage: firstNonBlank(document.label.dosage),
      route: firstNonBlank(route),
      duration: "请医生填写疗程",
      instructions: [
        `诊断/用途：${diagnosis}`,
        `适应症依据：${clip(document.label.indications, 240) || "说明书未提供结构化适应症。"}`,
        `用法用量依据：${clip(document.label.dosage, 300) || "说明书未提供结构化用法用量。"}`,
        "请医生结合患者情况、医院药品目录和最新说明书确认。",
      ].join("\n"),
    };
    const simplified = {
      medication_name: drugName,
      dose: "请医生填写剂量",
      specification: firstNonBlank(form?.strength, "请医生填写规格"),
      route: firstNonBlank(route),
      dosage_instructions: firstNonBlank(document.label.dosage),
    };
    const simplifiedTemplateText = [
      `药品：${simplified.medication_name}`,
      `剂量：${simplified.dose}`,
      `规格：${simplified.specification}`,
      `途径：${simplified.route}`,
      `用法用量：${simplified.dosage_instructions}`,
    ].join("\n");

    const warnings: CandidateOrderTemplate["warnings"] = [
      ...patientWarnings(request, document),
      ...(document.label.contraindications
        ? [
            {
              level: "warning" as const,
              message: `请核对禁忌：${clip(document.label.contraindications, 180)}`,
              source: "禁忌",
            },
          ]
        : []),
      ...(document.label.precautions
        ? [
            {
              level: "info" as const,
              message: `注意事项摘要：${clip(document.label.precautions, 180)}`,
              source: "注意事项",
            },
          ]
        : []),
      ...(document.label.interactions
        ? [
            {
              level: "info" as const,
              message: `相互作用摘要：${clip(document.label.interactions, 180)}`,
              source: "药物相互作用",
            },
          ]
        : []),
    ];

    return {
      drugId: document.frontmatter.id,
      drugName,
      diagnosis,
      scenario: request.scenario || "outpatient",
      structured,
      simplified,
      simplifiedTemplateText,
      templateText: [
        `场景：${scenarioLabel(request.scenario)}`,
        `诊断/用途：${diagnosis}`,
        `药品：${structured.medication_name}`,
        `剂量：${structured.dosage}`,
        `途径：${structured.route}`,
        `疗程：${structured.duration}`,
        `备注：${structured.instructions}`,
        "确认：以上为候选医嘱模板，需医生结合患者情况、医院药品目录和最新说明书确认。",
      ].join("\n"),
      sourceSections: [
        { section: "适应症", text: clip(document.label.indications, 500) },
        { section: "用法用量", text: clip(document.label.dosage, 800) },
        { section: "禁忌", text: clip(document.label.contraindications, 500) },
        { section: "注意事项", text: clip(document.label.precautions, 500) },
        {
          section: "药物相互作用",
          text: clip(document.label.interactions, 500),
        },
      ].filter((item) => item.text),
      warnings,
      requiresPhysicianConfirmation: true,
      disclaimer:
        "本接口仅根据药物说明书结构化字段生成候选医嘱模板，不构成自动处方或临床诊疗建议。",
    };
  }
}
