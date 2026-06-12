#!/usr/bin/env node
/**
 * CI 冒烟测试：不依赖任何 API Key。
 * 1) example 配置全绿
 * 2) 锁定基线后故意改坏 prompt，能检出退化且退出码非 0
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
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
const EXAMPLE = join(ROOT, "examples", "customer-service", "evaldrift.config.yaml");

function run(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: r.status ?? 1,
    out: (r.stdout || "") + (r.stderr || ""),
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// ── 1. example 应全绿 ──
console.log("▶ example 配置 run …");
const ex = run(["run", "-c", EXAMPLE]);
console.log(ex.out);
assert(ex.code === 0, `example run 应退出 0，实际 ${ex.code}`);

// ── 2. 临时目录：基线 → 改坏 → 检出退化 ──
const tmp = join(ROOT, ".ci-smoke-tmp");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const cfg = join(tmp, "evaldrift.config.yaml");
copyFileSync(EXAMPLE, cfg);

console.log("▶ 锁定基线 …");
const bl = run(["baseline", "-c", cfg], tmp);
assert(bl.code === 0, "baseline 应成功");

// 把退款回复里的「工作日」删掉，触发 contains 断言失败
const broken = readFileSync(cfg, "utf8").replace(
  "款项 1-3 个工作日原路退回。",
  "请自行联系客服处理。",
);
writeFileSync(cfg, broken, "utf8");

console.log("▶ 改坏后 run（应检出退化）…");
const bad = run(["run", "-c", cfg, "--fail-on", "regression"], tmp);
console.log(bad.out);
assert(bad.code !== 0, "退化场景应退出非 0");
assert(bad.out.includes("退化"), "输出应包含「退化」");

rmSync(tmp, { recursive: true, force: true });
console.log("\n✓ CI smoke 全部通过");
