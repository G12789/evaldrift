import type { ChatMessage, Provider, ProviderConfig } from "../types.js";
import { readApiKey } from "../util.js";

/**
 * OpenAI 兼容 provider。
 * 同一套接口覆盖绝大多数国产模型，只要换 baseUrl：
 *   DeepSeek  https://api.deepseek.com/v1
 *   Kimi      https://api.moonshot.cn/v1
 *   通义千问   https://dashscope.aliyuncs.com/compatible-mode/v1
 *   豆包       https://ark.cn-beijing.volces.com/api/v3
 *   智谱       https://open.bigmodel.cn/api/paas/v4
 */
export function createOpenAIProvider(cfg: ProviderConfig): Provider {
  const baseUrl = (cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const apiKey = readApiKey(cfg.apiKeyEnv);
  return {
    label: `openai(${cfg.model} @ ${baseUrl})`,
    async complete(messages: ChatMessage[]): Promise<string> {
      if (!apiKey) {
        throw new Error(
          `缺少 API Key：请设置环境变量 ${cfg.apiKeyEnv || "(provider.apiKeyEnv 未配置)"}`,
        );
      }
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: cfg.temperature ?? 0,
          ...(cfg.maxTokens ? { max_tokens: cfg.maxTokens } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI 兼容接口报错 ${res.status}: ${text.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}
