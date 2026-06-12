import type { ChatMessage, Provider, ProviderConfig } from "../types.js";
import { readApiKey } from "../util.js";

export function createAnthropicProvider(cfg: ProviderConfig): Provider {
  const baseUrl = (cfg.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
  const apiKey = readApiKey(cfg.apiKeyEnv);
  return {
    label: `anthropic(${cfg.model})`,
    async complete(messages: ChatMessage[]): Promise<string> {
      if (!apiKey) {
        throw new Error(`缺少 API Key：请设置环境变量 ${cfg.apiKeyEnv || "ANTHROPIC_API_KEY"}`);
      }
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const chat = messages.filter((m) => m.role !== "system");
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: cfg.maxTokens ?? 1024,
          temperature: cfg.temperature ?? 0,
          ...(system ? { system } : {}),
          messages: chat.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Anthropic 接口报错 ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as { content?: { text?: string }[] };
      return data.content?.map((c) => c.text ?? "").join("") ?? "";
    },
  };
}
