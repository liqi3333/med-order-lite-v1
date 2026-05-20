import { createAppContext } from "../src/core/app-context.js";

const ctx = createAppContext();
await ctx.drugRepository.buildIndex(false);
const drugs = await ctx.drugRepository.query({ includeDrafts: false });
if (!drugs.length) throw new Error("drugs not indexed");
const order = await ctx.orderGeneratorService.generateFromDrugLabel({ drugId: drugs[0].id, diagnosis: "原型测试用途", scenario: "outpatient", patientContext: { allergies: ["原型测试过敏史"], renalFunction: "unknown" } });
const importResult = await ctx.drugEntryService.importWithPlugin("label-text", {
  saveMode: "preview",
  actor: "smoke-test",
  basic: { generic_cn: "示例测试药物", generic_en: "Example Test Drug", system: "western_medicine", primary_category: "anti_infective", secondary_category: "other_antibacterials", pharmacologic_class: "示例分类", prescription_type: "prescription" },
  forms: [{ dosage_form: "tablet", strength: "示例规格", route: "oral" }],
  risk_tags: ["allergy_check_required"],
  source: { title: "示例测试药物说明书", source_type: "manual_entry" },
  label_text: "【适应症】\n用于原型测试的虚拟适应症。\n【用法用量】\n仅为原型测试文本，真实临床不可使用。\n【禁忌】\n对本品过敏者禁用。\n【注意事项】\n请医生确认。"
});
if (!importResult.validation.ok) throw new Error(JSON.stringify(importResult.validation));
console.log(JSON.stringify({ ok: true, drugs: drugs.length, orderTemplate: order.templateText.split("\n").slice(0, 4), pluginImport: importResult.drugId }, null, 2));
