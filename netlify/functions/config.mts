import type { Config } from "@netlify/functions";
import { getOllamaConfig } from "../lib/ollama.mts";

export default async () => {
  const { model, host, isCloud, apiKey } = getOllamaConfig();
  return Response.json(
    { model, host, cloud: isCloud, keyConfigured: Boolean(apiKey) },
    { headers: { "Cache-Control": "no-store" } }
  );
};

export const config: Config = {
  path: "/api/config",
  method: "GET",
};
