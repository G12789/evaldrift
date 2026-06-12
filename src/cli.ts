#!/usr/bin/env node
import { parseArgs } from "node:util";
import { writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { findConfig, loadConfig, CONFIG_NAMES } from "./config.js";
import { runConfig } from "./runner.js";
import type { RunResult } from "./types.js";
import { saveBaseline, loadBaseline, diffAgainstBaseline } from "./baseline.js";
import { printRun } from "./report/terminal.js";
import { renderHtml } from "./report/html.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const VERSION = "0.1.0";

function help(): void {
  console.log(`
${pc.bold("evaldrift")} — 给 LLM prompt / agent 做快照式回归测试，改提示词时第一时间发现质量退化。
国产模型 & 中文优先（DeepSeek / Kimi / 通义 / 豆包 / Ollama）。

用法:
  evaldrift init                 在当前目录生成可直接跑的配置模板
  evaldrift run [选项]           跑测试并对比基线
  evaldrift baseline [选项]      跑一次并把结果锁定为基线

run / baseline 选项:
  -c, --config <path>   指定配置文件（默认自动查找）
      --html <path>     额外输出自包含 HTML 报告
      --json <path>     额外输出 JSON 结果
      --update-baseline run 跑完顺便更新基线
      --fail-on <mode>  CI 退出码策略: any(默认) | regression | none

其他:
  -h, --help            显示帮助
  -v, --version         显示版本
`);
}

async function cmdInit(): Promise<void> {
  const target = resolve(process.cwd(), CONFIG_NAMES[0]);
  if (existsSync(target)) {
    console.log(pc.yellow(`已存在 ${CONFIG_NAMES[0]}，未覆盖。`));
    return;
  }
  const tpl = join(PKG_ROOT, "templates", "evaldrift.config.yaml");
  if (existsSync(tpl)) {
    copyFileSync(tpl, target);
  } else {
    writeFileSync(target, FALLBACK_TEMPLATE, "utf8");
  }
  console.log(pc.green(`已生成 ${CONFIG_NAMES[0]}`));
  console.log(pc.dim("它默认用离线 mock 模型，直接 `evaldrift run` 就能看到效果。"));
  console.log(pc.dim("改成真实模型：把 provider.type 换成 openai，填 baseUrl / model / apiKeyEnv。"));
}

interface RunOpts {
  config?: string;
  html?: string;
  json?: string;
  updateBaseline: boolean;
  failOn: "any" | "regression" | "none";
}

async function cmdRun(opts: RunOpts, asBaseline: boolean): Promise<number> {
  const configPath = findConfig(process.cwd(), opts.config);
  const config = loadConfig(configPath);
  const run = await runConfig(config);

  if (asBaseline) {
    const p = saveBaseline(run);
    console.log(pc.green(`已把当前结果锁定为基线: ${p}`));
    const empty = diffAgainstBaseline(run, undefined);
    printRun(run, empty);
    writeArtifacts(run, opts);
    return 0;
  }

  const baseline = loadBaseline();
  const drift = diffAgainstBaseline(run, baseline);
  printRun(run, drift);
  writeArtifacts(run, opts);

  if (opts.updateBaseline) {
    const p = saveBaseline(run);
    console.log(pc.dim(`基线已更新: ${p}`));
  }

  if (opts.failOn === "none") return 0;
  if (opts.failOn === "regression") return drift.regressions > 0 ? 1 : 0;
  return run.summary.failed > 0 || drift.regressions > 0 ? 1 : 0;
}

function writeArtifacts(run: RunResult, opts: RunOpts): void {
  if (opts.json) {
    const p = resolve(process.cwd(), opts.json);
    writeFileSync(p, JSON.stringify(run, null, 2), "utf8");
    console.log(pc.dim(`JSON 已写入: ${p}`));
  }
  if (opts.html) {
    const baseline = loadBaseline();
    const drift = diffAgainstBaseline(run, baseline);
    const p = resolve(process.cwd(), opts.html);
    writeFileSync(p, renderHtml(run, drift), "utf8");
    console.log(pc.dim(`HTML 报告已写入: ${p}`));
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "-h" || command === "--help" || command === "help") {
    help();
    return;
  }
  if (command === "-v" || command === "--version") {
    console.log(VERSION);
    return;
  }

  const { values } = parseArgs({
    args: argv.slice(1),
    options: {
      config: { type: "string", short: "c" },
      html: { type: "string" },
      json: { type: "string" },
      "update-baseline": { type: "boolean", default: false },
      "fail-on": { type: "string", default: "any" },
    },
    allowPositionals: true,
  });

  const failOn = (values["fail-on"] as string) || "any";
  if (!["any", "regression", "none"].includes(failOn)) {
    console.error(pc.red(`--fail-on 只能是 any | regression | none`));
    process.exit(2);
  }

  const opts: RunOpts = {
    config: values.config as string | undefined,
    html: values.html as string | undefined,
    json: values.json as string | undefined,
    updateBaseline: Boolean(values["update-baseline"]),
    failOn: failOn as RunOpts["failOn"],
  };

  switch (command) {
    case "init":
      await cmdInit();
      break;
    case "run":
      process.exit(await cmdRun(opts, false));
      break;
    case "baseline":
      process.exit(await cmdRun(opts, true));
      break;
    default:
      console.error(pc.red(`未知命令: ${command}`));
      help();
      process.exit(2);
  }
}

const FALLBACK_TEMPLATE = `provider:
  type: mock
  model: demo
  mockResponses:
    退款: "您好，关于退款：支持 7 天无理由退款，请在订单页点击申请，1-3 个工作日到账。"
    几点: "我们每天 09:00-22:00 营业，节假日正常。"

prompt:
  system: "你是一个礼貌专业的中文客服。"
  user: "{{question}}"

tests:
  - name: 退款问题
    vars: { question: "我要退款怎么办" }
    assert:
      - type: contains
        value: ["退款", "工作日"]
  - name: 营业时间
    vars: { question: "你们几点开门" }
    assert:
      - type: contains
        value: "09:00"
`;

main().catch((e) => {
  console.error(pc.red((e as Error).message));
  process.exit(1);
});
