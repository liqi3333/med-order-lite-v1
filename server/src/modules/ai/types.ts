import { DrugLabelSections } from "../drug-kb/types.js";

export type LLMProviderID = "openai" | "anthropic" | "deepseek" | "google" | "openai-compat";

export interface LLMProviderConfig {
  provider: LLMProviderID;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  readonly id: LLMProviderID;
  readonly name: string;
  chat(params: { system: string; user: string; json?: boolean }): Promise<string>;
  isAvailable(): boolean;
}

export interface ProviderInfo {
  id: LLMProviderID;
  name: string;
  available: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
  models: Array<{ value: string; label: string }>;
}

export interface AIParsedDrugData {
  names: {
    generic_cn: string;
    generic_en?: string;
    brand_names?: string[];
    aliases?: string[];
  };
  classification: {
    system: string;
    primary_category: string;
    secondary_category?: string;
    pharmacologic_class?: string;
    prescription_type?: string;
    atc_code?: string;
  };
  forms: Array<{
    dosage_form: string;
    strength?: string;
    route: string;
    package_unit?: string;
    manufacturer?: string;
    approval_number?: string;
  }>;
  risk_tags: string[];
  label: DrugLabelSections;
  confidence: number;
  warnings: string[];
}

export interface AIParseRequest {
  label_text: string;
  basic?: Record<string, unknown>;
}

export interface AIParseResponse {
  success: boolean;
  provider: LLMProviderID;
  model: string;
  data?: AIParsedDrugData;
  fallback_used: boolean;
  error?: string;
  parse_time_ms: number;
}

export interface AIRuntimeConfig {
  provider: LLMProviderID;
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}
