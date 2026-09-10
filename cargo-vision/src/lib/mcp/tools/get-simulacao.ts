import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_simulacao",
  title: "Detalhar simulação",
  description: "Retorna uma simulação com seus itens (material, dimensões, peso e quantidade).",
  inputSchema: { id: z.string().describe("ID da simulação.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: simulacao, error } = await supabase.from("simulacoes").select("*").eq("id", id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!simulacao) throw new ToolError(`Simulação ${id} não encontrada.`);

    const { data: itens, error: erroItens } = await supabase
      .from("simulacao_itens")
      .select("id, quantidade, materiais(id, nome, sku, comprimento_cm, largura_cm, altura_cm, peso_kg)")
      .eq("simulacao_id", id);
    if (erroItens) return { content: [{ type: "text", text: erroItens.message }], isError: true };

    const payload = { simulacao, itens: itens ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
