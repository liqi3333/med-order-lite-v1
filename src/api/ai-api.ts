import { apiFetch } from "./http.js";

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
  models: Array<{ value: string; label: string }>;
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
