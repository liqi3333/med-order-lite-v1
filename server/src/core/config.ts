import path from "node:path";

export interface AppConfig {
  port: number;
  kbRoot: string;
}

export function getConfig(): AppConfig {
  const cwd = process.cwd();
  return {
    port: Number(process.env.PORT || 8787),
    kbRoot: path.resolve(cwd, process.env.KB_ROOT || "./kb")
  };
}
