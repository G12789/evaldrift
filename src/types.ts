export type ProviderType = "openai" | "anthropic" | "ollama" | "mock";

export interface ProviderConfig {
  /** openai 同时覆盖所有 OpenAI 兼容接口：DeepSeek / Kimi / 通义 / 豆包 等 */
  type: ProviderType;
  model: string;
  /** OpenAI 兼容接口的 baseUrl，例如 https://api.deepseek.com/v1 */
  baseUrl?: string;
  /** 从哪个环境变量读取 API Key（不要把密钥写进配置文件） */
  apiKeyEnv?: string;
  temperature?: number;
  maxTokens?: number;
  /** mock provider 专用：预设回复，按 test 名或顺序匹配 */
  mockResponses?: Record<string, string>;
}

export type AssertionType =
  | "contains"
  | "not-contains"
  | "regex"
  | "json-schema"
  | "llm-judge";

export interface Assertion {
  type: AssertionType;
  /** contains / not-contains / regex 的目标值 */
  value?: string | string[];
  /** json-schema 的 schema 对象 */
  schema?: Record<string, unknown>;
  /** llm-judge 的评分标准（中文描述即可） */
  rubric?: string;
  /** llm-judge 通过阈值（0..1），默认 0.6 */
  threshold?: number;
  /** 权重，默认 1 */
  weight?: number;
}

export interface TestCase {
  name: string;
  vars?: Record<string, string | number | boolean>;
  assert?: Assertion[];
}

export interface PromptConfig {
  system?: string;
  user: string;
}

export interface Config {
  provider: ProviderConfig;
  /** llm-judge 用的裁判模型，缺省复用 provider */
  judge?: ProviderConfig;
  prompt: PromptConfig;
  tests: TestCase[];
  defaultAssert?: Assertion[];
}

export interface AssertionResult {
  type: AssertionType;
  pass: boolean;
  /** 0..1 */
  score: number;
  weight: number;
  message: string;
}

export interface TestResult {
  name: string;
  vars: Record<string, string | number | boolean>;
  output: string;
  latencyMs: number;
  error?: string;
  assertions: AssertionResult[];
  pass: boolean;
  /** 加权平均分 0..1 */
  score: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  avgScore: number;
}

export interface RunResult {
  schemaVersion: 1;
  timestamp: string;
  provider: { type: ProviderType; model: string };
  summary: RunSummary;
  tests: TestResult[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Provider {
  readonly label: string;
  complete(messages: ChatMessage[]): Promise<string>;
}
