import type { ChatMessage, Provider, ProviderConfig } from "../types.js";

export function createOllamaProvider(cfg: ProviderConfig): Provider {
  const baseUrl = (cfg.baseUrl || "http://localhost:11434").replace(/\/+$/, "");
  return {
    label: `ollama(${cfg.model} @ ${baseUrl})`,
    async complete(messages: ChatMessage[]): Promise<string> {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          stream: false,
          options: { temperature: cfg.temperature ?? 0 },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama 接口报错 ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content ?? "";
    },
  };
}
