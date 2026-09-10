import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_materiais",
  title: "Listar materiais",
  description: "Lista os materiais (lotes) cadastrados pelo usuário, com dimensões em cm e peso em kg.",
  inputSchema: {
    busca: z.string().optional().describe("Filtro opcional por nome ou SKU."),
    limite: z.number().int().optional().describe("Máximo de registros a retornar (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const max = Math.min(Math.max(limite ?? 50, 1), 200);
    let query = supabase
      .from("materiais")
      .select("id, nome, sku, comprimento_cm, largura_cm, altura_cm, peso_kg, cor, tipo_embalagem, permite_rotacao")
      .order("criado_em", { ascending: false })
      .limit(max);
    if (busca?.trim()) {
      const termo = busca.trim();
      query = query.or(`nome.ilike.%${termo}%,sku.ilike.%${termo}%`);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { materiais: data ?? [] },
    };
  },
});
