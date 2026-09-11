import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Play,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Hand,
  RotateCw,
  ArrowUp,
  ArrowDown,
  FileDown,
  ImageDown,
  ArrowDownWideNarrow,

} from "lucide-react";
import { toast } from "sonner";
import { calcularCarga, centralizarCarga, eixosLiberados, validarPosicoes } from "@/lib/packing";
import { gerarRelatorioPDF } from "@/lib/relatorio-pdf";
import { exportarImagemRelatorio } from "@/lib/relatorio-imagem";
import { MaterialCombobox } from "@/components/material-combobox";
import {
  type ItemPosicionado,
  type Material,
  type ResultadoPacking,
  type Simulacao,
  type Veiculo,
  PRESETS_VEICULOS,
} from "@/types/logistica";


const CenaContainer = lazy(() => import("@/components/cena-container"));

export const Route = createFileRoute("/_authenticated/simulacoes/$id")({
  head: () => ({
    meta: [
      { title: "Editor de Simulação — CargoSim" },
      {
        name: "description",
        content:
          "Edite a simulação de carga, ajuste itens e visualize a disposição 3D no container ou veículo.",
      },
      { property: "og:title", content: "Editor de Simulação — CargoSim" },
      {
        property: "og:description",
        content:
          "Edite a simulação de carga, ajuste itens e visualize a disposição 3D no container ou veículo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditorSimulacao,
});

interface ItemForm {
  id: string;
  itemDbId?: string;
  material_id: string;
  /** texto livre — permite campo vazio enquanto o usuário digita */
  quantidade: string;
}

const qtdNum = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
};

function EditorSimulacao() {
  const { id } = Route.useParams();
  const [sim, setSim] = useState<Simulacao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [resultado, setResultado] = useState<ResultadoPacking | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [centralizar, setCentralizar] = useState(false);
  const [respeitarEmpilhamento, setRespeitarEmpilhamento] = useState(true);
  const [unidade, setUnidade] = useState<"cm" | "m" | "mm" | "pol">("cm");
  /** Altura máxima (cm) em que a base de um lote pode ser elevada pelos garfos da empilhadeira. */
  const [alturaMaxElevacao, setAlturaMaxElevacao] = useState("180");


  const fator = unidade === "cm" ? 1 : unidade === "m" ? 0.01 : unidade === "mm" ? 10 : 1 / 2.54;
  const toUnit = (cm: number) => cm * fator;
  const fromUnit = (v: number) => v / fator;
  const fmt = (cm: number) =>
    unidade === "mm" || unidade === "cm"
      ? Math.round(toUnit(cm)).toString()
      : toUnit(cm).toFixed(2);

  useEffect(() => {
    (async () => {
      const [
        { data: simData, error: e1 },
        { data: matData, error: e2 },
        { data: itData, error: e3 },
        { data: veicData },
      ] = await Promise.all([
        supabase.from("simulacoes").select("*").eq("id", id).single(),
        supabase.from("materiais").select("*").order("nome"),
        supabase.from("simulacao_itens").select("*").eq("simulacao_id", id),
        supabase.from("veiculos").select("*").order("nome"),
      ]);
      if (e1 || e2 || e3) {
        toast.error("Erro ao carregar simulação");
        setLoading(false);
        return;
      }
      const s = simData as Simulacao;
      setSim({
        ...s,
        comprimento_cm: Number(s.comprimento_cm),
        largura_cm: Number(s.largura_cm),
        altura_cm: Number(s.altura_cm),
        capacidade_peso_kg: Number(s.capacidade_peso_kg),
      });
      setMateriais((matData as Material[]) ?? []);
      setVeiculos(
        ((veicData as Veiculo[]) ?? []).map((v) => ({
          ...v,
          comprimento_cm: Number(v.comprimento_cm),
          largura_cm: Number(v.largura_cm),
          altura_cm: Number(v.altura_cm),
          capacidade_peso_kg: Number(v.capacidade_peso_kg),
        })),
      );
      setItens(
        ((itData as Array<{ id: string; material_id: string; quantidade: number }>) ?? []).map((i) => ({
          id: crypto.randomUUID(),
          itemDbId: i.id,
          material_id: i.material_id,
          quantidade: String(i.quantidade),
        })),
      );
      setLoading(false);
    })();
  }, [id]);

  const mapMat = useMemo(() => new Map(materiais.map((m) => [m.id, m])), [materiais]);




  function addItem() {
    if (materiais.length === 0) {
      toast.error("Cadastre materiais antes.");
      return;
    }
    setItens([...itens, { id: crypto.randomUUID(), material_id: materiais[0].id, quantidade: "" }]);
  }

  function calcular(op?: { minimizarAltura?: boolean }) {
    if (!sim) return;
    const minimizarAltura = op?.minimizarAltura === true;
    setCalculando(true);
    setTimeout(() => {
      const lista = itens
        .map((i) => ({ material: mapMat.get(i.material_id), quantidade: qtdNum(i.quantidade) }))
        .filter((i): i is { material: Material; quantidade: number } => !!i.material && i.quantidade > 0);
      const limite = Number(alturaMaxElevacao);
      const r = calcularCarga(lista, {
        comprimento_cm: sim.comprimento_cm,
        largura_cm: sim.largura_cm,
        altura_cm: sim.altura_cm,
      }, {
        respeitarEmpilhamento,
        minimizarAltura,
        alturaMaxElevacaoCm: Number.isFinite(limite) && limite > 0 ? limite : undefined,
      });

      if (centralizar) {
        r.posicionados = centralizarCarga(r.posicionados, {
          comprimento_cm: sim.comprimento_cm,
          largura_cm: sim.largura_cm,
        });
      }
      setResultado(r);
      setSelectedUid(null);
      setCalculando(false);
      const alturaMax = r.posicionados.reduce((s, p) => Math.max(s, p.z + p.dz), 0);
      if (r.naoEncaixados.length === 0) {
        toast.success(
          minimizarAltura
            ? `Carga nivelada: ${r.posicionados.length} lotes, altura máx. ${Math.round(alturaMax)} cm.`
            : `Todos os ${r.posicionados.length} itens foram encaixados!`,
        );
      } else {
        const total = r.posicionados.length + r.naoEncaixados.reduce((s, n) => s + n.quantidade, 0);
        toast.warning(`${r.posicionados.length}/${total} itens encaixados. ${r.naoEncaixados.reduce((s, n) => s + n.quantidade, 0)} ficaram fora.`);
      }
    }, 10);
  }


  // Aplica/remove centralização sem precisar recalcular.
  function alternarCentralizar(v: boolean) {
    setCentralizar(v);
    if (!resultado || !sim) return;
    if (v) {
      atualizarPosicionados(
        centralizarCarga(resultado.posicionados, {
          comprimento_cm: sim.comprimento_cm,
          largura_cm: sim.largura_cm,
        }),
      );
    }
  }

  function adicionarManual(materialId: string) {
    const m = mapMat.get(materialId);
    if (!m || !resultado) return;
    const novo: ItemPosicionado = {
      uid: `manual-${crypto.randomUUID()}`,
      material: m,
      x: 0,
      y: 0,
      z: 0,
      dx: Number(m.comprimento_cm),
      dy: Number(m.largura_cm),
      dz: Number(m.altura_cm),
    };
    const novos = [...resultado.posicionados, novo];
    atualizarPosicionados(novos);
    setSelectedUid(novo.uid);
  }

  function atualizarPosicionados(novos: ItemPosicionado[]) {
    if (!resultado) return;
    const volumeUsadoCm3 = novos.reduce((s, p) => s + p.dx * p.dy * p.dz, 0);
    const pesoTotalKg = novos.reduce((s, p) => s + Number(p.material.peso_kg), 0);
    setResultado({ ...resultado, posicionados: novos, volumeUsadoCm3, pesoTotalKg });
  }

  function atualizarItem(uid: string, patch: Partial<ItemPosicionado>) {
    if (!resultado) return;
    atualizarPosicionados(
      resultado.posicionados.map((p) => (p.uid === uid ? { ...p, ...patch } : p)),
    );
  }

  // arraste 3D: permite mover livremente, inclusive para fora dos limites do veículo
  // (para facilitar reposicionamento). A validação destaca se algo ficou fora.
  function moverItemDrag(uid: string, x_cm: number, y_cm: number) {
    if (!resultado) return;
    const item = resultado.posicionados.find((p) => p.uid === uid);
    if (!item) return;
    const snap = (v: number) => Math.round(v / 5) * 5;
    const nx = snap(x_cm);
    const ny = snap(y_cm);
    if (nx === item.x && ny === item.y) return;
    atualizarPosicionados(
      resultado.posicionados.map((p) => (p.uid === uid ? { ...p, x: nx, y: ny } : p)),
    );
  }

  function moverCamada(delta: number) {
    if (!resultado || !selectedUid || !sim) return;
    const it = resultado.posicionados.find((p) => p.uid === selectedUid);
    if (!it) return;
    const passo = delta * it.dz;
    const nz = Math.max(0, Math.min(sim.altura_cm - it.dz, it.z + passo));
    atualizarItem(selectedUid, { z: nz });
  }



  function rotacionarSelecionado(eixo: "x" | "y" | "z" = "z") {
    if (!resultado || !selectedUid) return;
    const it = resultado.posicionados.find((p) => p.uid === selectedUid);
    if (!it) return;
    if (!eixosLiberados(it.material)[eixo]) {
      toast.error(`Rotação no eixo ${eixo.toUpperCase()} bloqueada no cadastro do material.`);
      return;
    }
    // troca duas das três dimensões dependendo do eixo de rotação
    if (eixo === "x") atualizarItem(selectedUid, { dy: it.dz, dz: it.dy });
    else if (eixo === "y") atualizarItem(selectedUid, { dx: it.dz, dz: it.dx });
    else atualizarItem(selectedUid, { dx: it.dy, dy: it.dx });
  }

  // Tenta encaixar o item selecionado no menor espaço livre disponível (snap-to-fit).
  function encaixarSelecionado() {
    if (!resultado || !selectedUid || !sim) return;
    const it = resultado.posicionados.find((p) => p.uid === selectedUid);
    if (!it) return;
    const outros = resultado.posicionados.filter((p) => p.uid !== selectedUid);
    const passo = 5;
    type Candidato = { x: number; y: number; z: number; score: number };
    let melhor: Candidato | null = null;
    const colide = (x: number, y: number, z: number) =>
      outros.some(
        (o) =>
          x < o.x + o.dx - 1e-6 &&
          x + it.dx > o.x + 1e-6 &&
          y < o.y + o.dy - 1e-6 &&
          y + it.dy > o.y + 1e-6 &&
          z < o.z + o.dz - 1e-6 &&
          z + it.dz > o.z + 1e-6,
      );
    for (let z = 0; z <= sim.altura_cm - it.dz; z += passo) {
      for (let y = 0; y <= sim.largura_cm - it.dy; y += passo) {
        for (let x = 0; x <= sim.comprimento_cm - it.dx; x += passo) {
          if (colide(x, y, z)) continue;
          // suporte: chão ou apoio em outras caixas
          let apoiado = z < 1e-6;
          if (!apoiado) {
            const areaBase = it.dx * it.dy;
            let apoio = 0;
            for (const o of outros) {
              if (Math.abs(o.z + o.dz - z) > 1e-6) continue;
              const ox = Math.max(0, Math.min(x + it.dx, o.x + o.dx) - Math.max(x, o.x));
              const oy = Math.max(0, Math.min(y + it.dy, o.y + o.dy) - Math.max(y, o.y));
              apoio += ox * oy;
            }
            apoiado = apoio / areaBase >= 0.7;
          }
          if (!apoiado) continue;
          const score = x + y * 10 + z * 1000;
          if (!melhor || score < melhor.score) melhor = { x, y, z, score };
        }
      }
    }
    if (!melhor) {
      toast.error("Não há posição livre para encaixar este item.");
      return;
    }
    atualizarItem(selectedUid, { x: melhor.x, y: melhor.y, z: melhor.z });
    toast.success("Item encaixado.");
  }

  function capturarCena(): string | null {
    try {
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      return canvas ? canvas.toDataURL("image/png") : null;
    } catch {
      return null;
    }
  }

  function exportarPDF() {
    if (!sim || !resultado) {
      toast.error("Calcule a carga antes de exportar.");
      return;
    }
    gerarRelatorioPDF({ sim, resultado, imagemCarga: capturarCena() });
  }

  async function exportarImagem() {
    if (!sim || !resultado) {
      toast.error("Calcule a carga antes de exportar.");
      return;
    }
    await exportarImagemRelatorio({ sim, resultado, imagemCarga: capturarCena() });
    toast.success("Imagem exportada.");
  }

  function removerSelecionado() {
    if (!resultado || !selectedUid) return;
    atualizarPosicionados(resultado.posicionados.filter((p) => p.uid !== selectedUid));
    setSelectedUid(null);
  }

  function ativarManual(v: boolean) {
    setModoManual(v);
    if (v && !resultado) {
      // inicia com auto para o usuário ajustar
      calcular();
    }
  }

  async function salvar() {
    if (!sim || salvando) return;
    setSalvando(true);
    try {
      const { data, error: e1 } = await supabase
        .from("simulacoes")
        .update({
          nome: sim.nome.trim() || "Simulação",
          capacidade_peso_kg: sim.capacidade_peso_kg,
          veiculo_nome: sim.veiculo_nome,
          comprimento_cm: sim.comprimento_cm,
          largura_cm: sim.largura_cm,
          altura_cm: sim.altura_cm,
          atualizada_em: new Date().toISOString(),
        })
        .eq("id", sim.id)
        .select("id, nome");
      if (e1) {
        toast.error(`Não foi possível salvar: ${e1.message}`);
        return;
      }
      if (!data || data.length === 0) {
        toast.error("Não foi possível salvar: simulação não encontrada para este usuário.");
        return;
      }

      const { error: eDel } = await supabase.from("simulacao_itens").delete().eq("simulacao_id", sim.id);
      if (eDel) {
        toast.error(`Itens não salvos: ${eDel.message}`);
        return;
      }
      const payload = itens
        .filter((i) => i.material_id && qtdNum(i.quantidade) > 0)
        .map((i) => ({ simulacao_id: sim.id, material_id: i.material_id, quantidade: qtdNum(i.quantidade) }));
      if (payload.length > 0) {
        const { error: e2 } = await supabase.from("simulacao_itens").insert(payload);
        if (e2) {
          toast.error(`Itens não salvos: ${e2.message}`);
          return;
        }
      }
      setSim({ ...sim, nome: data[0].nome as string });
      toast.success("Simulação salva");
    } finally {
      setSalvando(false);
    }
  }

  if (loading || !sim) return <p className="text-sm text-slate-500">Carregando…</p>;

  const volPct = resultado ? (resultado.volumeUsadoCm3 / resultado.volumeTotalCm3) * 100 : 0;
  const pesoExcede = resultado ? resultado.pesoTotalKg > Number(sim.capacidade_peso_kg) : false;
  const cabeTudo = resultado ? resultado.naoEncaixados.length === 0 : true;
  const selecionado = resultado?.posicionados.find((p) => p.uid === selectedUid) ?? null;
  const validacaoManual = modoManual && resultado ? validarPosicoes(resultado.posicionados) : null;

  // Peso previsto antes do cálculo (soma dos itens selecionados × qtd)
  const pesoPrevisto = itens.reduce((s, i) => {
    const m = mapMat.get(i.material_id);
    return s + (m ? Number(m.peso_kg) * qtdNum(i.quantidade) : 0);
  }, 0);
  const pesoPrevistoExcede = pesoPrevisto > Number(sim.capacidade_peso_kg);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <Link to="/simulacoes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Input
            value={sim.nome}
            onChange={(e) => setSim({ ...sim, nome: e.target.value })}
            className="max-w-md text-lg font-semibold"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5">
            <Label htmlFor="unidade-medida" className="cursor-pointer text-sm text-slate-500">
              Unidade
            </Label>
            <Select value={unidade} onValueChange={(v) => setUnidade(v as typeof unidade)}>
              <SelectTrigger id="unidade-medida" className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="m">m</SelectItem>
                <SelectItem value="mm">mm</SelectItem>
                <SelectItem value="pol">pol</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5">
            <Label htmlFor="centralizar-mode" className="cursor-pointer text-sm">
              Centralizar carga
            </Label>
            <Switch id="centralizar-mode" checked={centralizar} onCheckedChange={alternarCentralizar} />
          </div>
          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5" title="Não empilha itens mais pesados ou com base maior sobre itens menores/mais leves">
            <Label htmlFor="regra-empilhar" className="cursor-pointer text-sm">
              Peso e base
            </Label>
            <Switch id="regra-empilhar" checked={respeitarEmpilhamento} onCheckedChange={setRespeitarEmpilhamento} />
          </div>

          <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-1.5">
            <Hand className="h-4 w-4 text-slate-500" />
            <Label htmlFor="manual-mode" className="cursor-pointer text-sm">
              Intervenção manual
            </Label>
            <Switch id="manual-mode" checked={modoManual} onCheckedChange={ativarManual} />
          </div>
          <Button variant="outline" onClick={salvar} disabled={salvando}>
            <Save className="mr-2 h-4 w-4" /> {salvando ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={exportarImagem} disabled={!resultado}>
            <ImageDown className="mr-2 h-4 w-4" /> Imagem
          </Button>
          <Button variant="outline" onClick={exportarPDF} disabled={!resultado}>
            <FileDown className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => calcular({ minimizarAltura: true })}
            disabled={calculando || itens.length === 0}
            title="Recalcula buscando a menor altura possível da carga (mistura lotes em pé e deitados)"
          >
            <ArrowDownWideNarrow className="mr-2 h-4 w-4" /> Baixar altura
          </Button>
          <Button onClick={() => calcular()} disabled={calculando || itens.length === 0}>
            <Play className="mr-2 h-4 w-4" /> Calcular carga
          </Button>

        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:grid-rows-2">
        <Card className="lg:col-start-2 lg:row-start-1">
          <CardHeader>
            <CardTitle className="text-base">Itens & limite de peso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Veículo</Label>
              <Select
                value={`${sim.veiculo_nome}|${sim.comprimento_cm}|${sim.largura_cm}|${sim.altura_cm}|${sim.capacidade_peso_kg}`}
                onValueChange={(v) => {
                  const [nome, c, l, a, p] = v.split("|");
                  setSim({
                    ...sim,
                    veiculo_nome: nome,
                    comprimento_cm: Number(c),
                    largura_cm: Number(l),
                    altura_cm: Number(a),
                    capacidade_peso_kg: p ? Number(p) : sim.capacidade_peso_kg,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Garante que o valor atual sempre apareça selecionado */}
                  <SelectItem
                    value={`${sim.veiculo_nome}|${sim.comprimento_cm}|${sim.largura_cm}|${sim.altura_cm}|${sim.capacidade_peso_kg}`}
                  >
                    {sim.veiculo_nome} · {fmt(sim.comprimento_cm)}×{fmt(sim.largura_cm)}×{fmt(sim.altura_cm)} {unidade} (atual)
                  </SelectItem>
                  {veiculos.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-400">Meus veículos</div>
                      {veiculos.map((v) => (
                        <SelectItem
                          key={v.id}
                          value={`${v.nome}|${v.comprimento_cm}|${v.largura_cm}|${v.altura_cm}|${v.capacidade_peso_kg}`}
                        >
                          {v.nome} · {fmt(v.comprimento_cm)}×{fmt(v.largura_cm)}×{fmt(v.altura_cm)} {unidade}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  <div className="px-2 py-1 text-xs font-semibold text-slate-400">Presets</div>
                  {PRESETS_VEICULOS.map((p) => (
                    <SelectItem
                      key={p.nome}
                      value={`${p.nome}|${p.comprimento_cm}|${p.largura_cm}|${p.altura_cm}|${p.capacidade_peso_kg}`}
                    >
                      {p.nome} · {fmt(p.comprimento_cm)}×{fmt(p.largura_cm)}×{fmt(p.altura_cm)} {unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                Interno: {fmt(sim.comprimento_cm)} × {fmt(sim.largura_cm)} × {fmt(sim.altura_cm)} {unidade}
              </p>
            </div>
            <div>
              <Label>Capacidade de peso (kg)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={sim.capacidade_peso_kg}
                onChange={(e) => setSim({ ...sim, capacidade_peso_kg: Number(e.target.value) })}
                className={pesoPrevistoExcede ? "border-red-500 focus-visible:ring-red-400" : ""}
              />
              <p
                className={`mt-1 text-xs ${
                  pesoPrevistoExcede ? "font-semibold text-red-600" : "text-slate-400"
                }`}
              >
                Peso previsto: {pesoPrevisto.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg
                {pesoPrevistoExcede &&
                  ` — excede em ${(pesoPrevisto - Number(sim.capacidade_peso_kg)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`}
              </p>
            </div>
            <div>
              <Label>Elevação máxima da base do lote (cm)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={alturaMaxElevacao}
                onChange={(e) => setAlturaMaxElevacao(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Curso máximo dos garfos da empilhadeira ({(Number(alturaMaxElevacao) / 100 || 0).toFixed(2)} m).
                Lotes cuja base precisaria subir acima disso não são empilhados.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materiais</Label>
                <Button size="sm" variant="ghost" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar
                </Button>
              </div>
              {itens.length === 0 && (
                <p className="text-xs text-slate-400">Nenhum item. Adicione materiais para simular.</p>
              )}
              {itens.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <MaterialCombobox
                    materiais={materiais}
                    value={it.material_id}
                    onChange={(v) =>
                      setItens(itens.map((x) => (x.id === it.id ? { ...x, material_id: v } : x)))
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Qtd"
                    value={it.quantidade}
                    onChange={(e) =>
                      setItens(itens.map((x) => (x.id === it.id ? { ...x, quantidade: e.target.value } : x)))
                    }
                    className="w-24"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setItens(itens.filter((x) => x.id !== it.id))}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <Card className="overflow-hidden h-full">
            <div className="h-[calc(100vh-140px)] min-h-[900px] w-full">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-slate-400">Carregando 3D…</div>}>
                <CenaContainer
                  itens={resultado?.posicionados ?? []}
                  selectedUid={selectedUid}
                  onSelect={modoManual ? setSelectedUid : undefined}
                  onMove={modoManual ? moverItemDrag : undefined}
                  container={{
                    comprimento_cm: sim.comprimento_cm,
                    largura_cm: sim.largura_cm,
                    altura_cm: sim.altura_cm,
                  }}
                />
              </Suspense>
            </div>
          </Card>
        </div>


        <Card className="lg:col-start-2 lg:row-start-2">
          <CardHeader>
            <CardTitle className="text-base">
              {modoManual ? "Posicionamento manual" : "Resultado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {modoManual ? (
              <>
                {!resultado ? (
                  <p className="text-sm text-slate-500">Clique em "Calcular carga" para começar a ajustar.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Adicionar caixa</Label>
                      <MaterialCombobox
                        materiais={materiais}
                        value={null}
                        onChange={(v) => adicionarManual(v)}
                        placeholder="Digite ou escolha um material…"
                      />
                      <p className="text-xs text-slate-400">
                        Clique em uma caixa na cena 3D para selecioná-la.
                      </p>
                    </div>

                    {selecionado ? (
                      <div className="space-y-3 rounded-md border bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex flex-col text-sm">
                            <span className="inline-flex items-center gap-2 font-medium">
                              <span
                                className="inline-block h-3 w-3 rounded"
                                style={{ background: selecionado.material.cor }}
                              />
                              {selecionado.material.nome}
                            </span>
                            {selecionado.material.sku && (
                              <span className="text-xs text-slate-500">SKU: {selecionado.material.sku}</span>
                            )}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => moverCamada(1)}
                              title="Subir uma camada"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => moverCamada(-1)}
                              title="Descer uma camada"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            {(["x", "y", "z"] as const).map((eixo) => (
                              <Button
                                key={eixo}
                                size="icon"
                                variant="outline"
                                onClick={() => rotacionarSelecionado(eixo)}
                                title={
                                  !eixosLiberados(selecionado.material)[eixo]
                                    ? "Rotação bloqueada no cadastro do material"
                                    : `Rotacionar no eixo ${eixo.toUpperCase()}`
                                }
                                disabled={!eixosLiberados(selecionado.material)[eixo]}
                                className="relative"
                              >
                                <RotateCw className="h-4 w-4" />
                                <span className="absolute -bottom-0.5 -right-0.5 rounded bg-slate-700 px-1 text-[8px] font-bold text-white">
                                  {eixo.toUpperCase()}
                                </span>
                              </Button>
                            ))}
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={encaixarSelecionado}
                              title="Encaixar no menor espaço livre"
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={removerSelecionado} title="Remover">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(["x", "y", "z"] as const).map((eixo) => (
                            <div key={eixo}>
                              <Label className="text-xs uppercase">{eixo} ({unidade})</Label>
                              <Input
                                type="number"
                                step={unidade === "m" ? "0.01" : "1"}
                                value={fmt(selecionado[eixo])}
                                onChange={(e) =>
                                  atualizarItem(selecionado.uid, { [eixo]: fromUnit(Number(e.target.value)) })
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">
                          Dim: {fmt(selecionado.dx)} × {fmt(selecionado.dy)} × {fmt(selecionado.dz)} {unidade}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Nenhuma caixa selecionada.</p>
                    )}

                    {validacaoManual && !validacaoManual.ok && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Problemas no posicionamento</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc pl-4 text-xs">
                            {validacaoManual.erros.slice(0, 6).map((er, i) => (
                              <li key={i}>{er}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {validacaoManual && validacaoManual.ok && (
                      <Alert className="border-green-200 bg-green-50 text-green-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Layout válido</AlertTitle>
                        <AlertDescription>Sem colisões ou caixas fora do container.</AlertDescription>
                      </Alert>
                    )}

                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Volume usado</span>
                        <span>{volPct.toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.min(100, volPct)} />
                    </div>
                  </>
                )}
              </>
            ) : !resultado ? (
              <p className="text-sm text-slate-500">Clique em "Calcular carga" para simular.</p>
            ) : (
              <>
                {cabeTudo && !pesoExcede && (
                  <Alert className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Toda a carga cabe!</AlertTitle>
                    <AlertDescription>Itens encaixam no container e respeitam o limite de peso.</AlertDescription>
                  </Alert>
                )}
                {!cabeTudo && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Carga não cabe</AlertTitle>
                    <AlertDescription>
                      Alguns itens ficaram de fora — ative a intervenção manual para reposicionar.
                    </AlertDescription>
                  </Alert>
                )}
                {pesoExcede && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Peso excede capacidade</AlertTitle>
                    <AlertDescription>
                      {resultado.pesoTotalKg.toLocaleString("pt-BR")} kg /{" "}
                      {Number(sim.capacidade_peso_kg).toLocaleString("pt-BR")} kg
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Volume usado</span>
                    <span>{volPct.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(100, volPct)} />
                  <p className="mt-1 text-xs text-slate-400">
                    {(resultado.volumeUsadoCm3 / 1_000_000).toFixed(2)} m³ /{" "}
                    {(resultado.volumeTotalCm3 / 1_000_000).toFixed(2)} m³
                  </p>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Peso total</span>
                    <span className={pesoExcede ? "font-semibold text-red-600" : ""}>
                      {resultado.pesoTotalKg.toLocaleString("pt-BR")} kg
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (resultado.pesoTotalKg / Number(sim.capacidade_peso_kg)) * 100)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Limite: {Number(sim.capacidade_peso_kg).toLocaleString("pt-BR")} kg
                  </p>
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium text-slate-700">Encaixados: {resultado.posicionados.length}</p>
                  {resultado.naoEncaixados.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-700">Não encaixados:</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {resultado.naoEncaixados.map((n) => (
                          <li key={n.material.id}>
                            • {n.material.nome} × {n.quantidade}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
