import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./fs.js";

describe("slugify", () => {
  it("lowercases ASCII", () => {
    assert.equal(slugify("Hello World"), "hello-world");
  });

  it("preserves CJK characters", () => {
    assert.equal(slugify("测试药物"), "测试药物");
  });

  it("replaces spaces and special chars with hyphens", () => {
    assert.equal(slugify("drug name (oral)"), "drug-name-oral");
  });

  it("strips leading/trailing hyphens", () => {
    assert.equal(slugify("--hello--"), "hello");
  });

  it("collapses multiple separators", () => {
    assert.equal(slugify("a   b   c"), "a-b-c");
  });

  it("strips diacritics via NFKD normalization", () => {
    assert.equal(slugify("café"), "cafe");
  });

  it("truncates to 80 characters", () => {
    const long = "a".repeat(100);
    assert.equal(slugify(long).length, 80);
  });

  it("returns unnamed for empty input", () => {
    assert.equal(slugify(""), "unnamed");
    assert.equal(slugify("   "), "unnamed");
  });

  it("handles mixed CJK and ASCII", () => {
    assert.equal(slugify("药物 Drug 01"), "药物-drug-01");
  });
});
