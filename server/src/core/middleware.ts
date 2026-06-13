import { IncomingMessage, ServerResponse } from "node:http";
import { parseUrl } from "../utils/http.js";

export type NextFunction = () => Promise<void>;
export type Middleware = (req: IncomingMessage, res: ServerResponse, url: URL, next: NextFunction) => Promise<void>;

export function corsMiddleware(req: IncomingMessage, res: ServerResponse, _url: URL, next: NextFunction): Promise<void> {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return Promise.resolve();
  }
  return next();
}

export function loggingMiddleware(req: IncomingMessage, res: ServerResponse, url: URL, next: NextFunction): Promise<void> {
  const start = Date.now();
  const method = req.method || "GET";
  const pathname = url.pathname;
  console.log(`→ ${method} ${pathname}`);
  return next().then(() => {
    const duration = Date.now() - start;
    console.log(`← ${res.statusCode} ${method} ${pathname} (${duration}ms)`);
  });
}

export function errorMiddleware(req: IncomingMessage, res: ServerResponse, _url: URL, next: NextFunction): Promise<void> {
  return next().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${req.method} ${req.url}: ${message}`);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: message }));
    }
  });
}

export async function runMiddleware(
  middlewares: Middleware[],
  req: IncomingMessage,
  res: ServerResponse,
  finalHandler: () => Promise<void>,
): Promise<void> {
  const url = parseUrl(req);
  let index = 0;
  async function next(): Promise<void> {
    if (index < middlewares.length) {
      const mw = middlewares[index++];
      await mw(req, res, url, next);
    } else {
      await finalHandler();
    }
  }
  await next();
}
