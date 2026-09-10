import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_simulacao",
  title: "Criar simulação",
  description:
    "Cria uma simulação de carga com itens (material_id + quantidade). Dimensões em cm; padrão container 40HC.",
  inputSchema: {
    nome: z.string().trim().describe("Nome da simulação."),
    veiculo_nome: z.string().trim().optional().describe("Nome do veículo/container."),
    comprimento_cm: z.number().optional().describe("Comprimento interno em cm."),
    largura_cm: z.number().optional().describe("Largura interna em cm."),
    altura_cm: z.number().optional().describe("Altura interna em cm."),
    capacidade_peso_kg: z.number().optional().describe("Limite de peso em kg."),
    itens: z
      .array(z.object({ material_id: z.string(), quantidade: z.number().int() }))
      .optional()
      .describe("Itens da carga."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const base: Record<string, unknown> = { user_id: ctx.getUserId()!, nome: input.nome };
    if (input.veiculo_nome) base.veiculo_nome = input.veiculo_nome;
    if (input.comprimento_cm) base.comprimento_cm = input.comprimento_cm;
    if (input.largura_cm) base.largura_cm = input.largura_cm;
    if (input.altura_cm) base.altura_cm = input.altura_cm;
    if (input.capacidade_peso_kg) base.capacidade_peso_kg = input.capacidade_peso_kg;

    const { data: simulacao, error } = await supabase.from("simulacoes").insert(base as never).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    if (input.itens?.length) {
      const { error: erroItens } = await supabase.from("simulacao_itens").insert(
        input.itens.map((i) => ({
          simulacao_id: (simulacao as { id: string }).id,
          material_id: i.material_id,
          quantidade: i.quantidade,
        })),
      );
      if (erroItens) return { content: [{ type: "text", text: erroItens.message }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(simulacao) }],
      structuredContent: { simulacao },
    };
  },
});
