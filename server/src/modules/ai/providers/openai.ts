import type { LLMProvider, AIRuntimeConfig } from "../types.js";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI";
  private config: AIRuntimeConfig;

  constructor(config: AIRuntimeConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return !!this.config.api_key;
  }

  async chat(params: { system: string; user: string; json?: boolean }): Promise<string> {
    if (!this.config.api_key) throw new Error("OpenAI API Key 未配置");

    const messages: OpenAIMessage[] = [
      { role: "system", content: params.json ? `${params.system}\n\n你必须只输出合法的 JSON，不要包含任何其他文本。` : params.system },
      { role: "user", content: params.user },
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

    const response = await fetch(`${this.config.base_url}/chat/completions`, {
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
      throw new Error(`OpenAI API 错误 (${response.status}): ${err}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI 返回内容为空");
    return content;
  }
}
