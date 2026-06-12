import pc from "picocolors";
import type { RunResult } from "../types.js";
import type { DriftReport } from "../baseline.js";

function bar(score: number, width = 10): string {
  const filled = Math.round(score * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function printRun(run: RunResult, drift: DriftReport): void {
  console.log("");
  console.log(pc.bold(`evaldrift · ${run.provider.type}/${run.provider.model}`));
  console.log(pc.dim("─".repeat(56)));

  for (const t of run.tests) {
    const mark = t.pass ? pc.green("✓") : pc.red("✗");
    const scoreStr = t.error ? pc.red("ERR") : `${(t.score * 100).toFixed(0).padStart(3)}%`;
    console.log(`${mark} ${pc.bold(t.name)}  ${pc.dim(bar(t.error ? 0 : t.score))} ${scoreStr}  ${pc.dim(t.latencyMs + "ms")}`);
    if (t.error) {
      console.log(pc.red(`    错误: ${t.error}`));
      continue;
    }
    for (const a of t.assertions) {
      if (!a.pass) console.log(pc.red(`    ✗ [${a.type}] ${a.message}`));
    }
  }

  console.log(pc.dim("─".repeat(56)));
  const s = run.summary;
  const head = s.failed === 0 ? pc.green(pc.bold("全部通过")) : pc.red(pc.bold(`${s.failed} 个失败`));
  console.log(`${head}  ${s.passed}/${s.total} 通过 · 平均分 ${(s.avgScore * 100).toFixed(0)}%`);

  if (drift.hasBaseline) {
    console.log("");
    if (drift.regressions === 0 && drift.improvements === 0) {
      console.log(pc.dim("对比基线：无明显变化"));
    } else {
      console.log(pc.bold("对比基线："));
      for (const d of drift.drifts) {
        if (d.kind === "regression") {
          console.log(pc.red(`  ↓ 退化 ${d.name}  ${fmtDelta(d)}`));
        } else if (d.kind === "improvement") {
          console.log(pc.green(`  ↑ 改进 ${d.name}  ${fmtDelta(d)}`));
        } else if (d.kind === "new") {
          console.log(pc.cyan(`  + 新增 ${d.name}`));
        } else if (d.kind === "removed") {
          console.log(pc.dim(`  - 移除 ${d.name}`));
        }
      }
      console.log("");
      console.log(
        `${drift.regressions > 0 ? pc.red(drift.regressions + " 处退化") : pc.green("0 退化")} · ${pc.green(drift.improvements + " 处改进")}`,
      );
    }
  } else {
    console.log(pc.dim("（无基线，运行 `evaldrift baseline` 锁定当前结果作为基线）"));
  }
  console.log("");
}

function fmtDelta(d: { baseScore?: number; curScore?: number; basePass?: boolean; curPass?: boolean; delta: number }): string {
  const passInfo =
    d.basePass !== d.curPass ? ` [${d.basePass ? "通过" : "失败"}→${d.curPass ? "通过" : "失败"}]` : "";
  const pct = (d.delta * 100).toFixed(0);
  const sign = d.delta > 0 ? "+" : "";
  return `${(d.baseScore! * 100).toFixed(0)}% → ${(d.curScore! * 100).toFixed(0)}% (${sign}${pct}%)${passInfo}`;
}
