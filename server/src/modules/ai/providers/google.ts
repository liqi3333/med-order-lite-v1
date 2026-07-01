import type { LLMProvider, AIRuntimeConfig } from "../types.js";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text: string }> } }>;
}

export class GoogleProvider implements LLMProvider {
  readonly id = "google" as const;
  readonly name = "Google (Gemini)";
  private config: AIRuntimeConfig;

  constructor(config: AIRuntimeConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return !!this.config.api_key;
  }

  async chat(params: { system: string; user: string; json?: boolean }): Promise<string> {
    if (!this.config.api_key) throw new Error("Google Gemini API Key 未配置");

    const systemInstruction = params.json
      ? `${params.system}\n\n你必须只输出合法的 JSON，不要包含任何其他文本。`
      : params.system;

    const body: Record<string, unknown> = {
      contents: [
        { role: "user", parts: [{ text: params.user }] },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.max_tokens,
      },
    };

    if (params.json) {
      (body.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
    }

    const model = this.config.model || "gemini-2.5-flash";
    const url = `${this.config.base_url}/models/${model}:generateContent?key=${this.config.api_key}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`Google Gemini API 错误 (${response.status}): ${err}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Google Gemini 返回内容为空");
    return text;
  }
}
