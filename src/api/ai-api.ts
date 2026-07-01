import { apiFetch } from "./http.js";

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
  models: Array<{ value: string; label: string }>;
}

export interface AIProfileSummary {
  id: string;
  name: string;
  provider: string;
  model: string;
}

export interface AIProfile {
  id: string;
  name: string;
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface AIConfigResponse {
  provider: string;
  api_key_set: boolean;
  api_key_suffix: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  profiles: AIProfileSummary[];
  activeProfileId: string | null;
}

export interface AIParseResponse {
  success: boolean;
  provider: string;
  model: string;
  data?: {
    names: { generic_cn: string; generic_en?: string; brand_names?: string[]; aliases?: string[] };
    classification: { system: string; primary_category: string; secondary_category?: string; pharmacologic_class?: string; prescription_type?: string; atc_code?: string };
    forms: Array<{ dosage_form: string; strength?: string; route: string; package_unit?: string; manufacturer?: string; approval_number?: string }>;
    risk_tags: string[];
    label: Record<string, unknown>;
    confidence: number;
    warnings: string[];
  };
  fallback_used: boolean;
  error?: string;
  parse_time_ms: number;
}

export function getAIProviders(): Promise<{ providers: ProviderInfo[]; current: string }> {
  return apiFetch("/api/ai/providers");
}

export function getAIConfig(): Promise<AIConfigResponse> {
  return apiFetch("/api/ai/config");
}

export function updateAIConfig(config: Record<string, unknown>): Promise<{ success: boolean; config: AIConfigResponse }> {
  return apiFetch("/api/ai/config", { method: "PUT", body: JSON.stringify(config) });
}

export function resetAIConfig(): Promise<{ success: boolean; config: AIConfigResponse }> {
  return apiFetch("/api/ai/config", { method: "PUT", body: JSON.stringify({ reset: true }) });
}

export function parseLabelWithAI(labelText: string, basic?: Record<string, unknown>): Promise<AIParseResponse> {
  return apiFetch("/api/ai/parse-label", {
    method: "POST",
    body: JSON.stringify({ label_text: labelText, basic }),
  });
}

// ── Profile CRUD ─────────────────────────────────────────────────────────────

export function listProfiles(): Promise<{ profiles: AIProfile[]; activeProfileId: string | null }> {
  return apiFetch("/api/ai/profiles");
}

export function createProfile(data: { name: string; provider: string; api_key: string; base_url: string; model: string; temperature: number; max_tokens: number }): Promise<{ success: boolean; profile: AIProfile }> {
  return apiFetch("/api/ai/profiles", { method: "POST", body: JSON.stringify(data) });
}

export function updateProfile(id: string, patch: Record<string, unknown>): Promise<{ success: boolean; profile: AIProfile }> {
  return apiFetch(`/api/ai/profiles/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}

export function deleteProfile(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/ai/profiles/${id}`, { method: "DELETE" });
}

export function activateProfile(id: string): Promise<{ success: boolean; config: AIConfigResponse }> {
  return apiFetch(`/api/ai/profiles/${id}/activate`, { method: "POST" });
}

export function deactivateAll(): Promise<{ success: boolean }> {
  return apiFetch("/api/ai/profiles/deactivate", { method: "POST" });
}

export function testAIConnection(config: { provider: string; api_key: string; base_url: string; model: string; temperature: number }): Promise<{ success: boolean; reply?: string; error?: string; latency_ms: number }> {
  return apiFetch("/api/ai/test-connection", { method: "POST", body: JSON.stringify(config) });
}
