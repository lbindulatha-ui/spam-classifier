// Proxies POST /api/chat to Ollama so the API key stays on the server.
import type { Config } from "@netlify/functions";
import { getOllamaConfig } from "../lib/ollama.mts";

const MAX_BODY = 100 * 1024;

function send(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async (req: Request) => {
  const { host, apiKey, model, isCloud } = getOllamaConfig();
  if (isCloud && !apiKey) {
    return send(500, { error: "OLLAMA_API_KEY is missing. Add it to the site's environment variables in Netlify and redeploy." });
  }

  let payload: any;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) throw new Error("Request too large");
    payload = JSON.parse(raw);
  } catch (e) {
    return send(400, { error: "Invalid request: " + (e as Error).message });
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return send(400, { error: "Request must include a messages array." });
  }
  const messages = payload.messages
    .filter((m: any) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content }));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;

  try {
    const upstream = await fetch(host + "/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages,
        options: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      let detail = text;
      try { detail = JSON.parse(text).error || text; } catch (_) {}
      const hint =
        upstream.status === 401 || upstream.status === 403 ? " Check that OLLAMA_API_KEY is valid." :
        upstream.status === 404 ? ` Model "${model}" was not found. Change OLLAMA_MODEL in the site's environment variables.` : "";
      return send(upstream.status, { error: `Ollama returned ${upstream.status}: ${String(detail).slice(0, 300)}.${hint}` });
    }
    return send(200, text);
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError"
      ? "Ollama took too long to respond. Try again."
      : "Could not reach Ollama at " + host + ". Check OLLAMA_HOST.";
    return send(502, { error: msg });
  }
};

export const config: Config = {
  path: "/api/chat",
  method: "POST",
};
