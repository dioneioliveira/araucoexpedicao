import type { ResultadoPacking, Simulacao } from "@/types/logistica";

interface Args {
  sim: Simulacao;
  resultado: ResultadoPacking;
  /** Imagem (dataURL PNG) da carga no ângulo atual da tela. */
  imagemCarga?: string | null;
}

const CREDITO = "by Dionei Cleiton de Oliveira";

/**
 * Exporta um único arquivo de imagem (PNG) em formato A4 retrato contendo
 * todas as informações da simulação em uma só página.
 */
export async function exportarImagemRelatorio({ sim, resultado, imagemCarga }: Args) {
  const W = 1240; // A4 @150dpi
  const H = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const M = 60;
  let y = M;

  // Cabeçalho
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, 0, W, 12);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 38px Helvetica, Arial, sans-serif";
  ctx.fillText("Relatório de Simulação de Carga", M, (y += 40));

  ctx.font = "22px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText(sim.nome, M, (y += 36));
  ctx.fillStyle = "#64748b";
  ctx.font = "18px Helvetica, Arial, sans-serif";
  ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, M, (y += 28));

  // Veículo e indicadores
  const volPct = (resultado.volumeUsadoCm3 / resultado.volumeTotalCm3) * 100;
  const capacidade = Number(sim.capacidade_peso_kg);
  const pesoExcede = resultado.pesoTotalKg > capacidade;

  y += 26;
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(M, y, W - M * 2, 132);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px Helvetica, Arial, sans-serif";
  ctx.fillText("Veículo", M + 20, y + 32);
  ctx.font = "18px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText(
    `${sim.veiculo_nome} — ${sim.comprimento_cm} × ${sim.largura_cm} × ${sim.altura_cm} cm`,
    M + 20,
    y + 60,
  );
  ctx.fillText(
    `Itens encaixados: ${resultado.posicionados.length}   ·   Volume: ${(resultado.volumeUsadoCm3 / 1_000_000).toFixed(2)} m³ de ${(resultado.volumeTotalCm3 / 1_000_000).toFixed(2)} m³ (${volPct.toFixed(1)}%)`,
    M + 20,
    y + 88,
  );
  ctx.fillStyle = pesoExcede ? "#dc2626" : "#334155";
  ctx.fillText(
    `Peso total: ${resultado.pesoTotalKg.toLocaleString("pt-BR")} kg / ${capacidade.toLocaleString("pt-BR")} kg${pesoExcede ? " — EXCEDE LIMITE" : ""}`,
    M + 20,
    y + 116,
  );
  y += 132 + 30;

  // Agrupamento por material
  const grupo = new Map<string, { nome: string; sku: string; qtd: number; peso: number; dim: string; cor: string }>();
  for (const p of resultado.posicionados) {
    const key = p.material.id;
    const cur = grupo.get(key);
    if (cur) {
      cur.qtd += 1;
      cur.peso += Number(p.material.peso_kg);
    } else {
      grupo.set(key, {
        nome: p.material.nome,
        sku: p.material.sku ?? "—",
        qtd: 1,
        peso: Number(p.material.peso_kg),
        dim: `${Number(p.material.comprimento_cm)}×${Number(p.material.largura_cm)}×${Number(p.material.altura_cm)} cm`,
        cor: p.material.cor,
      });
    }
  }

  const linhas = Array.from(grupo.values());
  const naoEnc = resultado.naoEncaixados;
  const rowH = 30;
  const tabelaH = 40 + linhas.length * rowH + (naoEnc.length > 0 ? 40 + naoEnc.length * rowH : 0);
  const rodapeH = 70;
  const espacoImagem = H - y - tabelaH - rodapeH - 40;

  // Imagem 3D da carga (ângulo atual)
  if (imagemCarga && espacoImagem > 120) {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = imagemCarga;
    });
    if (img) {
      const maxW = W - M * 2;
      const escala = Math.min(maxW / img.width, espacoImagem / img.height);
      const iw = img.width * escala;
      const ih = img.height * escala;
      ctx.drawImage(img, M + (maxW - iw) / 2, y, iw, ih);
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(M + (maxW - iw) / 2, y, iw, ih);
      y += ih + 26;
    }
  }

  // Tabela de materiais
  const colX = [M + 10, M + 330, M + 620, M + 830, M + 960];
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(M, y, W - M * 2, 32);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px Helvetica, Arial, sans-serif";
  ["Material", "Descrição", "Dim. unit.", "Qtd", "Peso (kg)"].forEach((t, i) =>
    ctx.fillText(t, colX[i], y + 22),
  );
  y += 32;
  ctx.font = "16px Helvetica, Arial, sans-serif";
  linhas.forEach((g, i) => {
    ctx.fillStyle = i % 2 ? "#f8fafc" : "#ffffff";
    ctx.fillRect(M, y, W - M * 2, rowH);
    ctx.fillStyle = g.cor;
    ctx.fillRect(M + 2, y + 8, 6, 14);
    ctx.fillStyle = "#0f172a";
    const vals = [g.nome, g.sku, g.dim, String(g.qtd), g.peso.toLocaleString("pt-BR", { maximumFractionDigits: 2 })];
    vals.forEach((v, c) => ctx.fillText(String(v).slice(0, c === 0 ? 32 : 28), colX[c], y + 21));
    y += rowH;
  });

  if (naoEnc.length > 0) {
    y += 12;
    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 18px Helvetica, Arial, sans-serif";
    ctx.fillText("Itens não encaixados", M, y + 20);
    y += 28;
    ctx.font = "16px Helvetica, Arial, sans-serif";
    ctx.fillStyle = "#0f172a";
    naoEnc.forEach((nEnc) => {
      ctx.fillText(`• ${nEnc.material.nome} (${nEnc.material.sku ?? "—"}) × ${nEnc.quantidade}`, M + 10, y + 20);
      y += rowH;
    });
  }

  // Rodapé com crédito
  ctx.strokeStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.moveTo(M, H - 60);
  ctx.lineTo(W - M, H - 60);
  ctx.stroke();
  ctx.fillStyle = "#64748b";
  ctx.font = "italic 20px Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(CREDITO, W - M, H - 28);
  ctx.textAlign = "left";

  const nomeArquivo = `simulacao-${sim.nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}.png`;
  const link = document.createElement("a");
  link.download = nomeArquivo;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
