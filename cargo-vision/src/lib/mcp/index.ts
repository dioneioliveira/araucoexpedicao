import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMateriais from "./tools/list-materiais";
import createMaterial from "./tools/create-material";
import listVeiculos from "./tools/list-veiculos";
import listSimulacoes from "./tools/list-simulacoes";
import getSimulacao from "./tools/get-simulacao";
import createSimulacao from "./tools/create-simulacao";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "cargo-vision",
  title: "Cargo Vision",
  version: "0.1.0",
  instructions:
    "Ferramentas do Cargo Vision (CargoSim): cadastro de materiais (lotes), veículos/containers e simulações de carga 3D. Dimensões em centímetros e pesos em quilos. Cada usuário só acessa os próprios dados.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMateriais, createMaterial, listVeiculos, listSimulacoes, getSimulacao, createSimulacao],
});
