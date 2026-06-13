import http from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPort = Number(process.env.WEB_PORT || 5173);
const apiPort = Number(process.env.PORT || 8787);

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
  if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
    return path.join(fullPath, "index.html");
  }
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

webServer.listen(webPort, () => {
  console.log(`[web] http://localhost:${webPort}`);
});

let compiling = false;
let pendingCompile = false;

function compileWeb() {
  if (compiling) { pendingCompile = true; return; }
  compiling = true;
  const tscBin = path.join(root, "node_modules", ".bin", "tsc");
  const tsc = spawn(tscBin, ["-p", "tsconfig.web.json"], { cwd: root });
  let stderr = "";
  tsc.stderr.on("data", chunk => { stderr += chunk; });
  tsc.on("close", code => {
    compiling = false;
    if (code === 0) {
      console.log("[web] compiled \u2713");
    } else {
      console.log(`[web] compile error (exit ${code})`);
      stderr.split(/\r?\n/).filter(Boolean).forEach(line => console.log(`[web]   ${line}`));
    }
    if (pendingCompile) { pendingCompile = false; compileWeb(); }
  });
}

compileWeb();

const srcDir = path.join(root, "src");
let debounceTimer = null;
watch(srcDir, { recursive: true }, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(compileWeb, 300);
});

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const api = spawn(npmCommand, ["run", "dev", "--prefix", "server"], {
  cwd: root,
  env: { ...process.env, PORT: String(apiPort) },
  stdio: ["ignore", "pipe", "pipe"]
});

function pipeWithPrefix(stream, prefix) {
  stream.on("data", chunk => {
    String(chunk).split(/\r?\n/).filter(Boolean).forEach(line => console.log(`${prefix} ${line}`));
  });
}

pipeWithPrefix(api.stdout, "[api]");
pipeWithPrefix(api.stderr, "[api]");

api.on("exit", code => {
  console.log(`[api] exited with code ${code}`);
  webServer.close();
  process.exit(code || 0);
});

function shutdown() {
  console.log("\nshutting down...");
  api.kill("SIGTERM");
  webServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
