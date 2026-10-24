// Proxy da análise de cargas (Quality Vision).
// Guarda a chave da Anthropic no servidor: o celular só conhece a URL desta função e um código de acesso.
//
// Secrets necessários (Supabase > Edge Functions > Secrets):
//   ANTHROPIC_API_KEY  chave da API da Anthropic
//   APP_TOKEN          código de acesso que o app envia no cabeçalho x-app-token
//   ALLOWED_ORIGIN     (opcional) origem permitida no CORS, ex.: https://usuario.github.io
//
// Deploy sem JWT do Supabase (a autenticação é o x-app-token):
//   supabase functions deploy analisar --no-verify-jwt

const ALLOWED_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"]);
const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_BODY_CHARS = 8_000_000; // ~6 MB de imagem em base64
const MAX_TOKENS = 4096;

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-app-token",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
}

function reply(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), "content-type": "application/json" } });
}

const fail = (message: string, status: number) => reply({ error: { message } }, status);

// comparação em tempo constante
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return fail("Método não permitido.", 405);

  const appToken = Deno.env.get("APP_TOKEN");
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!appToken || !apiKey) return fail("Servidor sem configuração (APP_TOKEN e ANTHROPIC_API_KEY).", 500);
  if (!safeEqual(req.headers.get("x-app-token") ?? "", appToken)) return fail("Código de acesso inválido.", 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return fail("Imagem grande demais.", 413);

  // aceita somente o formato que o app envia: 1 mensagem do usuário com 1 imagem + 1 texto
  let body: any;
  try { body = JSON.parse(raw); } catch { return fail("JSON inválido.", 400); }
  const msgs = body?.messages;
  const content = Array.isArray(msgs) && msgs.length === 1 && msgs[0]?.role === "user" ? msgs[0].content : null;
  const img = Array.isArray(content) ? content.find((c: any) => c?.type === "image") : null;
  const txt = Array.isArray(content) ? content.find((c: any) => c?.type === "text") : null;
  if (!img || !txt || content.length !== 2 || img.source?.type !== "base64" || typeof img.source?.data !== "string" || typeof txt.text !== "string") {
    return fail("Formato de pedido não aceito.", 400);
  }

  const model = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
  const max_tokens = Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS);

  let up: Response;
  try {
    up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: img.source.media_type === "image/png" ? "image/png" : "image/jpeg", data: img.source.data } },
          { type: "text", text: txt.text },
        ] }],
      }),
      signal: AbortSignal.timeout(110_000),
    });
  } catch {
    return fail("A análise demorou demais ou o serviço de IA está indisponível. Tente novamente.", 504);
  }
  // devolve a resposta da Anthropic como veio (o app lê content[].text)
  return new Response(await up.text(), { status: up.status, headers: { ...corsHeaders(), "content-type": "application/json" } });
});
