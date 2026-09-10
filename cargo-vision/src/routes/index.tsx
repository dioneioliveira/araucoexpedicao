import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Box, Truck, Cuboid } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CargoSim — Simulador 3D de Carga em Containers" },
      {
        name: "description",
        content:
          "Cadastre materiais, simule cargas em containers 40HC e visualize a disposição em 3D com cálculo de volume e peso.",
      },
      { property: "og:title", content: "CargoSim — Simulador 3D de Carga" },
      {
        property: "og:description",
        content: "Planejamento logístico visual: empacotamento 3D em container 40HC.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/simulacoes", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/simulacoes", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Cuboid className="h-6 w-6 text-blue-600" />
            CargoSim
          </div>
          <div className="flex gap-2">
            <Link to="/auth">
              <Button variant="outline">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button>Começar grátis</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Simule cargas em containers <span className="text-blue-600">40HC</span> em 3D
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Cadastre seus materiais com dimensões e peso, escolha as quantidades e veja
            instantaneamente a disposição da carga dentro do container — com aviso de espaço e
            limite de peso.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">Criar conta gratuita</Button>
            </Link>
          </div>
        </section>
        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          <Feature icon={<Box className="h-5 w-5" />} title="Cadastro de materiais">
            Dimensões em cm, peso em kg e cor de exibição para cada item.
          </Feature>
          <Feature icon={<Cuboid className="h-5 w-5" />} title="Empacotamento 3D">
            Algoritmo automático que tenta encaixar a maior quantidade possível.
          </Feature>
          <Feature icon={<Truck className="h-5 w-5" />} title="Controle de peso">
            Informe o limite do veículo e veja se a carga ultrapassa a capacidade.
          </Feature>
        </section>
      </main>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </div>
  );
}
