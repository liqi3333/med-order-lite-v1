import type { LLMProvider } from "./types.js";
import type { DrugIndexItem } from "../drug-kb/types.js";

const SEARCH_SYSTEM_PROMPT = `你是一个药品搜索助手。用户会用自然语言描述他们想找的药品，你需要将自然语言转换为结构化的搜索参数。

你必须输出 JSON 格式：
{
  "q": "关键词（用于文本匹配，可以是药名、症状、适应症关键词等）",
  "system": "药物体系（可选）",
  "primaryCategory": "一级分类（可选）",
  "secondaryCategory": "二级分类（可选）",
  "route": "给药途径（可选）",
  "dosageForm": "剂型（可选）",
  "explanation": "你对用户意图的理解说明"
}

药物体系(system)可选值：
- western_medicine (西药/化学药物)
- biologics (生物制品)
- chinese_patent_medicine (中成药)
- traditional_chinese_medicine_decoction_pieces (中药饮片)
- medical_nutrition_and_solutions (医用营养及溶液)
- diagnostic_agents (诊断用药物)

一级分类(primaryCategory)可选值：
anti_infective (抗感染), antiparasitic (抗寄生虫), cardiovascular (心血管), blood_and_coagulation (血液及造血), digestive_and_metabolism (消化及代谢), respiratory (呼吸系统), nervous_system_and_psychiatry (神经系统及精神), endocrine_and_metabolism (内分泌及代谢), musculoskeletal_and_anti_inflammatory (肌肉骨骼及抗炎), genitourinary_and_sex_hormones (泌尿生殖及性激素), dermatological (皮肤), sensory_organs (感觉器官), antineoplastic_and_immunomodulating (抗肿瘤及免疫调节), anesthesia_and_perioperative (麻醉及围手术期), emergency_and_critical_care (急救及重症), nutrition_electrolytes_and_vitamins (营养电解质维生素), diagnostic_and_contrast_agents (诊断及造影剂)

给药途径(route)可选值：oral (口服), intravenous (静脉), intramuscular (肌肉), subcutaneous (皮下), topical (外用), ophthalmic (眼用), otic (耳用), nasal (鼻用), inhalation (吸入), rectal (直肠), vaginal (阴道)

剂型(dosageForm)可选值：tablet (片剂), capsule (胶囊), granule (颗粒), powder (粉), oral_solution (口服液), syrup (糖浆), injection (注射), infusion (输液), cream (乳膏), ointment (软膏), gel (凝胶), patch (贴剂), eye_drop (滴眼), ear_drop (滴耳), nasal_spray (鼻喷), inhalation (吸入), suppository (栓剂)

规则：
1. 理解用户的搜索意图，转换为最匹配的搜索参数
2. q 字段用于文本匹配，应该包含最相关的关键词（药名、适应症中的具体疾病名称等）
3. 优先使用 primaryCategory 分类字段来缩小范围，这比 q 更可靠
4. 常见症状到分类的映射：
   - 发热/发烧/感染 → primaryCategory=anti_infective（抗感染）
   - 咳嗽/哮喘/呼吸道 → primaryCategory=respiratory（呼吸系统）
   - 腹泻/胃痛/消化 → primaryCategory=digestive_and_metabolism（消化及代谢）
   - 高血压/心脏病 → primaryCategory=cardiovascular（心血管）
   - 骨质疏松/骨折/关节 → primaryCategory=musculoskeletal_and_anti_inflammatory（肌肉骨骼及抗炎）
   - 糖尿病/甲亢 → primaryCategory=endocrine_and_metabolism（内分泌及代谢）
   - 肿瘤/癌症 → primaryCategory=antineoplastic_and_immunomodulating（抗肿瘤及免疫调节）
5. 如果用户描述不明确，只填写你能确定的字段
6. explanation 用中文简要说明你的理解
7. 只输出 JSON，不要包含其他文本`;

interface AISearchResult {
  q?: string;
  system?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  route?: string;
  dosageForm?: string;
  explanation: string;
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

export async function aiSearchDrugs(
  query: string,
  provider: LLMProvider,
  drugIndex: DrugIndexItem[],
): Promise<{
  params: AISearchResult;
  results: DrugIndexItem[];
  explanation: string;
}> {
  const indexSummary = drugIndex.map((d) =>
    `${d.id}|${d.generic_cn}|${d.generic_en || ""}|${d.system}|${d.primary_category}|${d.secondary_category || ""}|${d.dosage_forms.join(",")}|${d.routes.join(",")}|${(d.searchable_text || "").slice(0, 200)}`
  ).join("\n");

  const response = await provider.chat({
    system: SEARCH_SYSTEM_PROMPT,
    user: `用户搜索：${query}\n\n当前药物库索引（${drugIndex.length} 条）：\n${indexSummary}`,
    json: true,
  });

  const parsed = safeParseJSON(response);

  const params: AISearchResult = {
    q: parsed.q ? String(parsed.q) : undefined,
    system: parsed.system ? String(parsed.system) : undefined,
    primaryCategory: parsed.primaryCategory ? String(parsed.primaryCategory) : undefined,
    secondaryCategory: parsed.secondaryCategory ? String(parsed.secondaryCategory) : undefined,
    route: parsed.route ? String(parsed.route) : undefined,
    dosageForm: parsed.dosageForm ? String(parsed.dosageForm) : undefined,
    explanation: String(parsed.explanation || ""),
  };

  // Filter drug index based on AI-generated params
  const q = params.q?.toLowerCase() || "";
  const hasCategoryFilter = !!(params.system || params.primaryCategory || params.secondaryCategory || params.route || params.dosageForm);
  const results = drugIndex.filter((item) => {
    if (item.review_status !== "approved") return false;
    // Text match: check q against searchable_text, id, generic_cn
    const textMatch = q && (item.searchable_text.includes(q) || item.id.toLowerCase().includes(q) || item.generic_cn.toLowerCase().includes(q));
    // If only q provided (no category filters), require text match
    if (!hasCategoryFilter && q && !textMatch) return false;
    // If category filters present but no text match, still include (category filter is primary)
    if (params.system && item.system !== params.system) return false;
    if (params.primaryCategory && item.primary_category !== params.primaryCategory) return false;
    if (params.secondaryCategory && item.secondary_category !== params.secondaryCategory) return false;
    if (params.route && !item.routes.includes(params.route)) return false;
    if (params.dosageForm && !item.dosage_forms.includes(params.dosageForm)) return false;
    return true;
  });

  return { params, results, explanation: params.explanation };
}
