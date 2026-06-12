#!/usr/bin/env node
/**
 * 生成 README 用的 demo 截图：
 *   docs/demo-terminal.png  — 终端退化检测
 *   docs/demo-report.png    — HTML 报告
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CLI = join(ROOT, "dist", "cli.js");
const DOCS = join(ROOT, "docs");
const EXAMPLE = join(ROOT, "examples", "customer-service", "evaldrift.config.yaml");

function run(args, cwd) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (r.status !== 0 && r.status !== 1) process.exit(r.status ?? 1);
  return r.status ?? 0;
}

mkdirSync(DOCS, { recursive: true });

// 终端样式 HTML（基于真实 run 输出手工对齐）
const terminalHtml = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;padding:28px;font-family:ui-monospace,"Cascadia Code","SF Mono",Consolas,monospace}
  .win{background:#161b22;border:1px solid #30363d;border-radius:10px;overflow:hidden;max-width:820px;box-shadow:0 16px 48px rgba(0,0,0,.45)}
  .bar{background:#21262d;padding:10px 14px;display:flex;gap:7px;border-bottom:1px solid #30363d}
  .dot{width:12px;height:12px;border-radius:50%}
  .r{background:#ff5f57}.y{background:#febc2e}.g{background:#28c840}
  pre{padding:20px 22px 24px;color:#e6edf3;font-size:13.5px;line-height:1.55;white-space:pre-wrap}
  .dim{color:#8b949e}.ok{color:#3fb950;font-weight:700}.bad{color:#f85149;font-weight:700}
  .hl{color:#ffa657;font-weight:700}.title{color:#58a6ff;font-weight:700}
  .bar2{color:#8b949e}
</style></head><body>
<div class="win">
  <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
  <pre><span class="title">evaldrift</span> <span class="dim">· mock/demo</span>
<span class="dim">────────────────────────────────────────────────────────</span>
<span class="bad">✗</span> 退款流程  <span class="bar2">░░░░░░░░░░</span>   <span class="bad">0%</span>  <span class="dim">1ms</span>
    <span class="bad">✗ [contains] 缺少关键词: 工作日</span>
<span class="ok">✓</span> 开发票  <span class="bar2">██████████</span> <span class="ok">100%</span>  <span class="dim">0ms</span>
<span class="ok">✓</span> 营业时间  <span class="bar2">██████████</span> <span class="ok">100%</span>  <span class="dim">0ms</span>
<span class="ok">✓</span> 情绪安抚（裁判打分）  <span class="bar2">█████████░</span>  <span class="ok">90%</span>  <span class="dim">0ms</span>
<span class="dim">────────────────────────────────────────────────────────</span>
<span class="bad">1 个失败</span>  <span class="dim">3/4 通过 · 平均分 73%</span>

<span class="hl">对比基线：</span>
  <span class="bad">↓ 退化 退款流程  100% → 0% (-100%) [通过→失败]</span>

<span class="bad">1 处退化</span> <span class="dim">· 0 处改进</span>
<span class="dim">HTML 报告已写入: report.html</span></pre>
</div></body></html>`;

writeFileSync(join(DOCS, "demo-terminal.html"), terminalHtml, "utf8");

// 生成真实 HTML 报告（退化场景）
const tmp = join(ROOT, ".demo-tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const cfg = join(tmp, "evaldrift.config.yaml");
copyFileSync(EXAMPLE, cfg);
run(["baseline", "-c", cfg], tmp);
const broken = readFileSync(cfg, "utf8").replace(
  "款项 1-3 个工作日原路退回。",
  "请自行联系客服处理。",
);
writeFileSync(cfg, broken, "utf8");
run(["run", "-c", cfg, "--html", join(DOCS, "demo-report.html"), "--fail-on", "none"], tmp);
rmSync(tmp, { recursive: true, force: true });

// Playwright 截图（有则用，没有就保留 HTML）
const termPng = join(DOCS, "demo-terminal.png");
const reportPng = join(DOCS, "demo-report.png");

try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 520 }, deviceScaleFactor: 2 });
  await page.goto(`file:///${join(DOCS, "demo-terminal.html").replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: termPng });
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`file:///${join(DOCS, "demo-report.html").replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: reportPng, fullPage: true });
  await browser.close();
  console.log("✓ 截图:", termPng);
  console.log("✓ 截图:", reportPng);
} catch {
  console.log("⚠ 未安装 playwright，仅生成 HTML demo（可手动截图）");
  console.log("  ", join(DOCS, "demo-terminal.html"));
  console.log("  ", join(DOCS, "demo-report.html"));
}
