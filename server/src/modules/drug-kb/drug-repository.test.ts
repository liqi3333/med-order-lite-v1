import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DrugRepository } from "./drug-repository.js";
import type { DrugDocument, DrugFrontmatter, DrugLabelSections } from "./types.js";

const repo = new DrugRepository("/tmp/fake-kb");

function buildDoc(
  fm?: Partial<DrugFrontmatter>,
  label?: Partial<DrugLabelSections>,
  filePath?: string,
): DrugDocument {
  return {
    frontmatter: {
      id: "drug-test",
      type: "drug",
      names: { generic_cn: "测试药物", generic_en: "Test Drug", brand_names: ["品牌A"], aliases: ["别名X"] },
      classification: { system: "western_medicine", primary_category: "anti_infective", pharmacologic_class: "penicillin" },
      forms: [{ dosage_form: "tablet", route: "oral" }, { dosage_form: "injection", route: "intravenous" }],
      risk_tags: ["allergy_check_required"],
      sources: [],
      review: { review_status: "approved", lifecycle: "active", updated_at: "2026-01-01", version: 1 },
      ...fm,
    },
    label: {
      indications: "治疗感染",
      dosage: "每日三次",
      contraindications: "过敏者禁用",
      precautions: "肝肾功能不全者慎用",
      ...label,
    },
    rawMarkdown: "",
    filePath,
  };
}

describe("toIndexItem", () => {
  it("includes all required fields", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.equal(item.id, "drug-test");
    assert.equal(item.generic_cn, "测试药物");
    assert.equal(item.generic_en, "Test Drug");
    assert.deepEqual(item.brand_names, ["品牌A"]);
    assert.deepEqual(item.aliases, ["别名X"]);
    assert.equal(item.system, "western_medicine");
    assert.equal(item.primary_category, "anti_infective");
    assert.deepEqual(item.dosage_forms, ["tablet", "injection"]);
    assert.deepEqual(item.routes, ["oral", "intravenous"]);
    assert.deepEqual(item.risk_tags, ["allergy_check_required"]);
    assert.equal(item.review_status, "approved");
    assert.equal(item.lifecycle, "active");
    assert.equal(item.version, 1);
  });

  it("computes relative path from kbRoot", () => {
    const item = repo.toIndexItem(buildDoc({}, {}, "/tmp/fake-kb/drugs/western/anti/drug-test.md"));
    assert.equal(item.path, "drugs/western/anti/drug-test.md");
  });

  it("returns empty path when filePath is undefined", () => {
    const doc = buildDoc();
    delete doc.filePath;
    const item = repo.toIndexItem(doc);
    assert.equal(item.path, "");
  });

  it("searchable_text includes generic_cn", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("测试药物"));
  });

  it("searchable_text includes generic_en", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("test drug"));
  });

  it("searchable_text includes brand_names", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("品牌a"));
  });

  it("searchable_text includes aliases", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("别名x"));
  });

  it("searchable_text includes pharmacologic_class", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("penicillin"));
  });

  it("searchable_text includes indications", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("治疗感染"));
  });

  it("searchable_text includes dosage", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("每日三次"));
  });

  it("searchable_text includes contraindications", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("过敏者禁用"));
  });

  it("searchable_text includes precautions", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.ok(item.searchable_text.includes("肝肾功能不全者慎用"));
  });

  it("searchable_text is lowercased", () => {
    const item = repo.toIndexItem(buildDoc());
    assert.equal(item.searchable_text, item.searchable_text.toLowerCase());
  });

  it("handles missing optional name fields", () => {
    const item = repo.toIndexItem(buildDoc({
      names: { generic_cn: "测试药物" },
    }));
    assert.deepEqual(item.brand_names, []);
    assert.deepEqual(item.aliases, []);
    assert.equal(item.generic_en, undefined);
  });
});
