import type { LLMProvider, AIRuntimeConfig } from "../types.js";

interface OpenAICompatibleResponse {
  choices: Array<{ message: { content: string } }>;
}

export class OpenAICompatProvider implements LLMProvider {
  readonly id = "openai-compat" as const;
  readonly name = "OpenAI 兼容格式";
  private config: AIRuntimeConfig;

  constructor(config: AIRuntimeConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return !!this.config.api_key && !!this.config.base_url;
  }

  async chat(params: { system: string; user: string; json?: boolean }): Promise<string> {
    if (!this.config.api_key) throw new Error("API Key 未配置");
    if (!this.config.base_url) throw new Error("Base URL 未配置（OpenAI 兼容格式必填）");
    if (!this.config.model) throw new Error("模型名称 未配置（OpenAI 兼容格式必填）");

    const messages = [
      { role: "system" as const, content: params.json ? `${params.system}\n\n你必须只输出合法的 JSON，不要包含任何其他文本。` : params.system },
      { role: "user" as const, content: params.user },
    ];

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.max_tokens,
    };

    if (params.json) {
      body.response_format = { type: "json_object" };
    }

    const baseUrl = this.config.base_url.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`API 错误 (${response.status}): ${err}`);
    }

    const data = (await response.json()) as OpenAICompatibleResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("API 返回内容为空");
    return content;
  }
}
