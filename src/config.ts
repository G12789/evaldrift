import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";
import type { Config } from "./types.js";

export const CONFIG_NAMES = [
  "promptdrift.config.yaml",
  "promptdrift.config.yml",
  "promptdrift.config.json",
];

export function findConfig(cwd = process.cwd(), explicit?: string): string {
  if (explicit) {
    const p = resolve(cwd, explicit);
    if (!existsSync(p)) throw new Error(`找不到配置文件: ${p}`);
    return p;
  }
  for (const name of CONFIG_NAMES) {
    const p = resolve(cwd, name);
    if (existsSync(p)) return p;
  }
  throw new Error(
    `当前目录没有配置文件（${CONFIG_NAMES.join(" / ")}）。先运行: promptdrift init`,
  );
}

export function loadConfig(path: string): Config {
  const raw = readFileSync(path, "utf8");
  const data = path.endsWith(".json")
    ? JSON.parse(raw)
    : YAML.parse(raw);
  return validate(data, path);
}

function validate(data: unknown, path: string): Config {
  if (typeof data !== "object" || data === null) {
    throw new Error(`配置文件格式错误: ${path}`);
  }
  const cfg = data as Partial<Config>;
  if (!cfg.provider || typeof cfg.provider !== "object") {
    throw new Error("配置缺少 provider 段");
  }
  if (!cfg.provider.type) throw new Error("provider.type 不能为空");
  if (!cfg.provider.model) throw new Error("provider.model 不能为空");
  if (!cfg.prompt || typeof cfg.prompt.user !== "string") {
    throw new Error("配置缺少 prompt.user（用户提示词模板）");
  }
  if (!Array.isArray(cfg.tests) || cfg.tests.length === 0) {
    throw new Error("配置缺少 tests（至少一个测试用例）");
  }
  for (const [i, t] of cfg.tests.entries()) {
    if (!t || typeof t.name !== "string") {
      throw new Error(`tests[${i}] 缺少 name`);
    }
  }
  return cfg as Config;
}
