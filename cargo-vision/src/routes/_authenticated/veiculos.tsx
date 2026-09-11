import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { PRESETS_VEICULOS, type Veiculo } from "@/types/logistica";

export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => ({
    meta: [
      { title: "Veículos — CargoSim" },
      {
        name: "description",
        content:
          "Cadastre e gerencie veículos e containers para simulação de carga.",
      },
      { property: "og:title", content: "Veículos — CargoSim" },
      {
        property: "og:description",
        content:
          "Cadastre e gerencie veículos e containers para simulação de carga.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VeiculosPage,
});

interface VeiculoForm extends Veiculo {
  novo?: boolean;
  dirty?: boolean;
}

function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<VeiculoForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("*")
        .order("nome");
      if (error) toast.error(error.message);
      setVeiculos(
        ((data as Veiculo[]) ?? []).map((v) => ({
          ...v,
          comprimento_cm: Number(v.comprimento_cm),
          largura_cm: Number(v.largura_cm),
          altura_cm: Number(v.altura_cm),
          capacidade_peso_kg: Number(v.capacidade_peso_kg),
        })),
      );
      setLoading(false);
    })();
  }, []);

  function addVazio() {
    setVeiculos([
      ...veiculos,
      {
        id: crypto.randomUUID(),
        nome: "Novo veículo",
        comprimento_cm: 1200,
        largura_cm: 230,
        altura_cm: 269,
        capacidade_peso_kg: 10000,
        novo: true,
        dirty: true,
      },
    ]);
  }

  function addPreset(idx: number) {
    const p = PRESETS_VEICULOS[idx];
    setVeiculos([
      ...veiculos,
      { id: crypto.randomUUID(), ...p, novo: true, dirty: true },
    ]);
  }

  function atualizar(id: string, patch: Partial<VeiculoForm>) {
    setVeiculos(veiculos.map((v) => (v.id === id ? { ...v, ...patch, dirty: true } : v)));
  }

  async function salvar(v: VeiculoForm) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessão expirada");
    const payload = {
      nome: v.nome,
      comprimento_cm: v.comprimento_cm,
      largura_cm: v.largura_cm,
      altura_cm: v.altura_cm,
      capacidade_peso_kg: v.capacidade_peso_kg,
    };
    if (v.novo) {
      const { data, error } = await supabase
        .from("veiculos")
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error) return toast.error(error.message);
      setVeiculos(veiculos.map((x) => (x.id === v.id ? { ...(data as Veiculo), novo: false, dirty: false } : x)));
    } else {
      const { error } = await supabase.from("veiculos").update(payload).eq("id", v.id);
      if (error) return toast.error(error.message);
      setVeiculos(veiculos.map((x) => (x.id === v.id ? { ...x, dirty: false } : x)));
    }
    toast.success("Veículo salvo");
  }

  async function remover(v: VeiculoForm) {
    if (!v.novo) {
      const { error } = await supabase.from("veiculos").delete().eq("id", v.id);
      if (error) return toast.error(error.message);
    }
    setVeiculos(veiculos.filter((x) => x.id !== v.id));
  }

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Veículos de transporte</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addVazio}>
            <Plus className="mr-2 h-4 w-4" /> Em branco
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar a partir de um preset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PRESETS_VEICULOS.map((p, i) => (
              <Button key={p.nome} variant="outline" size="sm" onClick={() => addPreset(i)}>
                <Truck className="mr-2 h-3.5 w-3.5" /> {p.nome}
                <span className="ml-2 text-xs text-slate-400">
                  {p.comprimento_cm}×{p.largura_cm}×{p.altura_cm} cm
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {veiculos.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum veículo cadastrado. Use um preset acima ou crie em branco.
        </p>
      ) : (
        <div className="grid gap-3">
          {veiculos.map((v) => (
            <Card key={v.id}>
              <CardContent className="grid gap-3 pt-4 md:grid-cols-[1.5fr_repeat(4,1fr)_auto]">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={v.nome} onChange={(e) => atualizar(v.id, { nome: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Comprimento (cm)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={v.comprimento_cm}
                    onChange={(e) => atualizar(v.id, { comprimento_cm: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Largura (cm)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={v.largura_cm}
                    onChange={(e) => atualizar(v.id, { largura_cm: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Altura (cm)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={v.altura_cm}
                    onChange={(e) => atualizar(v.id, { altura_cm: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Peso máx. (kg)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={v.capacidade_peso_kg}
                    onChange={(e) => atualizar(v.id, { capacidade_peso_kg: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end gap-1">
                  <Button size="sm" onClick={() => salvar(v)} disabled={!v.dirty}>
                    <Save className="mr-1 h-3.5 w-3.5" /> Salvar
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remover(v)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
