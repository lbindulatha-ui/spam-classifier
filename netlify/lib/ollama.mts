// Shared Ollama settings, read from Netlify environment variables
// (OLLAMA_API_KEY, OLLAMA_HOST, OLLAMA_MODEL) — same names as the local .env.
export function getOllamaConfig() {
  const host = (process.env.OLLAMA_HOST || "https://ollama.com").replace(/\/+$/, "");
  return {
    host,
    apiKey: process.env.OLLAMA_API_KEY || "",
    model: process.env.OLLAMA_MODEL || "gpt-oss:120b",
    isCloud: /^https:\/\/ollama\.com$/i.test(host),
  };
}
