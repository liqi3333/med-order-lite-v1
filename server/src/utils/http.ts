import { IncomingMessage, ServerResponse } from "node:http";

export interface JsonResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

export function sendJson(res: ServerResponse, data: unknown, options: JsonResponseOptions = {}): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(options.status || 200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(options.headers || {})
  });
  res.end(body);
}

export function sendText(res: ServerResponse, data: string, status = 200): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(data);
}

export async function readRequestBody<T = unknown>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("请求体必须是合法 JSON");
  }
}

export function parseUrl(req: IncomingMessage): URL {
  const host = req.headers.host || "localhost";
  return new URL(req.url || "/", `http://${host}`);
}
