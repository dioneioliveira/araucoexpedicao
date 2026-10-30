// Base de defeitos do Quality Vision: registra inspeções/defeitos e lista as ocorrências.
// Mesmos secrets da função `analisar` (APP_TOKEN, ALLOWED_ORIGIN opcional); SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY já existem nas Edge Functions. Deploy: --no-verify-jwt.
// Recortes dos defeitos ficam guardados; a foto inteira é apagada após 7 dias.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "defeitos", DIAS_FOTO = 7, MAX_BODY = 12_000_000, MAX_DEF = 60, MAX_FOTOS = 12;

const cors = (): Record<string, string> => ({
  "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-app-token",
  "access-control-max-age": "86400", "vary": "origin",
});
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors(), "content-type": "application/json" } });
const fail = (m: string, s: number) => reply({ error: { message: m } }, s);
const safeEqual = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const txt = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : null);
const int = (v: unknown) => (Number.isFinite(+(v as number)) ? Math.round(+(v as number)) : null);
const b64 = (s: unknown): Uint8Array | null => { if (typeof s !== "string" || !s) return null; try { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); } catch { return null; } };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return fail("Método não permitido.", 405);
  const appToken = Deno.env.get("APP_TOKEN");
  if (!appToken) return fail("Servidor sem configuração (APP_TOKEN).", 500);
  if (!safeEqual(req.headers.get("x-app-token") ?? "", appToken)) return fail("Código de acesso inválido.", 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return fail("Pedido grande demais.", 413);
  let body: any; try { body = JSON.parse(raw); } catch { return fail("JSON inválido.", 400); }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // limpeza: apaga fotos inteiras com mais de 7 dias (os recortes ficam)
  async function limpar() {
    const lim = new Date(Date.now() - DIAS_FOTO * 86400_000).toISOString();
    const { data } = await db.from("defeitos").select("id, foto_path").not("foto_path", "is", null).lt("criado_em", lim).limit(500);
    if (!data?.length) return;
    const paths = [...new Set(data.map((d: any) => d.foto_path as string))];
    await db.storage.from(BUCKET).remove(paths);
    await db.from("defeitos").update({ foto_path: null }).in("id", data.map((d: any) => d.id));
  }

  if (body.acao === "registrar") {
    const ins = body.inspecao ?? {}, defs = Array.isArray(body.defeitos) ? body.defeitos.slice(0, MAX_DEF) : [], fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, MAX_FOTOS) : [];
    const { data: row, error } = await db.from("inspecoes").insert({
      embarque: txt(ins.embarque, 60), placa: txt(ins.placa, 20), operador: txt(ins.operador, 80), nota: int(ins.nota), resultado: txt(ins.resultado, 40),
    }).select("id").single();
    if (error || !row) return fail("Não foi possível registrar a inspeção.", 500);
    const id = row.id as string, fotoPath: (string | null)[] = [];
    for (let i = 0; i < fotos.length; i++) {
      const bytes = b64(fotos[i]?.b64); let p: string | null = null;
      if (bytes) { p = `fotos/${id}/${i}.jpg`; const { error: e } = await db.storage.from(BUCKET).upload(p, bytes, { contentType: "image/jpeg" }); if (e) p = null; }
      fotoPath.push(p);
    }
    let n = 0;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i]; if (!txt(d?.tipo, 40)) continue;
      const bytes = b64(d.recorte_b64); let rp: string | null = null;
      if (bytes) { rp = `recortes/${id}/${i}.jpg`; const { error: e } = await db.storage.from(BUCKET).upload(rp, bytes, { contentType: "image/jpeg" }); if (e) rp = null; }
      const { error: e } = await db.from("defeitos").insert({
        inspecao_id: id, lado: txt(d.lado, 20), tipo: txt(d.tipo, 40), gravidade: int(d.gravidade), critico: !!d.critico,
        descricao: txt(d.descricao, 400), acao: txt(d.acao, 200), box: d.box && typeof d.box === "object" ? d.box : null,
        origem: d.origem === "operador" ? "operador" : "ia", veredito: d.veredito === "acertou" || d.veredito === "errou" ? d.veredito : null,
        ignorado: !!d.ignorado, motivo_ignorado: txt(d.motivo_ignorado, 300), recorte_path: rp, foto_path: fotoPath[int(d.foto) ?? -1] ?? null,
      });
      if (!e) n++;
    }
    await limpar();
    return reply({ ok: true, inspecao: id, defeitos: n });
  }

  if (body.acao === "listar") {
    const f = body.filtros ?? {};
    let q = db.from("defeitos").select("id, criado_em, lado, tipo, gravidade, critico, descricao, acao, origem, veredito, ignorado, motivo_ignorado, recorte_path, foto_path, inspecoes(embarque, placa, operador)").order("criado_em", { ascending: false }).limit(Math.min(int(body.limite) ?? 120, 300));
    if (txt(f.tipo, 40)) q = q.eq("tipo", f.tipo);
    if (f.critico === true) q = q.eq("critico", true);
    if (f.veredito === "acertou" || f.veredito === "errou") q = q.eq("veredito", f.veredito);
    if (f.ignorado === true) q = q.eq("ignorado", true);
    if (txt(f.desde, 30)) q = q.gte("criado_em", f.desde);
    const { data, error } = await q;
    if (error) return fail("Não foi possível consultar.", 500);
    const rows = data ?? [], paths = rows.flatMap((r: any) => [r.recorte_path, r.foto_path]).filter(Boolean) as string[];
    const url: Record<string, string> = {};
    if (paths.length) { const { data: s } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600); (s ?? []).forEach((x: any) => { if (x.path && x.signedUrl) url[x.path] = x.signedUrl; }); }
    await limpar();
    return reply({ defeitos: rows.map((r: any) => ({ ...r, recorte_url: url[r.recorte_path] ?? null, foto_url: url[r.foto_path] ?? null })) });
  }

  if (body.acao === "veredito") { // corrige o retorno do operador depois
    const v = body.veredito === "acertou" || body.veredito === "errou" ? body.veredito : null;
    const { error } = await db.from("defeitos").update({ veredito: v }).eq("id", String(body.id));
    return error ? fail("Não foi possível atualizar.", 500) : reply({ ok: true });
  }

  return fail("Ação não reconhecida.", 400);
});
