// Edge Function: improve-chat-message
// Reescreve uma mensagem do operador antes do envio sem expor a chave da OpenAI.

import { authenticate, endpoint, HttpError, json, readObject } from "../_shared/http.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

const MAX_MESSAGE_LENGTH = 4_000;
const DEFAULT_INSTRUCTIONS =
  "Você melhora mensagens de atendimento via WhatsApp. Reescreva a mensagem para ficar clara, natural, cordial e profissional, preservando integralmente a intenção, os fatos, nomes, valores, links e o idioma original. Não invente informações. Mantenha o texto conciso e adequado para WhatsApp. Retorne somente a mensagem revisada, sem aspas, rótulos ou explicações.";

type OpenAIResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

const extractOutputText = (response: OpenAIResponse) =>
  response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("")
    .trim() ?? "";

serve(
  endpoint(async (req) => {
    // Também bloqueia usuários demo no servidor, mesmo em chamadas diretas.
    await authenticate(req);

    const body = await readObject(req);
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) throw new HttpError(400, "A mensagem é obrigatória");
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, `A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres`);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new HttpError(500, "OpenAI não configurada");

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: DEFAULT_INSTRUCTIONS,
        input: message,
        max_output_tokens: 1_200,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const openAIData = (await openAIResponse.json().catch(() => ({}))) as OpenAIResponse;
    if (!openAIResponse.ok) {
      console.error("[improve-chat-message] OpenAI error", openAIResponse.status, openAIData.error);
      throw new HttpError(502, "Não foi possível melhorar a mensagem agora");
    }

    const improvedMessage = extractOutputText(openAIData);
    if (!improvedMessage) throw new HttpError(502, "A OpenAI não retornou uma mensagem");

    return json({ improvedMessage });
  }),
);
