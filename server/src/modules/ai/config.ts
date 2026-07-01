import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AIRuntimeConfig, LLMProviderID } from "./types.js";

const PROVIDER_DEFAULTS: Record<LLMProviderID, { baseUrl: string; model: string }> = {
  openai:        { baseUrl: "https://api.openai.com/v1",                   model: "gpt-4o-mini" },
  anthropic:     { baseUrl: "https://api.anthropic.com",                   model: "claude-sonnet-4-6" },
  deepseek:      { baseUrl: "https://api.deepseek.com",                   model: "deepseek-v4-flash" },
  google:        { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
  "openai-compat": { baseUrl: "", model: "" },
};

const CONFIG_PATH = resolve(process.cwd(), "ai-config.json");

function envStr(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

function envNum(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.trim()?.toLowerCase();
  if (!raw) return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function loadFromEnv(): AIRuntimeConfig {
  const provider = (envStr("AI_PROVIDER", "openai") || "openai") as LLMProviderID;
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
  return {
    provider,
    api_key: envStr("AI_API_KEY"),
    base_url: envStr("AI_BASE_URL", defaults.baseUrl),
    model: envStr("AI_MODEL", defaults.model),
    temperature: envNum("AI_TEMPERATURE", 0.3),
    max_tokens: envNum("AI_MAX_TOKENS", 4096),
    enabled: envBool("AI_ENABLED", false),
  };
}

function loadFromFile(): AIRuntimeConfig | null {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const data = JSON.parse(raw) as Partial<AIRuntimeConfig>;
      // Merge with env defaults so missing fields get filled
      return { ...loadFromEnv(), ...data };
    }
  } catch { /* ignore corrupt file */ }
  return null;
}

function saveToFile(config: AIRuntimeConfig): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save AI config:", err);
  }
}

let runtimeConfig: AIRuntimeConfig = loadFromFile() || loadFromEnv();

export function getAIConfig(): AIRuntimeConfig {
  return { ...runtimeConfig };
}

export function updateAIConfig(patch: Partial<AIRuntimeConfig>): void {
  runtimeConfig = { ...runtimeConfig, ...patch };
  if (patch.api_key && patch.enabled === undefined) {
    runtimeConfig.enabled = true;
  }
  saveToFile(runtimeConfig);
}

export function resetAIConfig(): void {
  runtimeConfig = loadFromEnv();
  saveToFile(runtimeConfig);
}

export function getProviderDefaults(provider: LLMProviderID) {
  return PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
}
