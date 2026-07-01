import type { LLMProvider, LLMProviderID, AIRuntimeConfig } from "./types.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { DeepSeekProvider } from "./providers/deepseek.js";
import { GoogleProvider } from "./providers/google.js";
import { OpenAICompatProvider } from "./providers/openai-compat.js";

export function createLLMProvider(config: AIRuntimeConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "deepseek":
      return new DeepSeekProvider(config);
    case "google":
      return new GoogleProvider(config);
    case "openai-compat":
      return new OpenAICompatProvider(config);
    default:
      throw new Error(`不支持的 AI provider: ${config.provider}`);
  }
}
