import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPort = Number(process.env.WEB_PORT || 5173);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"]
]);

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  res.end(body);
}

function resolveStaticPath(requestUrl) {
  const parsed = new URL(requestUrl || "/", `http://localhost:${webPort}`);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  const fullPath = path.resolve(root, `.${pathname}`);
  if (!fullPath.startsWith(root)) return null;
  if (existsSync(fullPath) && statSync(fullPath).isDirectory()) return path.join(fullPath, "index.html");
  if (existsSync(fullPath)) return fullPath;
  const publicPath = path.resolve(root, "public", `.${pathname}`);
  if (!publicPath.startsWith(path.join(root, "public"))) return null;
  if (existsSync(publicPath) && statSync(publicPath).isDirectory()) return path.join(publicPath, "index.html");
  return publicPath;
}

const webServer = http.createServer((req, res) => {
  const fullPath = resolveStaticPath(req.url);
  if (!fullPath || !existsSync(fullPath)) {
    send(res, 404, "Not found");
    return;
  }
  const ext = path.extname(fullPath).toLowerCase();
  res.writeHead(200, {
    "content-type": mimeTypes.get(ext) || "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(fullPath).pipe(res);
});

webServer.listen(webPort, () => console.log(`[web] http://localhost:${webPort}`));
