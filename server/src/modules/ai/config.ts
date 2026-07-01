import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AIRuntimeConfig, AIProfile, AIConfigStore, LLMProviderID } from "./types.js";

const PROVIDER_DEFAULTS: Record<LLMProviderID, { baseUrl: string; model: string }> = {
  openai:        { baseUrl: "https://api.openai.com/v1",                   model: "gpt-4o-mini" },
  anthropic:     { baseUrl: "https://api.anthropic.com",                   model: "claude-sonnet-4-6" },
  deepseek:      { baseUrl: "https://api.deepseek.com",                   model: "deepseek-v4-flash" },
  google:        { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
  "openai-compat": { baseUrl: "", model: "" },
};

const CONFIG_PATH = resolve(process.cwd(), "ai-config.json");

// ── File I/O ────────────────────────────────────────────────────────────────

function loadFromFile(): AIConfigStore {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const data = JSON.parse(raw) as Partial<AIConfigStore>;
      return {
        profiles: data.profiles || [],
        activeProfileId: data.activeProfileId || null,
      };
    }
  } catch { /* ignore corrupt file */ }
  return { profiles: [], activeProfileId: null };
}

function saveToFile(store: AIConfigStore): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save AI config:", err);
  }
}

// ── Legacy .env migration ────────────────────────────────────────────────────

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

function migrateFromEnv(store: AIConfigStore): AIConfigStore {
  if (store.profiles.length > 0) return store;
  const apiKey = envStr("AI_API_KEY");
  if (!apiKey) return store;
  const provider = (envStr("AI_PROVIDER", "openai") || "openai") as LLMProviderID;
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
  const profile: AIProfile = {
    id: randomUUID(),
    name: "默认配置",
    provider,
    api_key: apiKey,
    base_url: envStr("AI_BASE_URL", defaults.baseUrl),
    model: envStr("AI_MODEL", defaults.model),
    temperature: envNum("AI_TEMPERATURE", 0.3),
    max_tokens: envNum("AI_MAX_TOKENS", 4096),
  };
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  saveToFile(store);
  return store;
}

// ── State ────────────────────────────────────────────────────────────────────

let store: AIConfigStore = migrateFromEnv(loadFromFile());

// ── Public API ───────────────────────────────────────────────────────────────

export function getAIConfig(): AIRuntimeConfig {
  const profile = store.profiles.find((p) => p.id === store.activeProfileId);
  if (!profile) {
    return {
      provider: "openai", api_key: "", base_url: PROVIDER_DEFAULTS.openai.baseUrl,
      model: PROVIDER_DEFAULTS.openai.model, temperature: 0.3, max_tokens: 4096, enabled: false,
    };
  }
  return {
    provider: profile.provider,
    api_key: profile.api_key,
    base_url: profile.base_url,
    model: profile.model,
    temperature: profile.temperature,
    max_tokens: profile.max_tokens,
    enabled: !!profile.api_key,
  };
}

// ── Profile CRUD ─────────────────────────────────────────────────────────────

export function listProfiles(): AIProfile[] {
  return store.profiles.map((p) => ({ ...p }));
}

export function getActiveProfileId(): string | null {
  return store.activeProfileId;
}

export function createProfile(data: Omit<AIProfile, "id">): AIProfile {
  const profile: AIProfile = { id: randomUUID(), ...data };
  store.profiles.push(profile);
  if (!store.activeProfileId) store.activeProfileId = profile.id;
  saveToFile(store);
  return { ...profile };
}

export function updateProfile(id: string, patch: Partial<Omit<AIProfile, "id">>): AIProfile | null {
  const idx = store.profiles.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  store.profiles[idx] = { ...store.profiles[idx], ...patch };
  saveToFile(store);
  return { ...store.profiles[idx] };
}

export function deleteProfile(id: string): boolean {
  const idx = store.profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  store.profiles.splice(idx, 1);
  if (store.activeProfileId === id) {
    store.activeProfileId = store.profiles[0]?.id || null;
  }
  saveToFile(store);
  return true;
}

export function setActiveProfile(id: string): boolean {
  if (!store.profiles.some((p) => p.id === id)) return false;
  store.activeProfileId = id;
  saveToFile(store);
  return true;
}

export function deactivateAll(): void {
  store.activeProfileId = null;
  saveToFile(store);
}

// ── Legacy compat ────────────────────────────────────────────────────────────

export function resetAIConfig(): void {
  store = { profiles: [], activeProfileId: null };
  saveToFile(store);
}

export function updateActiveProfile(patch: Partial<Omit<AIProfile, "id">>): void {
  if (!store.activeProfileId) return;
  const idx = store.profiles.findIndex((p) => p.id === store.activeProfileId);
  if (idx === -1) return;
  store.profiles[idx] = { ...store.profiles[idx], ...patch };
  saveToFile(store);
}

export function getProviderDefaults(provider: LLMProviderID) {
  return PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
}
