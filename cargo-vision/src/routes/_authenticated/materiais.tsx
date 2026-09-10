import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Material } from "@/types/logistica";

export const Route = createFileRoute("/_authenticated/materiais")({
  head: () => ({
    meta: [
      { title: "Cadastro de Materiais — CargoSim" },
      {
        name: "description",
        content:
          "Cadastre materiais com dimensões, peso e propriedades para simulação de carga.",
      },
      { property: "og:title", content: "Cadastro de Materiais — CargoSim" },
      {
        property: "og:description",
        content:
          "Cadastre materiais com dimensões, peso e propriedades para simulação de carga.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MateriaisPage,
});

type Unidade = "mm" | "cm" | "m";
// fator para converter da unidade escolhida para cm
const FATOR: Record<Unidade, number> = { mm: 0.1, cm: 1, m: 100 };

const VAZIO = {
  nome: "",
  sku: "",
  comprimento: "",
  largura: "",
  altura: "",
  espessura: "",
  peso_kg: "",
  densidade_kg_m3: "",
  qtd_chapas: "",
  espessura_chapa: "",
  capa_superior: "",
  capa_inferior: "",
  altura_calcos: "",
  peso_insumos_kg: "",
  cor: "#3b82f6",
  permite_rotacao: true,
  rot_x: true,
  rot_y: true,
  rot_z: true,
  tipo_embalagem: "pe" as "pe" | "deitado",
};


const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

function MateriaisPage() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [unidade, setUnidade] = useState<Unidade>("cm");
  const [form, setForm] = useState({ ...VAZIO });

  const f = FATOR[unidade];

  // Altura calculada = espessura da chapa × qtd + capa superior + capa inferior + calços
  const alturaCalculada =
    n(form.espessura_chapa) * n(form.qtd_chapas) +
    n(form.capa_superior) +
    n(form.capa_inferior) +
    n(form.altura_calcos);
  const usaAlturaCalculada = alturaCalculada > 0;

  // Peso calculado = densidade × volume das chapas + peso padrão dos insumos
  const volumeChapasM3 =
    (n(form.comprimento) * f * (n(form.largura) * f) * (n(form.espessura_chapa) * f) * n(form.qtd_chapas)) /
    1_000_000;
  const pesoCalculado = n(form.densidade_kg_m3) * volumeChapasM3 + n(form.peso_insumos_kg);
  const usaPesoCalculado = pesoCalculado > 0;

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("materiais")
      .select("*")
      .order("criado_em", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setMateriais((data as Material[]) ?? []);
  }

  useEffect(() => {
    carregar();
  }, []);

  function trocarUnidade(nova: Unidade) {
    const k = FATOR[unidade] / FATOR[nova]; // converte valores atuais para a nova unidade
    const conv = (v: string) => (v === "" ? "" : String(Number((Number(v) * k).toFixed(4))));
    setForm((prev) => ({
      ...prev,
      comprimento: conv(prev.comprimento),
      largura: conv(prev.largura),
      altura: conv(prev.altura),
      espessura: conv(prev.espessura),
      espessura_chapa: conv(prev.espessura_chapa),
      capa_superior: conv(prev.capa_superior),
      capa_inferior: conv(prev.capa_inferior),
      altura_calcos: conv(prev.altura_calcos),
    }));
    setUnidade(nova);
  }

  function abrirNovo() {
    setEditId(null);
    setForm({ ...VAZIO });
    setUnidade("cm");
    setOpen(true);
  }

  function abrirEdicao(m: Material) {
    setEditId(m.id);
    setUnidade("cm");
    const s = (v: number | null | undefined) => (v != null ? String(Number(v)) : "");
    setForm({
      nome: m.nome,
      sku: m.sku ?? "",
      comprimento: String(Number(m.comprimento_cm)),
      largura: String(Number(m.largura_cm)),
      altura: String(Number(m.altura_cm)),
      espessura: s(m.espessura_cm),
      peso_kg: String(Number(m.peso_kg)),
      densidade_kg_m3: s(m.densidade_kg_m3),
      qtd_chapas: m.qtd_chapas != null ? String(m.qtd_chapas) : "",
      espessura_chapa: s(m.espessura_chapa_cm),
      capa_superior: s(m.capa_superior_cm),
      capa_inferior: s(m.capa_inferior_cm),
      altura_calcos: s(m.altura_calcos_cm),
      peso_insumos_kg: s(m.peso_insumos_kg),
      cor: m.cor,
      permite_rotacao: m.permite_rotacao !== false,
      rot_x: m.permite_rotacao !== false && m.rot_x !== false,
      rot_y: m.permite_rotacao !== false && m.rot_y !== false,
      rot_z: m.permite_rotacao !== false && m.rot_z !== false,
      tipo_embalagem: (m.tipo_embalagem === "deitado" ? "deitado" : "pe") as "pe" | "deitado",
    });

    setOpen(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const cm = (v: string) => (v === "" ? null : Number(v) * f);
    const comp = n(form.comprimento) * f;
    const larg = n(form.largura) * f;
    const alt = usaAlturaCalculada ? alturaCalculada * f : n(form.altura) * f;

    if (!comp || !larg || !alt) {
      toast.error("Informe comprimento, largura e altura (ou os dados do lote).");
      return;
    }

    let peso = usaPesoCalculado ? pesoCalculado : n(form.peso_kg);
    const densidade = form.densidade_kg_m3 ? Number(form.densidade_kg_m3) : null;
    if (!peso && densidade) peso = ((comp * larg * alt) / 1_000_000) * densidade;

    const payload = {
      nome: form.nome.trim(),
      sku: form.sku.trim() || null,
      comprimento_cm: comp,
      largura_cm: larg,
      altura_cm: alt,
      espessura_cm: cm(form.espessura),
      peso_kg: peso,
      densidade_kg_m3: densidade,
      qtd_chapas: form.qtd_chapas ? Number(form.qtd_chapas) : null,
      espessura_chapa_cm: cm(form.espessura_chapa),
      capa_superior_cm: cm(form.capa_superior),
      capa_inferior_cm: cm(form.capa_inferior),
      altura_calcos_cm: cm(form.altura_calcos),
      peso_insumos_kg: form.peso_insumos_kg ? Number(form.peso_insumos_kg) : null,
      cor: form.cor,
      permite_rotacao: form.rot_x || form.rot_y || form.rot_z,
      rot_x: form.rot_x,
      rot_y: form.rot_y,
      rot_z: form.rot_z,
      tipo_embalagem: form.tipo_embalagem,
      user_id: userData.user.id,

    };

    const { error } = editId
      ? await supabase.from("materiais").update(payload).eq("id", editId)
      : await supabase.from("materiais").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editId ? "Material atualizado" : "Material cadastrado");
    setOpen(false);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este material?")) return;
    const { error } = await supabase.from("materiais").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Material excluído");
    carregar();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Materiais</h1>
          <p className="text-sm text-slate-500">Cadastre os itens que poderão entrar nas simulações.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="mr-2 h-4 w-4" /> Novo material
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar material" : "Novo material"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={salvar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Material</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <Label>Tipo de embalagem do lote</Label>
                  <Select
                    value={form.tipo_embalagem}
                    onValueChange={(v) => setForm({ ...form, tipo_embalagem: v as "pe" | "deitado" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pe">Pé (posição normal)</SelectItem>
                      <SelectItem value="deitado">Deitado (rotacionado no eixo X)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">
                    "Deitado" tomba o lote no eixo X (troca largura ↔ altura) já na montagem da carga.
                  </p>
                </div>

                <div className="col-span-2">
                  <Label>Descrição (opcional)</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>

                <div className="col-span-2">
                  <Label>Unidade de medida do cadastro</Label>
                  <Select value={unidade} onValueChange={(v) => trocarUnidade(v as Unidade)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">Milímetros (mm)</SelectItem>
                      <SelectItem value="cm">Centímetros (cm)</SelectItem>
                      <SelectItem value="m">Metros (m)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">
                    Os valores são convertidos automaticamente ao trocar a unidade.
                  </p>
                </div>

                <div>
                  <Label>Comprimento ({unidade})</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={form.comprimento}
                    onChange={(e) => setForm({ ...form, comprimento: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Largura ({unidade})</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={form.largura}
                    onChange={(e) => setForm({ ...form, largura: e.target.value })}
                    required
                  />
                </div>

                <div className="col-span-2 rounded-md border bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Composição do lote (altura)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Espessura da chapa ({unidade})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.espessura_chapa}
                        onChange={(e) => setForm({ ...form, espessura_chapa: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Qtd. de chapas no lote</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={form.qtd_chapas}
                        onChange={(e) => setForm({ ...form, qtd_chapas: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Capa superior ({unidade})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.capa_superior}
                        onChange={(e) => setForm({ ...form, capa_superior: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Capa inferior ({unidade})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.capa_inferior}
                        onChange={(e) => setForm({ ...form, capa_inferior: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Altura dos calços ({unidade})</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.altura_calcos}
                        onChange={(e) => setForm({ ...form, altura_calcos: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Altura total ({unidade})</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={usaAlturaCalculada ? String(Number(alturaCalculada.toFixed(4))) : form.altura}
                        onChange={(e) => setForm({ ...form, altura: e.target.value })}
                        readOnly={usaAlturaCalculada}
                        required={!usaAlturaCalculada}
                      />
                      {usaAlturaCalculada && (
                        <p className="mt-1 text-xs text-slate-500">
                          chapas + capas + calços
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-span-2 rounded-md border bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Peso do lote</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Densidade (kg/m³)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.densidade_kg_m3}
                        onChange={(e) => setForm({ ...form, densidade_kg_m3: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Peso padrão dos insumos (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.peso_insumos_kg}
                        onChange={(e) => setForm({ ...form, peso_insumos_kg: e.target.value })}
                        placeholder="Capas, calços, cintas…"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Peso total do lote (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={usaPesoCalculado ? String(Number(pesoCalculado.toFixed(3))) : form.peso_kg}
                        onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
                        readOnly={usaPesoCalculado}
                      />
                      {usaPesoCalculado && (
                        <p className="mt-1 text-xs text-slate-500">
                          densidade × volume das chapas + peso dos insumos
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label>Cor de exibição</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.cor}
                      onChange={(e) => setForm({ ...form, cor: e.target.value })}
                      className="h-10 w-16 cursor-pointer rounded border"
                    />
                    <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
                  </div>
                </div>
                <div className="col-span-2 space-y-3 rounded-md border bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Rotações permitidas</p>
                    <p className="text-xs text-slate-500">
                      Bloqueie cada eixo separadamente. Desligar todos mantém o lote sempre na orientação cadastrada.
                    </p>
                  </div>
                  {([
                    ["rot_z", "Girar na horizontal (eixo Z)", "Troca comprimento ↔ largura"],
                    ["rot_y", "Tombar de lado (eixo Y)", "Troca comprimento ↔ altura"],
                    ["rot_x", "Tombar de frente (eixo X)", "Troca largura ↔ altura"],
                  ] as const).map(([key, titulo, desc]) => (
                    <div key={key} className="flex items-start gap-3">
                      <Switch
                        id={key}
                        checked={form[key]}
                        onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                      />
                      <div className="flex-1">
                        <Label htmlFor={key} className="cursor-pointer text-sm font-medium">
                          {titulo}
                        </Label>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{materiais.length} cadastrado(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : materiais.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum material cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">C×L×A (cm)</TableHead>
                  <TableHead className="text-right">Peso (kg)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiais.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="h-5 w-5 rounded" style={{ background: m.cor }} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {m.nome}
                        {m.permite_rotacao === false && (
                          <Lock className="h-3 w-3 text-slate-400" aria-label="Sem rotação" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{m.sku || "—"}</TableCell>
                    <TableCell className="text-right">
                      {Number(m.comprimento_cm)} × {Number(m.largura_cm)} × {Number(m.altura_cm)}
                    </TableCell>
                    <TableCell className="text-right">{Number(m.peso_kg).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => abrirEdicao(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => excluir(m.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
