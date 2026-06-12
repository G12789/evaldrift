/** 把 "{{name}}" 占位符替换成 vars 里的值；缺失的占位符替换为空串。 */
export function renderTemplate(
  tpl: string,
  vars: Record<string, string | number | boolean> = {},
): string {
  return tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function readApiKey(envName?: string): string | undefined {
  if (!envName) return undefined;
  return process.env[envName];
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
