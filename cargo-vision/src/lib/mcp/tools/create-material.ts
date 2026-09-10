import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_material",
  title: "Cadastrar material",
  description: "Cadastra um novo material (lote) com dimensões em cm e peso em kg para o usuário autenticado.",
  inputSchema: {
    nome: z.string().trim().describe("Nome do material."),
    sku: z.string().trim().optional().describe("Código/SKU do lote."),
    comprimento_cm: z.number().describe("Comprimento em centímetros."),
    largura_cm: z.number().describe("Largura em centímetros."),
    altura_cm: z.number().describe("Altura em centímetros."),
    peso_kg: z.number().describe("Peso do lote em quilos."),
    cor: z.string().trim().optional().describe("Cor hex para a visualização 3D, ex: #2563eb."),
    tipo_embalagem: z.enum(["pe", "deitado"]).optional().describe("Posição padrão do lote: pé ou deitado."),
    permite_rotacao: z.boolean().optional().describe("Se o lote pode ser rotacionado na montagem."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("materiais")
      .insert({
        user_id: ctx.getUserId()!,
        nome: input.nome,
        sku: input.sku ?? null,
        comprimento_cm: input.comprimento_cm,
        largura_cm: input.largura_cm,
        altura_cm: input.altura_cm,
        peso_kg: input.peso_kg,
        cor: input.cor ?? "#2563eb",
        tipo_embalagem: input.tipo_embalagem ?? "pe",
        permite_rotacao: input.permite_rotacao ?? true,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { material: data } };
  },
});
