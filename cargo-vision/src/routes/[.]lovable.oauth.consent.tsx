import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OAuthResult = { redirect_url?: string; redirect_to?: string; client?: { name?: string } };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-6 text-slate-700">
      Não foi possível carregar este pedido de autorização: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nomeCliente = details?.client?.name ?? "um aplicativo";

  async function decidir(aprovar: boolean) {
    setBusy(true);
    setErro(null);
    const { data, error } = aprovar
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErro(error.message);
      return;
    }
    const destino = data?.redirect_url ?? data?.redirect_to;
    if (!destino) {
      setBusy(false);
      setErro("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = destino;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar {nomeCliente} à sua conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Isso permite que {nomeCliente} acesse seus materiais, veículos e simulações no CargoSim em seu nome.
          </p>
          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => decidir(true)}>
              Aprovar
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decidir(false)}>
              Recusar
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
