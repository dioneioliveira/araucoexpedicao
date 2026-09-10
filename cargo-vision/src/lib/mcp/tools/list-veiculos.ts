import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_veiculos",
  title: "Listar veículos",
  description: "Lista os veículos/containers cadastrados, com dimensões internas em cm e capacidade de peso em kg.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("veiculos")
      .select("id, nome, comprimento_cm, largura_cm, altura_cm, capacidade_peso_kg")
      .order("criado_em", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { veiculos: data ?? [] },
    };
  },
});
