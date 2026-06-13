import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DrugValidator } from "./drug-validator.js";
import { TaxonomyService } from "../taxonomy/taxonomy.service.js";
import type { DrugDocument, DrugFrontmatter, DrugLabelSections } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbRoot = path.resolve(__dirname, "../../../kb");

function buildFrontmatter(overrides: Partial<DrugFrontmatter> = {}): DrugFrontmatter {
  return {
    id: "drug-test",
    type: "drug",
    names: { generic_cn: "测试药物" },
    classification: { system: "western_medicine", primary_category: "anti_infective", secondary_category: "penicillins" },
    forms: [{ dosage_form: "tablet", route: "oral" }],
    risk_tags: [],
    sources: [{ source_id: "src-1", source_type: "package_insert", imported_at: "2026-01-01" }],
    review: { review_status: "approved", lifecycle: "active", updated_at: "2026-01-01", version: 1 },
    ...overrides,
  };
}

function buildDoc(fm?: Partial<DrugFrontmatter>, label?: Partial<DrugLabelSections>): DrugDocument {
  return {
    frontmatter: buildFrontmatter(fm),
    label: {
      indications: "治疗感冒",
      dosage: "每日一次",
      contraindications: "对本品过敏者禁用",
      precautions: "慎用",
      ...label,
    },
    rawMarkdown: "",
  };
}

const taxonomyService = new TaxonomyService(kbRoot);
const validator = new DrugValidator(taxonomyService);

describe("DrugValidator", () => {
  describe("required fields", () => {
    it("passes for a valid document", async () => {
      const result = await validator.validate(buildDoc());
      assert.equal(result.ok, true);
      assert.equal(result.errors.length, 0);
    });

    it("errors on missing id", async () => {
      const result = await validator.validate(buildDoc({ id: "" }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "missing_id"));
    });

    it("errors on invalid type", async () => {
      const result = await validator.validate(buildDoc({ type: "disease" as never }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "invalid_type"));
    });

    it("errors on missing generic_cn", async () => {
      const result = await validator.validate(buildDoc({ names: { generic_cn: "" } }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "missing_generic_cn"));
    });

    it("errors on empty forms", async () => {
      const result = await validator.validate(buildDoc({ forms: [] }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "missing_forms"));
    });

    it("errors on missing review_status", async () => {
      const doc = buildDoc();
      (doc.frontmatter.review as Record<string, unknown>).review_status = "";
      const result = await validator.validate(doc);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "missing_review"));
    });
  });

  describe("taxonomy validation", () => {
    it("errors on invalid system", async () => {
      const result = await validator.validate(buildDoc({
        classification: { system: "nonexistent_system", primary_category: "anti_infective" },
      }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "invalid_system"));
    });

    it("errors on invalid primary_category", async () => {
      const result = await validator.validate(buildDoc({
        classification: { system: "western_medicine", primary_category: "nonexistent_category" },
      }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "invalid_primary_category"));
    });

    it("errors on invalid dosage_form", async () => {
      const result = await validator.validate(buildDoc({
        forms: [{ dosage_form: "nonexistent_form", route: "oral" }],
      }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "invalid_dosage_form"));
    });

    it("errors on invalid route", async () => {
      const result = await validator.validate(buildDoc({
        forms: [{ dosage_form: "tablet", route: "nonexistent_route" }],
      }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "invalid_route"));
    });

    it("errors on invalid risk_tag", async () => {
      const result = await validator.validate(buildDoc({ risk_tags: ["nonexistent_tag"] }));
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "invalid_risk_tag"));
    });

    it("accepts valid taxonomy values", async () => {
      const result = await validator.validate(buildDoc({
        classification: { system: "western_medicine", primary_category: "anti_infective", secondary_category: "penicillins" },
        forms: [{ dosage_form: "tablet", route: "oral" }],
        risk_tags: ["allergy_check_required"],
      }));
      assert.equal(result.ok, true);
    });
  });

  describe("warnings", () => {
    it("warns on empty indications", async () => {
      const result = await validator.validate(buildDoc({}, { indications: "" }));
      assert.ok(result.warnings.some((w) => w.code === "missing_indications"));
    });

    it("warns on empty contraindications", async () => {
      const result = await validator.validate(buildDoc({}, { contraindications: "" }));
      assert.ok(result.warnings.some((w) => w.code === "missing_contraindications"));
    });

    it("warns on empty precautions", async () => {
      const result = await validator.validate(buildDoc({}, { precautions: "" }));
      assert.ok(result.warnings.some((w) => w.code === "missing_precautions"));
    });
  });

  describe("publish mode", () => {
    it("errors on empty dosage in publish mode", async () => {
      const result = await validator.validate(buildDoc({}, { dosage: "" }), "publish");
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "missing_dosage"));
    });

    it("errors on empty sources in publish mode", async () => {
      const result = await validator.validate(buildDoc({ sources: [] }), "publish");
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "missing_sources"));
    });

    it("errors on non-approved status in publish mode", async () => {
      const result = await validator.validate(buildDoc({
        review: { review_status: "draft", lifecycle: "active", updated_at: "2026-01-01", version: 1 },
      }), "publish");
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "not_approved"));
    });

    it("warns on empty dosage in draft mode", async () => {
      const result = await validator.validate(buildDoc({}, { dosage: "" }), "draft");
      assert.ok(result.warnings.some((w) => w.code === "missing_dosage"));
      assert.ok(result.ok);
    });
  });
});
