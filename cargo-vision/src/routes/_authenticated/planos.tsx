import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos — CargoSim" },
      {
        name: "description",
        content: "Escolha o plano ideal para o CargoSim.",
      },
      { property: "og:title", content: "Planos — CargoSim" },
      {
        property: "og:description",
        content: "Escolha o plano ideal para o CargoSim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanosPage,
});

interface Plano {
  nome: string;
  preco: string;
  periodo: string;
  destaque?: boolean;
  beneficios: string[];
}

const PLANOS: Plano[] = [
  {
    nome: "Starter",
    preco: "R$ 49",
    periodo: "/mês",
    beneficios: [
      "Até 20 simulações por mês",
      "Cadastro de materiais e veículos",
      "Visualização 3D",
    ],
  },
  {
    nome: "Pro",
    preco: "R$ 149",
    periodo: "/mês",
    destaque: true,
    beneficios: [
      "Simulações ilimitadas",
      "Intervenção manual avançada",
      "Múltiplos veículos personalizados",
      "Suporte prioritário",
    ],
  },
  {
    nome: "Empresarial",
    preco: "Sob consulta",
    periodo: "",
    beneficios: [
      "Multiusuário",
      "Integrações via API",
      "SLA dedicado",
    ],
  },
];

function PlanosPage() {
  function assinar(plano: Plano) {
    toast.info(
      `Plano ${plano.nome} em breve! Em poucos cliques podemos ativar o checkout com cartão de crédito.`,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mensalidade da plataforma</h1>
        <p className="text-sm text-slate-500">
          Escolha o plano que melhor se adapta ao seu volume de operações.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANOS.map((p) => (
          <Card
            key={p.nome}
            className={p.destaque ? "border-blue-500 shadow-md ring-2 ring-blue-100" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{p.nome}</span>
                {p.destaque && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    <Sparkles className="h-3 w-3" /> Popular
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold text-slate-900">{p.preco}</span>
                <span className="text-sm text-slate-500">{p.periodo}</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {p.beneficios.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => assinar(p)}
                className="w-full"
                variant={p.destaque ? "default" : "outline"}
              >
                Assinar {p.nome}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
