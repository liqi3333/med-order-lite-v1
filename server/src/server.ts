import http from "node:http";
import { createAppContext } from "./core/app-context.js";
import { parseUrl, readRequestBody, sendJson, sendText } from "./utils/http.js";
import { parseDrugMarkdown } from "./modules/drug-kb/drug-md.js";

const ctx = createAppContext();
function getPathParts(pathname: string): string[] { return pathname.split("/").filter(Boolean).map(decodeURIComponent); }
async function rebuildDrugIndex(): Promise<{ drugs: number }> { const drugs = await ctx.drugRepository.buildIndex(false); return { drugs: drugs.length }; }

const server = http.createServer(async (req, res) => {
  try {
    const url = parseUrl(req);
    const parts = getPathParts(url.pathname);
    const method = req.method || "GET";
    if (method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,accept" });
      res.end(); return;
    }
    res.setHeader("access-control-allow-origin", "*");

    if (method === "GET" && url.pathname === "/health") { sendJson(res, { ok: true, service: "med-order-lite-api", version: "0.3.0-lite", kbRoot: ctx.config.kbRoot }); return; }
    if (method === "GET" && url.pathname === "/") { sendText(res, "Med Order Lite API is running. Open the web app frontend to use drug library, import, and order generation."); return; }

    if (method === "GET" && url.pathname === "/api/taxonomies") { sendJson(res, await ctx.taxonomyService.getBundle()); return; }
    if (method === "GET" && parts[0] === "api" && parts[1] === "taxonomies" && parts[2]) {
      if (parts[2] === "drug-categories") sendJson(res, await ctx.taxonomyService.getDrugCategories());
      else if (["dosage-forms", "routes", "prescription-types", "risk-tags", "frequencies"].includes(parts[2])) sendJson(res, await ctx.taxonomyService.getOptions(parts[2] as never));
      else sendJson(res, { error: "未知字典" }, { status: 404 });
      return;
    }

    if (method === "GET" && url.pathname === "/api/plugins") { sendJson(res, { plugins: ctx.drugEntryService.listPlugins() }); return; }
    if (method === "POST" && parts[0] === "api" && parts[1] === "plugins" && parts[2] && parts[3] === "import") {
      const body = await readRequestBody<Record<string, unknown>>(req);
      sendJson(res, await ctx.drugEntryService.importWithPlugin(parts[2], body)); return;
    }

    if (method === "GET" && url.pathname === "/api/drugs") {
      const items = await ctx.drugRepository.query({ q: url.searchParams.get("q") || undefined, system: url.searchParams.get("system") || undefined, primaryCategory: url.searchParams.get("primaryCategory") || undefined, secondaryCategory: url.searchParams.get("secondaryCategory") || undefined, route: url.searchParams.get("route") || undefined, dosageForm: url.searchParams.get("dosageForm") || undefined, includeDrafts: false });
      sendJson(res, { total: items.length, items }); return;
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "drugs" && parts[2] && !parts[3]) {
      const doc = await ctx.drugRepository.readById(parts[2], false);
      if (!doc) sendJson(res, { error: "未找到药物" }, { status: 404 }); else sendJson(res, { frontmatter: doc.frontmatter, label: doc.label, filePath: doc.filePath });
      return;
    }
    if (method === "GET" && parts[0] === "api" && parts[1] === "drugs" && parts[2] && parts[3] === "raw-md") {
      const raw = await ctx.drugRepository.readRawById(parts[2], false);
      if (!raw) sendJson(res, { error: "未找到药物" }, { status: 404 }); else sendText(res, raw);
      return;
    }
    if (method === "POST" && url.pathname === "/api/drugs/validate") {
      const body = await readRequestBody<{ markdown?: string; mode?: "draft" | "publish" }>(req);
      if (!body.markdown) throw new Error("markdown 不能为空");
      const doc = parseDrugMarkdown(body.markdown);
      sendJson(res, await ctx.drugValidator.validate(doc, body.mode || "draft")); return;
    }
    if (method === "POST" && url.pathname === "/api/drugs/import/markdown") {
      const body = await readRequestBody<{ markdown?: string }>(req);
      if (!body.markdown) throw new Error("markdown 不能为空");
      const doc = parseDrugMarkdown(body.markdown);
      doc.frontmatter.review.review_status = "approved";
      doc.frontmatter.review.lifecycle = "active";
      doc.frontmatter.review.reviewed_at = new Date().toISOString().slice(0, 10);
      doc.frontmatter.review.updated_at = new Date().toISOString().slice(0, 10);
      const validation = await ctx.drugValidator.validate(doc, "publish");
      if (!validation.ok) sendJson(res, { drugId: doc.frontmatter.id, status: "published", markdown: body.markdown, validation, document: doc, notes: ["校验未通过，未写入正式药物库。"] });
      else {
        const saved = await ctx.drugRepository.publish(doc.frontmatter, doc.label);
        await ctx.drugRepository.buildIndex(false);
        sendJson(res, { drugId: doc.frontmatter.id, status: "published", markdown: saved.markdown, savedPath: saved.path, validation, document: parseDrugMarkdown(saved.markdown), notes: ["已导入标准 drug.md 并保存到药物库。"] });
      }
      return;
    }

    if (method === "POST" && url.pathname === "/api/index/rebuild") { sendJson(res, { ok: true, ...(await rebuildDrugIndex()) }); return; }
    if (method === "GET" && url.pathname === "/api/index/status") { const items = await ctx.drugRepository.readIndex(); sendJson(res, { drugs: items.length, indexPath: ctx.drugRepository.indexPath }); return; }
    if (method === "POST" && url.pathname === "/api/orders/generate") { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.orderGeneratorService.generateFromDrugLabel(body as never)); return; }

    sendJson(res, { error: "Not Found" }, { status: 404 });
  } catch (error) { sendJson(res, { error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
});

server.listen(ctx.config.port, () => {
  console.log(`med-order-lite-api listening on http://localhost:${ctx.config.port}`);
  console.log(`kbRoot=${ctx.config.kbRoot}`);
});
