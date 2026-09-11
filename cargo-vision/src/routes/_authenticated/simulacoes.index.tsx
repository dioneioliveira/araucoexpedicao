import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Box } from "lucide-react";
import { toast } from "sonner";
import type { Simulacao } from "@/types/logistica";

export const Route = createFileRoute("/_authenticated/simulacoes/")({
  head: () => ({
    meta: [
      { title: "Minhas Simulações — CargoSim" },
      {
        name: "description",
        content: "Lista de simulações de carga em containers e veículos.",
      },
      { property: "og:title", content: "Minhas Simulações — CargoSim" },
      {
        property: "og:description",
        content: "Lista de simulações de carga em containers e veículos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListaSimulacoes,
});

function ListaSimulacoes() {
  const [sims, setSims] = useState<Simulacao[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("simulacoes")
      .select("*")
      .order("atualizada_em", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSims((data as Simulacao[]) ?? []);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function novaSimulacao() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("simulacoes")
      .insert({
        user_id: userData.user.id,
        nome: `Simulação ${new Date().toLocaleString("pt-BR")}`,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    navigate({ to: "/simulacoes/$id", params: { id: data.id } });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta simulação?")) return;
    const { error } = await supabase.from("simulacoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    carregar();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Simulações</h1>
          <p className="text-sm text-slate-500">Crie cenários de carga e visualize em 3D.</p>
        </div>
        <Button onClick={novaSimulacao}>
          <Plus className="mr-2 h-4 w-4" /> Nova simulação
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : sims.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-500">
            Nenhuma simulação. Crie a primeira para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sims.map((s) => (
            <Card key={s.id} className="transition hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Box className="h-4 w-4 text-blue-600" />
                  {s.nome}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500">
                  Container {s.container_tipo} • limite {Number(s.capacidade_peso_kg).toLocaleString("pt-BR")} kg
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Atualizada em {new Date(s.atualizada_em).toLocaleString("pt-BR")}
                </p>
                <div className="mt-4 flex gap-2">
                  <Link to="/simulacoes/$id" params={{ id: s.id }} className="flex-1">
                    <Button variant="default" size="sm" className="w-full">
                      Abrir
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => excluir(s.id)}>
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
