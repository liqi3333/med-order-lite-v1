import { createAppContext } from "../src/core/app-context.js";

const ctx = createAppContext();
const mode = process.argv.includes("--publish") ? "publish" : "draft";
const docs = await ctx.drugRepository.listAllDocuments();
let errorCount = 0;
let warningCount = 0;
for (const doc of docs) {
  const result = await ctx.drugValidator.validate(doc, mode);
  console.log(`\n${doc.filePath || doc.frontmatter.id}`);
  if (result.errors.length === 0 && result.warnings.length === 0) console.log("  ok");
  for (const item of result.errors) {
    errorCount += 1;
    console.log(`  ERROR ${item.code}: ${item.message}`);
  }
  for (const item of result.warnings) {
    warningCount += 1;
    console.log(`  WARN  ${item.code}: ${item.message}`);
  }
}
console.log(`\nvalidated=${docs.length} errors=${errorCount} warnings=${warningCount}`);
process.exit(errorCount > 0 ? 1 : 0);
