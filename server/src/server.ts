import http from "node:http";
import { createAppContext } from "./core/app-context.js";
import { Route, matchRoute } from "./core/router.js";
import { corsMiddleware, loggingMiddleware, errorMiddleware, runMiddleware } from "./core/middleware.js";
import { parseUrl, readRequestBody, sendJson, sendText } from "./utils/http.js";
import { parseDrugMarkdown } from "./modules/drug-kb/drug-md.js";
import { getAIConfig, updateAIConfig, resetAIConfig } from "./modules/ai/config.js";
import { createLLMProvider } from "./modules/ai/llm-provider.js";
import { parseWithAI } from "./modules/ai/label-parser.js";
import { aiSearchDrugs } from "./modules/ai/drug-search.js";
import type { LLMProviderID } from "./modules/ai/types.js";

const PROVIDER_LIST = [
  { id: "openai" as LLMProviderID, name: "OpenAI", defaultModel: "gpt-4o-mini", defaultBaseUrl: "https://api.openai.com/v1", models: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
    { value: "o3", label: "o3" },
    { value: "o3-mini", label: "o3-mini" },
    { value: "o4-mini", label: "o4-mini" },
  ]},
  { id: "anthropic" as LLMProviderID, name: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-6", defaultBaseUrl: "https://api.anthropic.com", models: [
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
  ]},
  { id: "deepseek" as LLMProviderID, name: "DeepSeek", defaultModel: "deepseek-v4-flash", defaultBaseUrl: "https://api.deepseek.com", models: [
    { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  ]},
  { id: "google" as LLMProviderID, name: "Google (Gemini)", defaultModel: "gemini-2.5-flash", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta", models: [
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ]},
  { id: "openai-compat" as LLMProviderID, name: "OpenAI 兼容格式", defaultModel: "", defaultBaseUrl: "", models: [
    { value: "_custom", label: "自定义模型名称" },
  ]},
];

const ctx = createAppContext();

async function rebuildDrugIndex() {
  const drugs = await ctx.drugRepository.buildIndex();
  return { ok: true, drugs: drugs.length, indexPath: ctx.drugRepository.indexPath, rebuiltAt: new Date().toISOString() };
}

async function getDrugIndexStatus() {
  const status = await ctx.drugRepository.getIndexStatus();
  return { ok: true, drugs: status };
}

const routes: Route[] = [
  {
    method: "GET", pattern: "/health",
    handler: async (_req, res) => { sendJson(res, { ok: true, service: "med-order-lite-api", version: "0.3.0-lite", kbRoot: ctx.config.kbRoot }); },
  },
  {
    method: "GET", pattern: "/",
    handler: async (_req, res) => { sendText(res, "Med Order Lite API is running. Open the web app frontend to use drug library, import, and order generation."); },
  },
  {
    method: "GET", pattern: "/api/taxonomies",
    handler: async (_req, res) => { sendJson(res, await ctx.taxonomyService.getBundle()); },
  },
  {
    method: "GET", pattern: "/api/taxonomies/:name",
    handler: async (_req, res, params) => {
      const { name } = params;
      if (name === "drug-categories") sendJson(res, await ctx.taxonomyService.getDrugCategories());
      else if (["dosage-forms", "routes", "prescription-types", "risk-tags", "frequencies"].includes(name)) sendJson(res, await ctx.taxonomyService.getOptions(name as never));
      else sendJson(res, { error: "未知字典" }, { status: 404 });
    },
  },
  {
    method: "GET", pattern: "/api/plugins",
    handler: async (_req, res) => { sendJson(res, { plugins: ctx.drugEntryService.listPlugins() }); },
  },
  {
    method: "POST", pattern: "/api/plugins/:pluginId/import",
    handler: async (req, res, params) => { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.drugEntryService.importWithPlugin(params.pluginId, body)); },
  },
  {
    method: "POST", pattern: "/api/plugins/:pluginId/import-batch",
    handler: async (req, res, params) => { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.drugEntryService.importBatchWithPlugin(params.pluginId, body)); },
  },
  {
    method: "POST", pattern: "/api/drugs/import/csv",
    handler: async (req, res) => { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.drugEntryService.importBatchWithPlugin("excel-csv", body)); },
  },
  {
    method: "POST", pattern: "/api/drugs/import/pdf",
    handler: async (req, res) => { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.drugEntryService.importWithPlugin("label-pdf", body)); },
  },
  {
    method: "POST", pattern: "/api/drugs/import/ocr",
    handler: async (req, res) => { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.drugEntryService.importWithPlugin("label-ocr", body)); },
  },
  {
    method: "GET", pattern: "/api/drugs",
    handler: async (_req, res, _params, url) => {
      const items = await ctx.drugRepository.query({
        q: url.searchParams.get("q") || undefined,
        system: url.searchParams.get("system") || undefined,
        primaryCategory: url.searchParams.get("primaryCategory") || undefined,
        secondaryCategory: url.searchParams.get("secondaryCategory") || undefined,
        route: url.searchParams.get("route") || undefined,
        dosageForm: url.searchParams.get("dosageForm") || undefined,
        includeDrafts: false,
      });
      sendJson(res, { total: items.length, items });
    },
  },
  {
    method: "GET", pattern: "/api/drugs/:id/raw-md",
    handler: async (_req, res, params) => { const raw = await ctx.drugRepository.readRawById(params.id); if (!raw) sendJson(res, { error: "未找到药物" }, { status: 404 }); else sendText(res, raw); },
  },
  {
    method: "GET", pattern: "/api/drugs/:id",
    handler: async (_req, res, params) => { const doc = await ctx.drugRepository.readById(params.id); if (!doc) sendJson(res, { error: "未找到药物" }, { status: 404 }); else sendJson(res, { frontmatter: doc.frontmatter, label: doc.label, filePath: doc.filePath }); },
  },
  {
    method: "POST", pattern: "/api/drugs/validate",
    handler: async (req, res) => {
      const body = await readRequestBody<{ markdown?: string; mode?: "draft" | "publish" }>(req);
      if (!body.markdown) throw new Error("markdown 不能为空");
      const doc = parseDrugMarkdown(body.markdown);
      sendJson(res, await ctx.drugValidator.validate(doc, body.mode || "draft"));
    },
  },
  {
    method: "POST", pattern: "/api/drugs/import/markdown",
    handler: async (req, res) => {
      const body = await readRequestBody<{ markdown?: string }>(req);
      if (!body.markdown) throw new Error("markdown 不能为空");
      const doc = parseDrugMarkdown(body.markdown);
      doc.frontmatter.review.review_status = "approved";
      doc.frontmatter.review.lifecycle = "active";
      doc.frontmatter.review.reviewed_at = new Date().toISOString().slice(0, 10);
      doc.frontmatter.review.updated_at = new Date().toISOString().slice(0, 10);
      const validation = await ctx.drugValidator.validate(doc, "publish");
      if (!validation.ok) {
        sendJson(res, { drugId: doc.frontmatter.id, status: "published", markdown: body.markdown, validation, document: doc, notes: ["校验未通过，未写入正式药物库。"] });
      } else {
        const saved = await ctx.drugRepository.publish(doc.frontmatter, doc.label);
        let indexRebuilt = false;
        let indexCount = 0;
        let indexWarning: string | undefined;
        try {
          const index = await ctx.drugRepository.buildIndex();
          indexRebuilt = true;
          indexCount = index.length;
        } catch (error) {
          indexWarning = error instanceof Error ? error.message : String(error);
        }
        const notes = ["已导入标准 drug.md 并保存到药物库。", indexRebuilt ? `索引已自动重建。当前索引药物数：${indexCount}。` : `索引自动重建失败，请在药物库页面点击"重建索引"。${indexWarning ? `错误：${indexWarning}` : ""}`];
        sendJson(res, { drugId: doc.frontmatter.id, status: "published", markdown: saved.markdown, savedPath: saved.path, validation, document: parseDrugMarkdown(saved.markdown), notes, indexRebuilt, indexCount, indexWarning });
      }
    },
  },
  {
    method: "POST", pattern: "/api/index/rebuild",
    handler: async (_req, res) => { sendJson(res, await rebuildDrugIndex()); },
  },
  {
    method: "POST", pattern: "/api/indexes/rebuild",
    handler: async (_req, res) => { sendJson(res, await rebuildDrugIndex()); },
  },
  {
    method: "GET", pattern: "/api/index/status",
    handler: async (_req, res) => { sendJson(res, await getDrugIndexStatus()); },
  },
  {
    method: "GET", pattern: "/api/indexes/status",
    handler: async (_req, res) => { sendJson(res, await getDrugIndexStatus()); },
  },
  {
    method: "POST", pattern: "/api/orders/generate",
    handler: async (req, res) => { const body = await readRequestBody<Record<string, unknown>>(req); sendJson(res, await ctx.orderGeneratorService.generateFromDrugLabel(body as never)); },
  },
  {
    method: "GET", pattern: "/api/ai/providers",
    handler: async (_req, res) => {
      const config = getAIConfig();
      const providers = PROVIDER_LIST.map((p) => ({
        ...p,
        available: p.id === config.provider || !!(p.id !== "openai-compat" && config.api_key),
      }));
      sendJson(res, { providers, current: config.provider });
    },
  },
  {
    method: "GET", pattern: "/api/ai/config",
    handler: async (_req, res) => {
      const config = getAIConfig();
      sendJson(res, {
        provider: config.provider,
        api_key_set: !!config.api_key,
        api_key_suffix: config.api_key ? config.api_key.slice(-4) : "",
        base_url: config.base_url,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        enabled: config.enabled,
      });
    },
  },
  {
    method: "PUT", pattern: "/api/ai/config",
    handler: async (req, res) => {
      const body = await readRequestBody<Record<string, unknown>>(req);
      if (body.reset === true) {
        resetAIConfig();
        sendJson(res, { success: true, config: getAIConfig() });
        return;
      }
      const patch: Record<string, unknown> = {};
      if (typeof body.provider === "string") patch.provider = body.provider;
      if (typeof body.api_key === "string") patch.api_key = body.api_key;
      if (typeof body.base_url === "string") patch.base_url = body.base_url;
      if (typeof body.model === "string") patch.model = body.model;
      if (typeof body.temperature === "number") patch.temperature = body.temperature;
      if (typeof body.max_tokens === "number") patch.max_tokens = body.max_tokens;
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      updateAIConfig(patch);
      sendJson(res, { success: true, config: getAIConfig() });
    },
  },
  {
    method: "POST", pattern: "/api/ai/parse-label",
    handler: async (req, res) => {
      const body = await readRequestBody<{ label_text?: string; basic?: Record<string, unknown> }>(req);
      if (!body.label_text?.trim()) throw new Error("label_text 不能为空");
      const config = getAIConfig();
      if (!config.enabled || !config.api_key) {
        sendJson(res, { success: false, error: "AI 未启用或 API Key 未配置", fallback_used: true }, { status: 400 });
        return;
      }
      const provider = createLLMProvider(config);
      const start = Date.now();
      try {
        const data = await parseWithAI(body.label_text, provider);
        sendJson(res, {
          success: true,
          provider: config.provider,
          model: config.model,
          data,
          fallback_used: false,
          parse_time_ms: Date.now() - start,
        });
      } catch (err) {
        sendJson(res, {
          success: false,
          provider: config.provider,
          model: config.model,
          error: err instanceof Error ? err.message : String(err),
          fallback_used: true,
          parse_time_ms: Date.now() - start,
        }, { status: 500 });
      }
    },
  },
  {
    method: "POST", pattern: "/api/drugs/search-ai",
    handler: async (req, res) => {
      const body = await readRequestBody<{ query?: string }>(req);
      if (!body.query?.trim()) throw new Error("query 不能为空");
      const config = getAIConfig();
      if (!config.enabled || !config.api_key) {
        sendJson(res, { success: false, error: "AI 未启用或 API Key 未配置" }, { status: 400 });
        return;
      }
      const provider = createLLMProvider(config);
      const start = Date.now();
      try {
        const drugIndex = await ctx.drugRepository.readIndex();
        const aiResult = await aiSearchDrugs(body.query, provider, drugIndex);
        sendJson(res, {
          success: true,
          provider: config.provider,
          model: config.model,
          params: aiResult.params,
          results: aiResult.results,
          explanation: aiResult.explanation,
          total: aiResult.results.length,
          parse_time_ms: Date.now() - start,
        });
      } catch (err) {
        sendJson(res, {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          parse_time_ms: Date.now() - start,
        }, { status: 500 });
      }
    },
  },
];

const server = http.createServer(async (req, res) => {
  await runMiddleware([corsMiddleware, loggingMiddleware, errorMiddleware], req, res, async () => {
    const url = parseUrl(req);
    const method = req.method || "GET";
    const matched = matchRoute(routes, method, url.pathname);
    if (matched) {
      await matched.handler(req, res, matched.params, url);
    } else {
      sendJson(res, { error: "Not Found" }, { status: 404 });
    }
  });
});

server.listen(ctx.config.port, () => {
  console.log(`med-order-lite-api listening on http://localhost:${ctx.config.port}`);
  console.log(`kbRoot=${ctx.config.kbRoot}`);
});
