import type { LLMProvider, AIRuntimeConfig } from "../types.js";

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic (Claude)";
  private config: AIRuntimeConfig;

  constructor(config: AIRuntimeConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return !!this.config.api_key;
  }

  async chat(params: { system: string; user: string; json?: boolean }): Promise<string> {
    if (!this.config.api_key) throw new Error("Anthropic API Key 未配置");

    const systemPrompt = params.json
      ? `${params.system}\n\n你必须只输出合法的 JSON，不要包含任何其他文本。`
      : params.system;

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      system: systemPrompt,
      messages: [
        { role: "user", content: params.user },
      ],
    };

    if (this.config.temperature !== undefined) {
      body.temperature = this.config.temperature;
    }

    const response = await fetch(`${this.config.base_url}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.config.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`Anthropic API 错误 (${response.status}): ${err}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new Error("Anthropic 返回内容为空");
    return text;
  }
}
