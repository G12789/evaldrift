import type { Provider, ProviderConfig } from "../types.js";
import { createOpenAIProvider } from "./openai.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOllamaProvider } from "./ollama.js";
import { createMockProvider } from "./mock.js";

export function createProvider(cfg: ProviderConfig): Provider {
  switch (cfg.type) {
    case "openai":
      return createOpenAIProvider(cfg);
    case "anthropic":
      return createAnthropicProvider(cfg);
    case "ollama":
      return createOllamaProvider(cfg);
    case "mock":
      return createMockProvider(cfg);
    default:
      throw new Error(`未知的 provider.type: ${(cfg as ProviderConfig).type}`);
  }
}
