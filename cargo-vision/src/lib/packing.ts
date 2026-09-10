import {
  CONTAINER_40HC,
  type EixoConfig,
  type ItemPosicionado,
  type Material,
  type ResultadoPacking,
} from "@/types/logistica";


interface Container {
  L: number; // x - comprimento
  W: number; // y - largura
  H: number; // z - altura
}

/** Eixos de rotação liberados para o material (bloqueio independente por eixo). */
export function eixosLiberados(m: Material) {
  if (m.permite_rotacao === false) return { x: false, y: false, z: false };
  return {
    x: m.rot_x !== false,
    y: m.rot_y !== false,
    z: m.rot_z !== false,
  };
}

/** Dimensões base do material já considerando a embalagem ("pé" ou "deitado"). */
export function dimensoesBase(m: Material): [number, number, number] {
  const a = Number(m.comprimento_cm);
  const b = Number(m.largura_cm);
  const c = Number(m.altura_cm);
  // "deitado" = lote tombado no eixo X (troca largura ↔ altura).
  if (m.tipo_embalagem === "deitado") return [a, c, b];
  return [a, b, c];
}

function orientations(m: Material): Array<[number, number, number]> {
  const [a, b, c] = dimensoesBase(m);
  const eixos = eixosLiberados(m);
  // Expande as orientações possíveis aplicando apenas as rotações liberadas.
  const vistos = new Set<string>();
  const fila: Array<[number, number, number]> = [[a, b, c]];
  vistos.add(`${a}|${b}|${c}`);

  for (let i = 0; i < fila.length; i++) {
    const [dx, dy, dz] = fila[i];
    const cands: Array<[number, number, number]> = [];
    if (eixos.z) cands.push([dy, dx, dz]); // gira no plano horizontal
    if (eixos.y) cands.push([dz, dy, dx]);
    if (eixos.x) cands.push([dx, dz, dy]);
    for (const c2 of cands) {
      const k = c2.join("|");
      if (!vistos.has(k)) {
        vistos.add(k);
        fila.push(c2);
      }
    }
  }
  return fila;
}

function fitsInside(c: Container, x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  return x + dx <= c.L + 1e-6 && y + dy <= c.W + 1e-6 && z + dz <= c.H + 1e-6;
}

function overlaps(a: ItemPosicionado, x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  return (
    x < a.x + a.dx - 1e-6 && x + dx > a.x + 1e-6 &&
    y < a.y + a.dy - 1e-6 && y + dy > a.y + 1e-6 &&
    z < a.z + a.dz - 1e-6 && z + dz > a.z + 1e-6
  );
}

interface ItemInst {
  material: Material;
  uid: string;
}

// verifica se há suporte: ou está no chão (z=0) ou >=70% da base apoiada em outras caixas
function temSuporte(
  posicionados: ItemPosicionado[],
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
): boolean {
  if (z < 1e-6) return true;
  const areaBase = dx * dy;
  let areaApoiada = 0;
  for (const p of posicionados) {
    const topo = p.z + p.dz;
    if (Math.abs(topo - z) > 1e-6) continue;
    const ox = Math.max(0, Math.min(x + dx, p.x + p.dx) - Math.max(x, p.x));
    const oy = Math.max(0, Math.min(y + dy, p.y + p.dy) - Math.max(y, p.y));
    areaApoiada += ox * oy;
  }
  return areaApoiada / areaBase >= 0.7;
}

// Regra: não permite empilhar item mais pesado OU com base maior sobre outro menor/mais leve.
// Retorna true se a colocação respeita a regra (é seguro empilhar).
export function respeitaEmpilhamento(
  posicionados: ItemPosicionado[],
  material: Material,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
): boolean {
  if (z < 1e-6) return true;
  const pesoNovo = Number(material.peso_kg);
  const baseNova = dx * dy;
  for (const p of posicionados) {
    if (Math.abs(p.z + p.dz - z) > 1e-6) continue;
    // toca por baixo?
    const ox = Math.min(x + dx, p.x + p.dx) - Math.max(x, p.x);
    const oy = Math.min(y + dy, p.y + p.dy) - Math.max(y, p.y);
    if (ox <= 1e-6 || oy <= 1e-6) continue;
    const pesoBaixo = Number(p.material.peso_kg);
    const baseBaixo = p.dx * p.dy;
    // Não pode: mais pesado sobre mais leve, nem base maior sobre base menor.
    if (pesoNovo > pesoBaixo + 1e-6) return false;
    if (baseNova > baseBaixo + 1e-6) return false;
  }
  return true;
}


type ScoreFn = (
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  posicionados: ItemPosicionado[],
) => number;

// Bônus por alinhamento de comprimento (eixo X) com itens diretamente abaixo.
function bonusAlinhamento(
  x: number,
  _y: number,
  z: number,
  dx: number,
  posicionados: ItemPosicionado[],
): number {
  if (z < 1e-6) return 0;
  const abaixo = posicionados.filter(
    (p) => Math.abs(p.z + p.dz - z) < 1e-6 &&
      p.x < x + dx - 1e-6 && p.x + p.dx > x + 1e-6,
  );
  if (abaixo.length === 0) return 0;
  let pontos = 0;
  for (const p of abaixo) {
    if (Math.abs(p.x - x) < 1e-6) pontos += 1;
    if (Math.abs(p.x + p.dx - (x + dx)) < 1e-6) pontos += 1;
    if (Math.abs(p.dx - dx) < 1e-6) pontos += 2;
  }
  return pontos;
}

// Bônus por topo nivelado — evita "escadinhas" entre lotes de comprimentos parecidos.
function bonusTopoNivelado(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  posicionados: ItemPosicionado[],
): number {
  const topoNovo = z + dz;
  let pontos = 0;
  for (const p of posicionados) {
    if (Math.abs(p.z - z) > 1e-6) continue;
    const tocaX = Math.abs(p.x + p.dx - x) < 1e-6 || Math.abs(x + dx - p.x) < 1e-6;
    const tocaY = Math.abs(p.y + p.dy - y) < 1e-6 || Math.abs(y + dy - p.y) < 1e-6;
    const sobreposY = p.y < y + dy && p.y + p.dy > y;
    const sobreposX = p.x < x + dx && p.x + p.dx > x;
    if ((tocaX && sobreposY) || (tocaY && sobreposX)) {
      if (Math.abs(p.z + p.dz - topoNovo) < 1e-6) pontos += 3;
      else pontos -= 1;
    }
  }
  return pontos;
}

function rodarUmaTentativa(
  instancias: ItemInst[],
  container: Container,
  scoreFn: ScoreFn,
  respeitarEmpilhamento = true,
  alturaMaxElevacaoCm?: number,
): { posicionados: ItemPosicionado[]; naoEncaixados: ItemInst[] } {

  const posicionados: ItemPosicionado[] = [];
  const pontos: Array<[number, number, number]> = [[0, 0, 0]];
  const naoEncaixados: ItemInst[] = [];

  for (const inst of instancias) {
    let melhor: { x: number; y: number; z: number; dx: number; dy: number; dz: number; score: number } | null = null;

    for (const [px, py, pz] of pontos) {
      // Limite de elevação da empilhadeira: a base do lote não pode subir além do curso dos garfos.
      if (alturaMaxElevacaoCm != null && pz > alturaMaxElevacaoCm + 1e-6) continue;
      for (const [dx, dy, dz] of orientations(inst.material)) {
        if (!fitsInside(container, px, py, pz, dx, dy, dz)) continue;
        if (!temSuporte(posicionados, px, py, pz, dx, dy)) continue;
        if (respeitarEmpilhamento && !respeitaEmpilhamento(posicionados, inst.material, px, py, pz, dx, dy)) continue;


        let colide = false;
        for (const a of posicionados) {
          if (overlaps(a, px, py, pz, dx, dy, dz)) {
            colide = true;
            break;
          }
        }
        if (colide) continue;
        const score = scoreFn(px, py, pz, dx, dy, dz, posicionados);
        if (!melhor || score < melhor.score) {
          melhor = { x: px, y: py, z: pz, dx, dy, dz, score };
        }
      }
    }

    if (!melhor) {
      naoEncaixados.push(inst);
      continue;
    }

    const novo: ItemPosicionado = {
      uid: inst.uid,
      material: inst.material,
      x: melhor.x,
      y: melhor.y,
      z: melhor.z,
      dx: melhor.dx,
      dy: melhor.dy,
      dz: melhor.dz,
    };
    posicionados.push(novo);

    pontos.push([novo.x + novo.dx, novo.y, novo.z]);
    pontos.push([novo.x, novo.y + novo.dy, novo.z]);
    pontos.push([novo.x, novo.y, novo.z + novo.dz]);
    // Bordas no topo do bloco — habilitam "amarração" (ex.: 2x244 sobre 488).
    pontos.push([novo.x + novo.dx, novo.y, novo.z + novo.dz]);
    pontos.push([novo.x, novo.y + novo.dy, novo.z + novo.dz]);

    const seen = new Set<string>();
    for (let i = pontos.length - 1; i >= 0; i--) {
      const k = pontos[i].join(",");
      if (seen.has(k)) pontos.splice(i, 1);
      else seen.add(k);
    }
  }

  return { posicionados, naoEncaixados };
}


export function calcularCarga(
  itens: { material: Material; quantidade: number }[],
  containerOverride?: Partial<typeof CONTAINER_40HC>,
  opts?: { respeitarEmpilhamento?: boolean; alturaMaxElevacaoCm?: number; minimizarAltura?: boolean },
): ResultadoPacking {
  const respeitarEmpilhamento = opts?.respeitarEmpilhamento !== false;
  const alturaMaxElevacaoCm = opts?.alturaMaxElevacaoCm;
  const minimizarAltura = opts?.minimizarAltura === true;

  const cdim = { ...CONTAINER_40HC, ...containerOverride };

  const container: Container = { L: cdim.comprimento_cm, W: cdim.largura_cm, H: cdim.altura_cm };

  const instancias: ItemInst[] = [];
  for (const it of itens) {
    for (let i = 0; i < it.quantidade; i++) {
      instancias.push({ material: it.material, uid: `${it.material.id}-${i}` });
    }
  }

  const vol = (m: Material) =>
    Number(m.comprimento_cm) * Number(m.largura_cm) * Number(m.altura_cm);
  const maxDim = (m: Material) =>
    Math.max(Number(m.comprimento_cm), Number(m.largura_cm), Number(m.altura_cm));
  const base = (m: Material) =>
    Math.max(Number(m.comprimento_cm), Number(m.largura_cm)) *
    Math.min(Number(m.comprimento_cm), Number(m.largura_cm));

  // Estratégias de ordenação — priorizam agrupar materiais de mesmo comprimento
  // para que fiquem empilhados (488 sobre 488, etc.).
  const estrategias: Array<(a: ItemInst, b: ItemInst) => number> = [
    (a, b) =>
      Number(b.material.comprimento_cm) - Number(a.material.comprimento_cm) ||
      vol(b.material) - vol(a.material),
    (a, b) =>
      maxDim(b.material) - maxDim(a.material) ||
      vol(b.material) - vol(a.material),
    (a, b) => vol(b.material) - vol(a.material),
    (a, b) => Number(b.material.altura_cm) - Number(a.material.altura_cm),
    (a, b) => base(b.material) - base(a.material),
  ];

  // Bônus de alinhamento e nivelamento subtraídos do score (menor = melhor).
  const ALIGN = 5_000_000;
  const LEVEL = 2_000_000;
  const sc = (x: number, y: number, z: number, dx: number, dy: number, dz: number, ps: ItemPosicionado[]) =>
    -bonusAlinhamento(x, y, z, dx, ps) * ALIGN
    - bonusTopoNivelado(x, y, z, dx, dy, dz, ps) * LEVEL;
  const scoreFns: ScoreFn[] = minimizarAltura
    ? [
        // Prioriza absolutamente a altura baixa: espalha no piso antes de empilhar.
        (x, y, z, dx, dy, dz, ps) => (z + dz) * 100_000_000 + z * 10_000_000 + x * 1_000 + y + sc(x, y, z, dx, dy, dz, ps),
        (x, y, z, dx, dy, dz, ps) => z * 100_000_000 + y * 100_000 + x * 1_000 + sc(x, y, z, dx, dy, dz, ps),
        (x, y, z, dx, dy, dz, ps) => (z + dz) * 100_000_000 + y * 1_000 + x + sc(x, y, z, dx, dy, dz, ps),
      ]
    : [
        (x, y, z, dx, dy, dz, ps) => x * 1_000_000 + y * 1_000 - z * 500 + sc(x, y, z, dx, dy, dz, ps),
        (x, y, z, dx, dy, dz, ps) => x * 1_000_000 + z * 1_000 + y + sc(x, y, z, dx, dy, dz, ps),
        (x, y, z, dx, dy, dz, ps) => y * 1_000_000 + x * 1_000 + z + sc(x, y, z, dx, dy, dz, ps),
        (x, y, z, dx, dy, dz, ps) => z * 1_000_000 + y * 1_000 + x + sc(x, y, z, dx, dy, dz, ps),
      ];

  const alturaMax = (ps: ItemPosicionado[]) => ps.reduce((s, p) => Math.max(s, p.z + p.dz), 0);
  const volumeDe = (ps: ItemPosicionado[]) => ps.reduce((s, p) => s + p.dx * p.dy * p.dz, 0);

  let melhor: { posicionados: ItemPosicionado[]; naoEncaixados: ItemInst[] } | null = null;
  for (const cmp of estrategias) {
    const ordenada = [...instancias].sort(cmp);
    for (const sf of scoreFns) {
      const r = rodarUmaTentativa(ordenada, container, sf, respeitarEmpilhamento, alturaMaxElevacaoCm);
      let melhorQue = false;
      if (!melhor) melhorQue = true;
      else if (r.posicionados.length !== melhor.posicionados.length) {
        melhorQue = r.posicionados.length > melhor.posicionados.length;
      } else if (minimizarAltura) {
        melhorQue = alturaMax(r.posicionados) < alturaMax(melhor.posicionados);
      } else {
        melhorQue = volumeDe(r.posicionados) > volumeDe(melhor.posicionados);
      }
      if (melhorQue) melhor = r;
    }
  }




  const posicionados = melhor!.posicionados;
  const naoEncaixadosMap = new Map<string, { material: Material; quantidade: number }>();
  for (const n of melhor!.naoEncaixados) {
    const cur = naoEncaixadosMap.get(n.material.id);
    if (cur) cur.quantidade += 1;
    else naoEncaixadosMap.set(n.material.id, { material: n.material, quantidade: 1 });
  }

  const volumeUsadoCm3 = posicionados.reduce((s, p) => s + p.dx * p.dy * p.dz, 0);
  const volumeTotalCm3 = container.L * container.W * container.H;
  const pesoTotalKg =
    posicionados.reduce((s, p) => s + Number(p.material.peso_kg), 0) +
    Array.from(naoEncaixadosMap.values()).reduce(
      (s, n) => s + Number(n.material.peso_kg) * n.quantidade,
      0,
    );

  return {
    posicionados,
    naoEncaixados: Array.from(naoEncaixadosMap.values()),
    volumeUsadoCm3,
    volumeTotalCm3,
    pesoTotalKg,
  };
}

// Valida uma configuração manual: sem colisões e dentro do container.
export function validarPosicoes(
  itens: ItemPosicionado[],
  containerOverride?: Partial<typeof CONTAINER_40HC>,
): { ok: boolean; erros: string[] } {
  const cdim = { ...CONTAINER_40HC, ...containerOverride };
  const container: Container = { L: cdim.comprimento_cm, W: cdim.largura_cm, H: cdim.altura_cm };
  const erros: string[] = [];
  for (let i = 0; i < itens.length; i++) {
    const a = itens[i];
    if (!fitsInside(container, a.x, a.y, a.z, a.dx, a.dy, a.dz)) {
      erros.push(`${a.material.nome} fora do container`);
    }
    for (let j = i + 1; j < itens.length; j++) {
      const b = itens[j];
      if (overlaps(a, b.x, b.y, b.z, b.dx, b.dy, b.dz)) {
        erros.push(`${a.material.nome} colide com ${b.material.nome}`);
      }
    }
  }
  return { ok: erros.length === 0, erros };
}

// Centraliza a carga no veículo: recentraliza o envelope ocupado nos eixos X e Y
// (não altera Z, para manter as camadas e o apoio).
export function centralizarCarga(
  itens: ItemPosicionado[],
  container: { comprimento_cm: number; largura_cm: number },
): ItemPosicionado[] {
  if (itens.length === 0) return itens;
  const minX = Math.min(...itens.map((i) => i.x));
  const maxX = Math.max(...itens.map((i) => i.x + i.dx));
  const minY = Math.min(...itens.map((i) => i.y));
  const maxY = Math.max(...itens.map((i) => i.y + i.dy));
  const offX = (container.comprimento_cm - (maxX - minX)) / 2 - minX;
  const offY = (container.largura_cm - (maxY - minY)) / 2 - minY;
  return itens.map((i) => ({ ...i, x: i.x + offX, y: i.y + offY }));
}

export interface CargaEixo {
  nome: string;
  posicao_cm: number;
  limite_kg: number;
  peso_kg: number;
  excede: boolean;
}

// Distribui o peso de cada caixa entre os dois eixos mais próximos (regra de viga simples).
// Itens fora do intervalo dos eixos vão 100% para o eixo mais próximo.
export function calcularPesoPorEixo(
  itens: ItemPosicionado[],
  eixos: EixoConfig[],
): CargaEixo[] {
  const acc = eixos.map((e) => ({ ...e, peso_kg: 0 }));
  if (eixos.length === 0) return [];
  const ordenados = [...eixos].map((e, idx) => ({ ...e, idx })).sort((a, b) => a.posicao_cm - b.posicao_cm);
  for (const it of itens) {
    const cx = it.x + it.dx / 2;
    const peso = Number(it.material.peso_kg);
    if (cx <= ordenados[0].posicao_cm) {
      acc[ordenados[0].idx].peso_kg += peso;
      continue;
    }
    if (cx >= ordenados[ordenados.length - 1].posicao_cm) {
      acc[ordenados[ordenados.length - 1].idx].peso_kg += peso;
      continue;
    }
    for (let k = 0; k < ordenados.length - 1; k++) {
      const a = ordenados[k];
      const b = ordenados[k + 1];
      if (cx >= a.posicao_cm && cx <= b.posicao_cm) {
        const t = (cx - a.posicao_cm) / (b.posicao_cm - a.posicao_cm);
        acc[a.idx].peso_kg += peso * (1 - t);
        acc[b.idx].peso_kg += peso * t;
        break;
      }
    }
  }
  return acc.map((a) => ({ ...a, peso_kg: Math.round(a.peso_kg), excede: a.peso_kg > a.limite_kg }));
}
