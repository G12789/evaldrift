import type {
  Config,
  RunResult,
  TestResult,
  AssertionResult,
  ChatMessage,
} from "./types.js";
import { createProvider } from "./providers/index.js";
import { runAssertion, type ScorerContext } from "./scorers/index.js";
import { renderTemplate } from "./util.js";

function weightedScore(results: AssertionResult[]): number {
  if (results.length === 0) return 1;
  const totalW = results.reduce((s, r) => s + r.weight, 0) || 1;
  return results.reduce((s, r) => s + r.score * r.weight, 0) / totalW;
}

export async function runConfig(config: Config): Promise<RunResult> {
  const provider = createProvider(config.provider);
  const judge = config.judge ? createProvider(config.judge) : provider;
  const ctx: ScorerContext = { judge };

  const tests: TestResult[] = [];
  for (const tc of config.tests) {
    const vars = tc.vars ?? {};
    const messages: ChatMessage[] = [];
    if (config.prompt.system) {
      messages.push({ role: "system", content: renderTemplate(config.prompt.system, vars) });
    }
    messages.push({ role: "user", content: renderTemplate(config.prompt.user, vars) });

    const assertions = [...(config.defaultAssert ?? []), ...(tc.assert ?? [])];
    const started = Date.now();
    let output = "";
    let error: string | undefined;
    try {
      output = await provider.complete(messages);
    } catch (e) {
      error = (e as Error).message;
    }
    const latencyMs = Date.now() - started;

    let assertionResults: AssertionResult[] = [];
    if (!error) {
      for (const a of assertions) {
        assertionResults.push(await runAssertion(output, a, ctx));
      }
    }

    const pass = !error && assertionResults.every((r) => r.pass);
    const score = error ? 0 : weightedScore(assertionResults);
    tests.push({ name: tc.name, vars, output, latencyMs, error, assertions: assertionResults, pass, score });
  }

  const passed = tests.filter((t) => t.pass).length;
  const avgScore = tests.length ? tests.reduce((s, t) => s + t.score, 0) / tests.length : 0;

  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    provider: { type: config.provider.type, model: config.provider.model },
    summary: { total: tests.length, passed, failed: tests.length - passed, avgScore },
    tests,
  };
}
