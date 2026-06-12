import type { RunResult } from "../types.js";
import type { DriftReport, TestDrift } from "../baseline.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function driftBadge(d?: TestDrift): string {
  if (!d) return "";
  const map: Record<string, [string, string]> = {
    regression: ["退化", "reg"],
    improvement: ["改进", "imp"],
    new: ["新增", "new"],
    removed: ["移除", "rm"],
    same: ["", ""],
  };
  const [label, cls] = map[d.kind] ?? ["", ""];
  if (!label) return "";
  const delta =
    d.curScore !== undefined && d.baseScore !== undefined
      ? ` ${(d.delta * 100 > 0 ? "+" : "")}${(d.delta * 100).toFixed(0)}%`
      : "";
  return `<span class="badge ${cls}">${label}${delta}</span>`;
}

export function renderHtml(run: RunResult, drift: DriftReport): string {
  const driftMap = new Map(drift.drifts.map((d) => [d.name, d]));
  const s = run.summary;
  const rows = run.tests
    .map((t) => {
      const d = driftMap.get(t.name);
      const asserts = t.error
        ? `<div class="err">错误: ${esc(t.error)}</div>`
        : t.assertions
            .map(
              (a) =>
                `<div class="assert ${a.pass ? "ok" : "bad"}"><span>${a.pass ? "✓" : "✗"}</span> <code>${a.type}</code> ${esc(a.message)}</div>`,
            )
            .join("") || `<div class="assert dim">无断言（仅冒烟）</div>`;
      return `
      <tr class="${t.pass ? "pass" : "fail"}">
        <td class="mark">${t.pass ? "✓" : "✗"}</td>
        <td class="name">${esc(t.name)} ${driftBadge(d)}</td>
        <td class="score"><div class="sbar"><i style="width:${Math.round(t.score * 100)}%"></i></div>${(t.score * 100).toFixed(0)}%</td>
        <td class="lat">${t.latencyMs}ms</td>
      </tr>
      <tr class="detail ${t.pass ? "pass" : "fail"}">
        <td></td>
        <td colspan="3">
          ${asserts}
          <details><summary>模型输出</summary><pre>${esc(t.output)}</pre></details>
        </td>
      </tr>`;
    })
    .join("");

  const driftLine = drift.hasBaseline
    ? `<span class="${drift.regressions > 0 ? "reg" : "imp"}">${drift.regressions} 处退化</span> · <span class="imp">${drift.improvements} 处改进</span>`
    : `<span class="dim">无基线</span>`;

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>promptdrift 报告 · ${esc(run.provider.model)}</title>
<style>
  :root { --ok:#16a34a; --bad:#dc2626; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--ink);padding:32px;line-height:1.5}
  .wrap{max-width:980px;margin:0 auto}
  h1{font-size:20px;font-weight:800}
  .meta{color:var(--muted);font-size:13px;margin-top:4px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
  .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .card .n{font-size:26px;font-weight:800}
  .card .l{font-size:12px;color:var(--muted);margin-top:2px}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tr.pass .mark{color:var(--ok)} tr.fail .mark{color:var(--bad)}
  .mark{font-weight:800;width:28px;text-align:center}
  .name{font-weight:700}
  .score{width:140px;font-variant-numeric:tabular-nums;color:var(--muted)}
  .sbar{height:6px;background:var(--line);border-radius:99px;overflow:hidden;margin-bottom:4px}
  .sbar i{display:block;height:100%;background:var(--ok)}
  tr.fail .sbar i{background:var(--bad)}
  .lat{width:80px;color:var(--muted);font-size:13px}
  tr.detail td{padding-top:0;border-bottom:1px solid var(--line)}
  .assert{font-size:13px;margin:3px 0}
  .assert.ok{color:var(--ok)} .assert.bad{color:var(--bad)} .assert.dim{color:var(--muted)}
  .assert code{background:#f1f5f9;padding:1px 6px;border-radius:5px;color:var(--ink)}
  details{margin-top:6px} summary{cursor:pointer;color:var(--muted);font-size:13px}
  pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;margin-top:6px;white-space:pre-wrap;word-break:break-word;font-size:12px;max-height:320px;overflow:auto}
  .err{color:var(--bad);font-size:13px}
  .badge{font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;margin-left:6px}
  .badge.reg{background:#fee2e2;color:#b91c1c} .badge.imp{background:#dcfce7;color:#15803d}
  .badge.new{background:#e0f2fe;color:#0369a1} .badge.rm{background:#f1f5f9;color:#64748b}
  .reg{color:var(--bad);font-weight:700} .imp{color:var(--ok);font-weight:700} .dim{color:var(--muted)}
  footer{color:var(--muted);font-size:12px;text-align:center;margin-top:20px}
</style></head>
<body><div class="wrap">
  <h1>promptdrift 报告</h1>
  <div class="meta">${esc(run.provider.type)} / ${esc(run.provider.model)} · ${esc(run.timestamp)}</div>
  <div class="cards">
    <div class="card"><div class="n">${s.passed}/${s.total}</div><div class="l">通过</div></div>
    <div class="card"><div class="n" style="color:${s.failed ? "var(--bad)" : "var(--ok)"}">${s.failed}</div><div class="l">失败</div></div>
    <div class="card"><div class="n">${(s.avgScore * 100).toFixed(0)}%</div><div class="l">平均分</div></div>
    <div class="card"><div class="n" style="font-size:15px;padding-top:8px">${driftLine}</div><div class="l">对比基线</div></div>
  </div>
  <table><tbody>${rows}</tbody></table>
  <footer>Generated by promptdrift</footer>
</div></body></html>`;
}
