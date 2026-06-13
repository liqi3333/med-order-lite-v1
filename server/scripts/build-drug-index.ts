import { createAppContext } from "../src/core/app-context.js";

const ctx = createAppContext();
const index = await ctx.drugRepository.buildIndex();
console.log(JSON.stringify({ ok: true, total: index.length, indexPath: ctx.drugRepository.indexPath }, null, 2));
