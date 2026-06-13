import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clip, firstNonBlank, selectPrimaryRoute, scenarioLabel, patientWarnings } from "./order-generator.service.js";
import { TaxonomyService } from "../taxonomy/taxonomy.service.js";
import type { DrugDocument, DrugFrontmatter } from "../drug-kb/types.js";
import type { OrderGenerationRequest } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbRoot = path.resolve(__dirname, "../../../kb");
const taxonomyService = new TaxonomyService(kbRoot);

function buildDoc(overrides: Partial<DrugFrontmatter> = {}): DrugDocument {
  return {
    frontmatter: {
      id: "drug-test",
      type: "drug",
      names: { generic_cn: "测试药物" },
      classification: { system: "western_medicine", primary_category: "anti_infective" },
      forms: [{ dosage_form: "tablet", route: "oral", strength: "500mg" }, { dosage_form: "injection", route: "intravenous" }],
      risk_tags: [],
      sources: [],
      review: { review_status: "approved", lifecycle: "active", updated_at: "2026-01-01", version: 1 },
      ...overrides,
    },
    label: {
      indications: "治疗感染",
      dosage: "每日三次",
      contraindications: "过敏者禁用",
      precautions: "慎用",
    },
    rawMarkdown: "",
  };
}

describe("clip", () => {
  it("returns empty string for undefined", () => {
    assert.equal(clip(undefined), "");
  });

  it("returns full text when under max", () => {
    assert.equal(clip("短文本", 100), "短文本");
  });

  it("truncates and adds ... when over max", () => {
    const long = "a".repeat(600);
    const result = clip(long, 500);
    assert.equal(result.length, 503);
    assert.ok(result.endsWith("..."));
  });

  it("uses default max of 500", () => {
    const long = "a".repeat(600);
    const result = clip(long);
    assert.equal(result.length, 503);
  });

  it("trims whitespace before checking length", () => {
    assert.equal(clip("  短文本  ", 100), "短文本");
  });
});

describe("firstNonBlank", () => {
  it("returns first non-blank value", () => {
    assert.equal(firstNonBlank("", "  ", "hello", "world"), "hello");
  });

  it("returns fallback when all blank", () => {
    assert.equal(firstNonBlank("", "  ", undefined), "请医生根据说明书和患者情况填写");
  });

  it("trims the result", () => {
    assert.equal(firstNonBlank("  hello  "), "hello");
  });
});

describe("selectPrimaryRoute", () => {
  it("returns Chinese label for first form's route", async () => {
    const doc = buildDoc();
    assert.equal(await selectPrimaryRoute(doc, taxonomyService), "口服");
  });

  it("returns fallback when forms is empty", async () => {
    const doc = buildDoc({ forms: [] });
    assert.equal(await selectPrimaryRoute(doc, taxonomyService), "请医生选择给药途径");
  });

  it("returns raw key when route not found in taxonomy", async () => {
    const doc = buildDoc({ forms: [{ dosage_form: "tablet", route: "unknown_route" }] });
    assert.equal(await selectPrimaryRoute(doc, taxonomyService), "unknown_route");
  });
});

describe("scenarioLabel", () => {
  it("maps known scenarios", () => {
    assert.equal(scenarioLabel("outpatient"), "门诊");
    assert.equal(scenarioLabel("inpatient_long_term"), "住院长期");
    assert.equal(scenarioLabel("inpatient_stat"), "住院临时");
    assert.equal(scenarioLabel("emergency"), "急诊");
  });

  it("defaults to 门诊 for undefined", () => {
    assert.equal(scenarioLabel(undefined), "门诊");
  });

  it("returns raw value for unknown scenario", () => {
    assert.equal(scenarioLabel("custom"), "custom");
  });
});

describe("patientWarnings", () => {
  it("returns empty warnings with no risk factors", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test" };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.equal(warnings.length, 0);
  });

  it("warns on allergy risk tag", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test" };
    const doc = buildDoc({ risk_tags: ["allergy_check_required"] });
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "过敏史"));
  });

  it("warns on patient allergies", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { allergies: ["青霉素"] } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "过敏史"));
  });

  it("warns on pregnancy risk tag", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test" };
    const doc = buildDoc({ risk_tags: ["pregnancy_check_required"] });
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "妊娠"));
  });

  it("warns on patient pregnancy", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { pregnancy: true } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "妊娠"));
  });

  it("warns on patient lactation", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { lactation: true } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "哺乳"));
  });

  it("warns on abnormal renal function", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { renalFunction: "轻度异常" } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "肾功能"));
  });

  it("does not warn on normal renal function", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { renalFunction: "正常" } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(!warnings.some((w) => w.source === "肾功能"));
  });

  it("warns on abnormal hepatic function", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { hepaticFunction: "中度异常" } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(warnings.some((w) => w.source === "肝功能"));
  });

  it("does not warn on normal hepatic function", () => {
    const request: OrderGenerationRequest = { drugId: "drug-test", patientContext: { hepaticFunction: "normal" } };
    const doc = buildDoc();
    const warnings = patientWarnings(request, doc);
    assert.ok(!warnings.some((w) => w.source === "肝功能"));
  });
});
