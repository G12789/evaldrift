import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { RunResult } from "./types.js";

export const ARTIFACT_DIR = ".evaldrift";
export const BASELINE_FILE = "baseline.json";

export function baselinePath(cwd = process.cwd()): string {
  return resolve(cwd, ARTIFACT_DIR, BASELINE_FILE);
}

export function saveBaseline(run: RunResult, cwd = process.cwd()): string {
  const p = baselinePath(cwd);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(run, null, 2), "utf8");
  return p;
}

export function loadBaseline(cwd = process.cwd()): RunResult | undefined {
  const p = baselinePath(cwd);
  if (!existsSync(p)) return undefined;
  return JSON.parse(readFileSync(p, "utf8")) as RunResult;
}

export type DriftKind = "regression" | "improvement" | "same" | "new" | "removed";

export interface TestDrift {
  name: string;
  kind: DriftKind;
  baseScore?: number;
  curScore?: number;
  basePass?: boolean;
  curPass?: boolean;
  delta: number;
}

export interface DriftReport {
  hasBaseline: boolean;
  regressions: number;
  improvements: number;
  drifts: TestDrift[];
}

const EPS = 0.01;

export function diffAgainstBaseline(
  current: RunResult,
  baseline?: RunResult,
): DriftReport {
  if (!baseline) {
    return { hasBaseline: false, regressions: 0, improvements: 0, drifts: [] };
  }
  const baseMap = new Map(baseline.tests.map((t) => [t.name, t]));
  const curMap = new Map(current.tests.map((t) => [t.name, t]));
  const drifts: TestDrift[] = [];

  for (const cur of current.tests) {
    const base = baseMap.get(cur.name);
    if (!base) {
      drifts.push({ name: cur.name, kind: "new", curScore: cur.score, curPass: cur.pass, delta: 0 });
      continue;
    }
    const delta = cur.score - base.score;
    let kind: DriftKind = "same";
    // pass->fail 永远算退化；fail->pass 算改进；否则看分数变化
    if (base.pass && !cur.pass) kind = "regression";
    else if (!base.pass && cur.pass) kind = "improvement";
    else if (delta < -EPS) kind = "regression";
    else if (delta > EPS) kind = "improvement";
    drifts.push({
      name: cur.name,
      kind,
      baseScore: base.score,
      curScore: cur.score,
      basePass: base.pass,
      curPass: cur.pass,
      delta,
    });
  }
  for (const base of baseline.tests) {
    if (!curMap.has(base.name)) {
      drifts.push({ name: base.name, kind: "removed", baseScore: base.score, basePass: base.pass, delta: 0 });
    }
  }

  return {
    hasBaseline: true,
    regressions: drifts.filter((d) => d.kind === "regression").length,
    improvements: drifts.filter((d) => d.kind === "improvement").length,
    drifts,
  };
}
