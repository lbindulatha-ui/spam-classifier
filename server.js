// Tiny dependency-free Node server (Node 18+).
// 1) Serves the static React files from /public
// 2) Proxies POST /api/chat to Ollama so your API key stays on the server
//    (never in the browser) and no CORS configuration is needed.

const http = require("http");
const fs = require("fs");
const path = require("path");

// ---- load .env (simple parser, no packages) ----
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const HOST = (process.env.OLLAMA_HOST || "https://ollama.com").replace(/\/+$/, "");
const API_KEY = process.env.OLLAMA_API_KEY || "";
const MODEL = process.env.OLLAMA_MODEL || "gpt-oss:120b";
const PORT = Number(process.env.PORT) || 3000;
const IS_CLOUD = /^https:\/\/ollama\.com$/i.test(HOST);
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("Request too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  if (IS_CLOUD && !API_KEY) {
    return send(res, 500, { error: "OLLAMA_API_KEY is missing. Add it to your .env file and restart the server." });
  }
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (e) {
    return send(res, 400, { error: "Invalid request: " + e.message });
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return send(res, 400, { error: "Request must include a messages array." });
  }
  const messages = payload.messages
    .filter((m) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = "Bearer " + API_KEY;

  try {
    const upstream = await fetch(HOST + "/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: "json",
        messages,
        options: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      let detail = text;
      try { detail = JSON.parse(text).error || text; } catch (_) {}
      const hint =
        upstream.status === 401 || upstream.status === 403 ? " Check that OLLAMA_API_KEY is valid." :
        upstream.status === 404 ? ` Model "${MODEL}" was not found. Change OLLAMA_MODEL in .env.` : "";
      return send(res, upstream.status, { error: `Ollama returned ${upstream.status}: ${String(detail).slice(0, 300)}.${hint}` });
    }
    send(res, 200, text);
  } catch (e) {
    const msg = e.name === "TimeoutError"
      ? "Ollama took too long to respond. Try again."
      : "Could not reach Ollama at " + HOST + ". Check your internet connection or OLLAMA_HOST.";
    send(res, 502, { error: msg });
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    send(res, 200, data, MIME[path.extname(file)] || "application/octet-stream");
  });
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://x").pathname;
    if (req.method === "POST" && pathname === "/api/chat") return handleChat(req, res);
    if (req.method === "GET" && pathname === "/api/config") {
      return send(res, 200, { model: MODEL, host: HOST, cloud: IS_CLOUD, keyConfigured: Boolean(API_KEY) });
    }
    if (req.method === "GET") return serveStatic(req, res);
    send(res, 405, { error: "Method not allowed" });
  })
  .listen(PORT, () => {
    console.log(`Spam classifier running at http://localhost:${PORT}`);
    console.log(`Ollama: ${HOST}  |  model: ${MODEL}  |  API key: ${API_KEY ? "set" : "NOT set"}`);
    if (IS_CLOUD && !API_KEY) console.log("! Add OLLAMA_API_KEY to .env (see .env.example) and restart.");
  });
