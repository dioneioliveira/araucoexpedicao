export interface Material {
  id: string;
  nome: string;
  sku: string | null;
  comprimento_cm: number;
  largura_cm: number;
  altura_cm: number;
  peso_kg: number;
  cor: string;
  permite_rotacao?: boolean;
  /** Rotação permitida em torno de cada eixo (bloqueio independente). */
  rot_x?: boolean;
  rot_y?: boolean;
  rot_z?: boolean;
  /** Embalagem do lote: "pe" (posição normal) ou "deitado" (rotacionado no eixo X). */
  tipo_embalagem?: "pe" | "deitado" | string;

  espessura_cm?: number | null;
  densidade_kg_m3?: number | null;
  qtd_chapas?: number | null;
  espessura_chapa_cm?: number | null;
  capa_superior_cm?: number | null;
  capa_inferior_cm?: number | null;
  altura_calcos_cm?: number | null;
  peso_insumos_kg?: number | null;
}


export interface SimulacaoItem {
  id: string;
  material_id: string;
  quantidade: number;
}

export interface Simulacao {
  id: string;
  nome: string;
  container_tipo: string;
  capacidade_peso_kg: number;
  criada_em: string;
  atualizada_em: string;
  veiculo_nome: string;
  comprimento_cm: number;
  largura_cm: number;
  altura_cm: number;
}

// Configuração de um eixo: posição (cm a partir do início da carroceria) e limite (kg) pela norma CONTRAN.
export interface EixoConfig {
  nome: string;
  posicao_cm: number;
  limite_kg: number;
}

export interface Veiculo {
  id: string;
  nome: string;
  comprimento_cm: number;
  largura_cm: number;
  altura_cm: number;
  capacidade_peso_kg: number;
  eixos?: EixoConfig[];
}

// Container 40HC dimensões internas em cm (compatibilidade)
export const CONTAINER_40HC = {
  comprimento_cm: 1200,
  largura_cm: 230,
  altura_cm: 269,
};

// Limites CONTRAN típicos (kg):
// Dianteiro direção (rodado simples): 6.000
// Eixo simples rodado duplo: 10.000
// Eixo duplo (tandem) rodado duplo: 17.000
// Eixo triplo rodado duplo: 25.500
// Presets de veículos prontos para o usuário escolher.
export const PRESETS_VEICULOS: Array<Omit<Veiculo, "id">> = [
  {
    nome: "Container 40' HC",
    comprimento_cm: 1200, largura_cm: 230, altura_cm: 269, capacidade_peso_kg: 26500,
    eixos: [
      { nome: "Dianteiro cavalo", posicao_cm: -100, limite_kg: 6000 },
      { nome: "Tandem cavalo", posicao_cm: 250, limite_kg: 17000 },
      { nome: "Triplo semirreboque", posicao_cm: 1050, limite_kg: 25500 },
    ],
  },
  {
    nome: "Container 40' Standard",
    comprimento_cm: 1200, largura_cm: 235, altura_cm: 239, capacidade_peso_kg: 26500,
    eixos: [
      { nome: "Dianteiro cavalo", posicao_cm: -100, limite_kg: 6000 },
      { nome: "Tandem cavalo", posicao_cm: 250, limite_kg: 17000 },
      { nome: "Triplo semirreboque", posicao_cm: 1050, limite_kg: 25500 },
    ],
  },
  {
    nome: "Container 20' Standard",
    comprimento_cm: 590, largura_cm: 235, altura_cm: 239, capacidade_peso_kg: 28000,
    eixos: [
      { nome: "Dianteiro cavalo", posicao_cm: -100, limite_kg: 6000 },
      { nome: "Tandem cavalo", posicao_cm: 150, limite_kg: 17000 },
      { nome: "Triplo semirreboque", posicao_cm: 500, limite_kg: 25500 },
    ],
  },
  {
    nome: "Carreta Baú",
    comprimento_cm: 1450, largura_cm: 245, altura_cm: 270, capacidade_peso_kg: 27000,
    eixos: [
      { nome: "Dianteiro cavalo", posicao_cm: -120, limite_kg: 6000 },
      { nome: "Tandem cavalo", posicao_cm: 300, limite_kg: 17000 },
      { nome: "Triplo semirreboque", posicao_cm: 1250, limite_kg: 25500 },
    ],
  },
  {
    nome: "Truck Baú",
    comprimento_cm: 750, largura_cm: 245, altura_cm: 270, capacidade_peso_kg: 12000,
    eixos: [
      { nome: "Dianteiro direção", posicao_cm: -50, limite_kg: 6000 },
      { nome: "Tandem traseiro", posicao_cm: 600, limite_kg: 17000 },
    ],
  },
  {
    nome: "Toco Baú",
    comprimento_cm: 550, largura_cm: 220, altura_cm: 240, capacidade_peso_kg: 6000,
    eixos: [
      { nome: "Dianteiro direção", posicao_cm: -40, limite_kg: 6000 },
      { nome: "Simples traseiro", posicao_cm: 450, limite_kg: 10000 },
    ],
  },
  {
    nome: "VUC Baú",
    comprimento_cm: 350, largura_cm: 200, altura_cm: 220, capacidade_peso_kg: 3000,
    eixos: [
      { nome: "Dianteiro direção", posicao_cm: -30, limite_kg: 1500 },
      { nome: "Simples traseiro", posicao_cm: 290, limite_kg: 3500 },
    ],
  },
];

// Configuração padrão de eixos quando o veículo não traz informação (assume tandem central genérico).
export function eixosPadrao(comprimento_cm: number, capacidade_peso_kg: number): EixoConfig[] {
  return [
    { nome: "Dianteiro", posicao_cm: -Math.round(comprimento_cm * 0.1), limite_kg: Math.round(capacidade_peso_kg * 0.25) },
    { nome: "Traseiro", posicao_cm: Math.round(comprimento_cm * 0.8), limite_kg: Math.round(capacidade_peso_kg * 0.75) },
  ];
}

export interface ItemPosicionado {
  uid: string;
  material: Material;
  x: number; // canto, em cm
  y: number;
  z: number;
  dx: number; // dimensões na orientação escolhida
  dy: number;
  dz: number;
}

export interface ResultadoPacking {
  posicionados: ItemPosicionado[];
  naoEncaixados: { material: Material; quantidade: number }[];
  volumeUsadoCm3: number;
  volumeTotalCm3: number;
  pesoTotalKg: number;
}
