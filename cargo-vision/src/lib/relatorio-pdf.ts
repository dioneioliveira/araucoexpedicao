import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ResultadoPacking, Simulacao } from "@/types/logistica";

interface Args {
  sim: Simulacao;
  resultado: ResultadoPacking;
  /** Imagem (dataURL PNG) da carga no ângulo em que está posicionada na tela. */
  imagemCarga?: string | null;
}

export function gerarRelatorioPDF({ sim, resultado, imagemCarga }: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Simulação de Carga", margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Simulação: ${sim.nome}`, margin, y);
  y += 5;
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    margin,
    y,
  );
  y += 7;

  // Resumo do veículo
  doc.setFont("helvetica", "bold");
  doc.text("Veículo", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(
    `${sim.veiculo_nome} — ${sim.comprimento_cm} × ${sim.largura_cm} × ${sim.altura_cm} cm`,
    margin,
    y,
  );
  y += 5;
  doc.text(
    `Capacidade de peso: ${Number(sim.capacidade_peso_kg).toLocaleString("pt-BR")} kg`,
    margin,
    y,
  );
  y += 7;

  // Indicadores
  const volPct = (resultado.volumeUsadoCm3 / resultado.volumeTotalCm3) * 100;
  const pesoExcede = resultado.pesoTotalKg > Number(sim.capacidade_peso_kg);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Itens encaixados: ${resultado.posicionados.length}`, margin, y);
  y += 5;
  doc.text(
    `Volume usado: ${(resultado.volumeUsadoCm3 / 1_000_000).toFixed(2)} m³ de ${(resultado.volumeTotalCm3 / 1_000_000).toFixed(2)} m³ (${volPct.toFixed(1)}%)`,
    margin,
    y,
  );
  y += 5;
  doc.text(
    `Peso total: ${resultado.pesoTotalKg.toLocaleString("pt-BR")} kg / ${Number(sim.capacidade_peso_kg).toLocaleString("pt-BR")} kg${pesoExcede ? "  — EXCEDE LIMITE" : ""}`,
    margin,
    y,
  );
  if (pesoExcede) {
    doc.setTextColor(220, 38, 38);
    doc.text(
      `ATENÇÃO: peso excede a capacidade do veículo em ${(resultado.pesoTotalKg - Number(sim.capacidade_peso_kg)).toLocaleString("pt-BR")} kg`,
      margin,
      y + 5,
    );
    doc.setTextColor(0, 0, 0);
    y += 5;
  }
  y += 7;

  // Tabela de itens encaixados agrupados por material
  const grupo = new Map<string, { nome: string; sku: string | null; qtd: number; peso: number; dim: string }>();
  for (const p of resultado.posicionados) {
    const key = p.material.id;
    const dim = `${Number(p.material.comprimento_cm)}×${Number(p.material.largura_cm)}×${Number(p.material.altura_cm)} cm`;
    const cur = grupo.get(key);
    if (cur) {
      cur.qtd += 1;
      cur.peso += Number(p.material.peso_kg);
    } else {
      grupo.set(key, {
        nome: p.material.nome,
        sku: p.material.sku,
        qtd: 1,
        peso: Number(p.material.peso_kg),
        dim,
      });
    }
  }

  autoTable(doc, {
    startY: y,
    head: [["Material", "Descrição", "Dim. unit.", "Qtd", "Peso total (kg)"]],
    body: Array.from(grupo.values()).map((g) => [
      g.nome,
      g.sku ?? "—",
      g.dim,
      g.qtd.toString(),
      g.peso.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
    ]),
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
  });

  // Não encaixados
  if (resultado.naoEncaixados.length > 0) {
    const after = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("Itens não encaixados", margin, after);
    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: after + 3,
      head: [["Material", "Descrição", "Qtd"]],
      body: resultado.naoEncaixados.map((n) => [
        n.material.nome,
        n.material.sku ?? "—",
        n.quantidade.toString(),
      ]),
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 9 },
    });
  }

  // Imagem da carga (ângulo atual da tela) — substitui a lista de posições
  if (imagemCarga) {
    let imgY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    const props = doc.getImageProperties(imagemCarga);
    const imgW = maxW;
    const imgH = (props.height / props.width) * imgW;
    if (imgY + imgH + 12 > pageH - margin) {
      doc.addPage();
      imgY = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Imagem da carga", margin, imgY);
    doc.addImage(imagemCarga, "PNG", margin, imgY + 3, imgW, imgH);
  }


  // Crédito no rodapé de todas as páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text(
      "by Dionei Cleiton de Oliveira",
      doc.internal.pageSize.getWidth() - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }
  doc.setTextColor(0, 0, 0);

  const nomeArquivo = `simulacao-${sim.nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nomeArquivo);
}
