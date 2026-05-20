import { createAppContext } from "../src/core/app-context.js";

const ctx = createAppContext();
const includeDrafts = process.argv.includes("--include-drafts");
const index = await ctx.drugRepository.buildIndex(includeDrafts);
console.log(JSON.stringify({ ok: true, total: index.length, indexPath: ctx.drugRepository.indexPath, includeDrafts }, null, 2));
