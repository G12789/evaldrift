import type { ChatMessage, Provider, ProviderConfig } from "../types.js";

/**
 * 离线 mock provider —— 不需要任何 API Key，开箱即跑。
 * 用于 example、CI、以及你想先把测试用例和断言调通、再接真实模型的场景。
 *
 * 匹配规则：把最后一条 user 消息和 mockResponses 的每个 key 比较，
 * 只要 user 内容包含某个 key，就返回对应的预设回复；都不匹配则回显。
 */
export function createMockProvider(cfg: ProviderConfig): Provider {
  const table = cfg.mockResponses ?? {};
  return {
    label: `mock(${cfg.model})`,
    async complete(messages: ChatMessage[]): Promise<string> {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const content = lastUser?.content ?? "";
      for (const [key, reply] of Object.entries(table)) {
        if (key && content.includes(key)) return reply;
      }
      return table["__default__"] ?? `（mock 回显）${content}`;
    },
  };
}
