import AjvImport from "ajv";
import type {
  Assertion,
  AssertionResult,
  Provider,
} from "../types.js";
import { clamp01 } from "../util.js";

// ajv 是 CommonJS 包，在 NodeNext ESM 下默认导出可能被包一层 .default
const Ajv = ((AjvImport as unknown as { default?: unknown }).default ??
  AjvImport) as new (opts?: Record<string, unknown>) => {
  compile: (schema: unknown) => ((data: unknown) => boolean) & { errors?: unknown };
  errorsText: (errors?: unknown) => string;
};

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ScorerContext {
  judge?: Provider;
}

function toArray(v?: string | string[]): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function tryExtractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // 从混合文本里抠出第一个 JSON 块
    const match = text.match(/[{[][\s\S]*[}\]]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

async function scoreContains(output: string, a: Assertion): Promise<AssertionResult> {
  const needles = toArray(a.value);
  const missing = needles.filter((n) => !output.includes(n));
  const pass = missing.length === 0;
  return {
    type: "contains",
    pass,
    score: pass ? 1 : 0,
    weight: a.weight ?? 1,
    message: pass
      ? `包含全部关键词: ${needles.join(", ")}`
      : `缺少关键词: ${missing.join(", ")}`,
  };
}

async function scoreNotContains(output: string, a: Assertion): Promise<AssertionResult> {
  const needles = toArray(a.value);
  const found = needles.filter((n) => output.includes(n));
  const pass = found.length === 0;
  return {
    type: "not-contains",
    pass,
    score: pass ? 1 : 0,
    weight: a.weight ?? 1,
    message: pass ? `未出现禁止词` : `出现了禁止词: ${found.join(", ")}`,
  };
}

async function scoreRegex(output: string, a: Assertion): Promise<AssertionResult> {
  const pattern = Array.isArray(a.value) ? a.value[0] : a.value;
  if (!pattern) {
    return failResult("regex", a, "regex 断言缺少 value（正则表达式）");
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, "s");
  } catch (e) {
    return failResult("regex", a, `正则无效: ${(e as Error).message}`);
  }
  const pass = re.test(output);
  return {
    type: "regex",
    pass,
    score: pass ? 1 : 0,
    weight: a.weight ?? 1,
    message: pass ? `匹配正则 /${pattern}/` : `不匹配正则 /${pattern}/`,
  };
}

async function scoreJsonSchema(output: string, a: Assertion): Promise<AssertionResult> {
  if (!a.schema) return failResult("json-schema", a, "json-schema 断言缺少 schema");
  const parsed = tryExtractJson(output);
  if (parsed === undefined) {
    return failResult("json-schema", a, "输出不是合法 JSON / 抠不出 JSON 块");
  }
  const validateFn = ajv.compile(a.schema);
  const ok = validateFn(parsed);
  return {
    type: "json-schema",
    pass: ok,
    score: ok ? 1 : 0,
    weight: a.weight ?? 1,
    message: ok
      ? "JSON 符合 schema"
      : `JSON 校验失败: ${ajv.errorsText(validateFn.errors)}`,
  };
}

async function scoreLlmJudge(
  output: string,
  a: Assertion,
  ctx: ScorerContext,
): Promise<AssertionResult> {
  if (!a.rubric) return failResult("llm-judge", a, "llm-judge 断言缺少 rubric（评分标准）");
  if (!ctx.judge) return failResult("llm-judge", a, "没有可用的裁判模型（judge）");
  const threshold = a.threshold ?? 0.6;
  const raw = await ctx.judge.complete([
    {
      role: "system",
      content:
        "你是一个严格、客观的中文评测员。根据【评分标准】给【待评测输出】打分。" +
        '只输出一个 JSON，不要解释：{"score": 0到1之间的小数, "reason": "简短理由"}。',
    },
    {
      role: "user",
      content: `【评分标准】\n${a.rubric}\n\n【待评测输出】\n"""\n${output}\n"""`,
    },
  ]);
  const parsed = tryExtractJson(raw) as { score?: number; reason?: string } | undefined;
  const score = clamp01(Number(parsed?.score));
  const pass = score >= threshold;
  return {
    type: "llm-judge",
    pass,
    score,
    weight: a.weight ?? 1,
    message: `裁判打分 ${score.toFixed(2)}（阈值 ${threshold}）${parsed?.reason ? " · " + parsed.reason : ""}`,
  };
}

function failResult(
  type: AssertionResult["type"],
  a: Assertion,
  message: string,
): AssertionResult {
  return { type, pass: false, score: 0, weight: a.weight ?? 1, message };
}

export async function runAssertion(
  output: string,
  a: Assertion,
  ctx: ScorerContext,
): Promise<AssertionResult> {
  switch (a.type) {
    case "contains":
      return scoreContains(output, a);
    case "not-contains":
      return scoreNotContains(output, a);
    case "regex":
      return scoreRegex(output, a);
    case "json-schema":
      return scoreJsonSchema(output, a);
    case "llm-judge":
      return scoreLlmJudge(output, a, ctx);
    default:
      return failResult("contains", a, `未知断言类型: ${(a as Assertion).type}`);
  }
}
