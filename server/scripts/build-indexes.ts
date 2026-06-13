import { createAppContext } from "../src/core/app-context.js";

const ctx = createAppContext();
const drugs = await ctx.drugRepository.buildIndex();
console.log(JSON.stringify({ ok: true, drugs: drugs.length, kbRoot: ctx.config.kbRoot }, null, 2));
