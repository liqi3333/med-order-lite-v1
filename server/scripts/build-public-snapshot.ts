import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppContext } from "../src/core/app-context.js";

const ctx = createAppContext();
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const outPath = path.join(appRoot, "public", "kb", "kb-snapshot.json");
const [drugs, taxonomies] = await Promise.all([ctx.drugRepository.query({ includeDrafts: false }), ctx.taxonomyService.getBundle()]);
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, `${JSON.stringify({ meta: { generated_at: new Date().toISOString(), warning: "离线快照仅用于药物库只读展示，不可替代实时后端。" }, drugs, taxonomies }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outPath, drugs: drugs.length }, null, 2));
