import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_simulacoes",
  title: "Listar simulações",
  description: "Lista as simulações de carga do usuário, com veículo, dimensões e limite de peso.",
  inputSchema: { limite: z.number().int().optional().describe("Máximo de registros (padrão 30).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limite }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("simulacoes")
      .select(
        "id, nome, veiculo_nome, container_tipo, comprimento_cm, largura_cm, altura_cm, capacidade_peso_kg, atualizada_em",
      )
      .order("atualizada_em", { ascending: false })
      .limit(Math.min(Math.max(limite ?? 30, 1), 100));
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { simulacoes: data ?? [] },
    };
  },
});
