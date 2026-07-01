import type { LLMProvider, AIParsedDrugData } from "./types.js";

const LABEL_PARSE_SYSTEM_PROMPT = `你是一个专业的药品说明书结构化提取助手。你的任务是从药品说明书中提取标准化的结构化信息。

请输出 JSON 格式，包含以下字段：

{
  "names": {
    "generic_cn": "中文通用名（必填）",
    "generic_en": "英文通用名",
    "brand_names": ["商品名列表"],
    "aliases": ["别名列表"]
  },
  "classification": {
    "system": "药物体系（见下方选项）",
    "primary_category": "一级分类（见下方选项）",
    "secondary_category": "二级分类（见下方选项）",
    "pharmacologic_class": "药理学分类",
    "prescription_type": "处方类型",
    "atc_code": "ATC代码"
  },
  "forms": [{
    "dosage_form": "剂型（见下方选项）",
    "strength": "规格",
    "route": "给药途径（见下方选项）",
    "package_unit": "包装单位",
    "manufacturer": "生产厂家",
    "approval_number": "批准文号"
  }],
  "risk_tags": ["风险标签列表"],
  "label": {
    "composition": "成份",
    "character": "性状",
    "indications": "适应症",
    "dosage": "用法用量",
    "contraindications": "禁忌",
    "precautions": "注意事项",
    "adverse_reactions": "不良反应",
    "interactions": "药物相互作用",
    "pharmacology_toxicology": "药理毒理",
    "pharmacokinetics": "药代动力学",
    "storage": "贮藏",
    "packaging": "包装",
    "validity": "有效期",
    "standard": "执行标准",
    "approval_number": "批准文号",
    "revision_date": "修订日期",
    "special_populations": {
      "pregnancy": "妊娠期用药",
      "lactation": "哺乳期用药",
      "pediatric": "儿童用药",
      "geriatric": "老年用药",
      "renal_impairment": "肾功能不全用药",
      "hepatic_impairment": "肝功能不全用药",
      "driving_or_machines": "驾车及操作机器"
    }
  },
  "confidence": 0.85,
  "warnings": ["无法确定的字段或疑点"]
}

药物体系(system)选项：
- western_medicine (化学药物/西药)
- biologics (生物制品)
- chinese_patent_medicine (中成药)
- traditional_chinese_medicine_decoction_pieces (中药饮片)
- medical_nutrition_and_solutions (医用营养及溶液)
- diagnostic_agents (诊断用药物)
- other (其他)

一级分类(primary_category)选项（按体系）：
western_medicine: anti_infective, antiparasitic, cardiovascular, blood_and_coagulation, digestive_and_metabolism, respiratory, nervous_system_and_psychiatry, endocrine_and_metabolism, musculoskeletal_and_anti_inflammatory, genitourinary_and_sex_hormones, dermatological, sensory_organs, antineoplastic_and_immunomodulating, anesthesia_and_perioperative, emergency_and_critical_care, nutrition_electrolytes_and_vitamins, diagnostic_and_contrast_agents

biologics: vaccines, blood_products, therapeutic_antibodies, cytokines_growth_factors, insulin

chinese_patent_medicine: respiratory, digestive, cardiovascular, musculoskeletal, gynecology, pediatrics, ent_dermatology, tonic, cp_other

剂型(dosage_form)选项：tablet, capsule, granule, powder, oral_solution, syrup, injection, infusion, cream, ointment, gel, patch, eye_drop, ear_drop, nasal_spray, inhalation, suppository, other

给药途径(route)选项：oral, intravenous, intramuscular, subcutaneous, topical, ophthalmic, otic, nasal, inhalation, rectal, vaginal, other

处方类型(prescription_type)选项：prescription, OTC-A, OTC-B, restricted, unknown

风险标签(risk_tags)选项：
- allergy_check_required (需过敏检查)
- renal_adjustment_required (需肾功能调整)
- hepatic_adjustment_required (需肝功能调整)
- pregnancy_check_required (需妊娠检查)
- interaction_check_required (需相互作用检查)
- high_alert (高危药品)
- antimicrobial (抗菌药物)
- narcotic (麻醉药品)
- psychotropic (精神药品)
- toxic_drug (毒性药品)
- cold_chain (需冷链)
- protect_from_light (需避光)

规则：
1. 如果说明书文本中明确包含某字段信息，直接提取
2. 如果说明书中未明确包含某字段，但可根据药品名称合理推断，在 warnings 中说明
3. confidence 基于提取完整度和确定性评分（0-1）
4. 保持原文内容完整性，不要过度概括
5. 特殊人群用药信息从说明书中相关段落提取，即使没有独立标题
6. 只输出 JSON，不要包含任何其他文本`;

function preprocessText(text: string): string {
  let cleaned = text.replace(/\r/g, "").replace(/\u00a0/g, " ");
  if (cleaned.length > 30000) {
    cleaned = cleaned.slice(0, 30000);
  }
  return cleaned.trim();
}

function safeParseJSON(text: string): Record<string, unknown> {
  let raw = text.trim();
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) raw = jsonMatch[1].trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    raw = raw.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

function normalizeClassification(input: Record<string, unknown>): {
  system: string;
  primary_category: string;
  secondary_category: string;
  pharmacologic_class: string;
  prescription_type: string;
  atc_code: string;
} {
  const systemMap: Record<string, string> = {
    western_medicine: "western_medicine",
    西药: "western_medicine",
    化学药物: "western_medicine",
    biologics: "biologics",
    生物制品: "biologics",
    chinese_patent_medicine: "chinese_patent_medicine",
    中成药: "chinese_patent_medicine",
    tcm_decoction: "traditional_chinese_medicine_decoction_pieces",
    中药饮片: "traditional_chinese_medicine_decoction_pieces",
    nutrition: "medical_nutrition_and_solutions",
    营养: "medical_nutrition_and_solutions",
    diagnostic: "diagnostic_agents",
    诊断: "diagnostic_agents",
  };

  const system = String(input.system || "western_medicine");
  return {
    system: systemMap[system] || system,
    primary_category: String(input.primary_category || "other"),
    secondary_category: String(input.secondary_category || ""),
    pharmacologic_class: String(input.pharmacologic_class || ""),
    prescription_type: String(input.prescription_type || ""),
    atc_code: String(input.atc_code || ""),
  };
}

export async function parseWithAI(
  rawText: string,
  provider: LLMProvider,
): Promise<AIParsedDrugData> {
  const cleaned = preprocessText(rawText);

  const response = await provider.chat({
    system: LABEL_PARSE_SYSTEM_PROMPT,
    user: `请解析以下药品说明书：\n\n${cleaned}`,
    json: true,
  });

  const parsed = safeParseJSON(response);

  const names = (parsed.names || {}) as Record<string, unknown>;
  const classification = normalizeClassification(
    (parsed.classification || {}) as Record<string, unknown>,
  );
  const forms = Array.isArray(parsed.forms)
    ? (parsed.forms as Array<Record<string, unknown>>).map((f) => ({
        dosage_form: String(f.dosage_form || "other"),
        strength: f.strength ? String(f.strength) : undefined,
        route: String(f.route || "oral"),
        package_unit: f.package_unit ? String(f.package_unit) : undefined,
        manufacturer: f.manufacturer ? String(f.manufacturer) : undefined,
        approval_number: f.approval_number ? String(f.approval_number) : undefined,
      }))
    : [];
  const risk_tags = Array.isArray(parsed.risk_tags)
    ? (parsed.risk_tags as unknown[]).map(String)
    : [];
  const label = (parsed.label || {}) as Record<string, unknown>;
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
  const warnings = Array.isArray(parsed.warnings)
    ? (parsed.warnings as unknown[]).map(String)
    : [];

  return {
    names: {
      generic_cn: String(names.generic_cn || ""),
      generic_en: names.generic_en ? String(names.generic_en) : undefined,
      brand_names: Array.isArray(names.brand_names)
        ? (names.brand_names as unknown[]).map(String)
        : undefined,
      aliases: Array.isArray(names.aliases)
        ? (names.aliases as unknown[]).map(String)
        : undefined,
    },
    classification,
    forms,
    risk_tags,
    label: {
      composition: label.composition ? String(label.composition) : undefined,
      character: label.character ? String(label.character) : undefined,
      indications: label.indications ? String(label.indications) : undefined,
      dosage: label.dosage ? String(label.dosage) : undefined,
      contraindications: label.contraindications ? String(label.contraindications) : undefined,
      precautions: label.precautions ? String(label.precautions) : undefined,
      adverse_reactions: label.adverse_reactions ? String(label.adverse_reactions) : undefined,
      interactions: label.interactions ? String(label.interactions) : undefined,
      pharmacology_toxicology: label.pharmacology_toxicology ? String(label.pharmacology_toxicology) : undefined,
      pharmacokinetics: label.pharmacokinetics ? String(label.pharmacokinetics) : undefined,
      storage: label.storage ? String(label.storage) : undefined,
      packaging: label.packaging ? String(label.packaging) : undefined,
      validity: label.validity ? String(label.validity) : undefined,
      standard: label.standard ? String(label.standard) : undefined,
      approval_number: label.approval_number ? String(label.approval_number) : undefined,
      revision_date: label.revision_date ? String(label.revision_date) : undefined,
      special_populations: label.special_populations
        ? Object.fromEntries(
            Object.entries(label.special_populations as Record<string, unknown>).map(
              ([k, v]) => [k, v ? String(v) : ""],
            ),
          )
        : undefined,
    },
    confidence,
    warnings,
  };
}
