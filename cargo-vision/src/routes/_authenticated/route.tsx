import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Cuboid, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthShell,
});

function AuthShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkClass = (active: boolean) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/simulacoes" className="flex items-center gap-2 font-semibold text-slate-900">
              <Cuboid className="h-5 w-5 text-blue-600" />
              CargoSim
            </Link>
            <nav className="flex gap-1">
              <Link to="/simulacoes" className={linkClass(pathname.startsWith("/simulacoes"))}>
                Simulações
              </Link>
              <Link to="/materiais" className={linkClass(pathname.startsWith("/materiais"))}>
                Materiais
              </Link>
              <Link to="/veiculos" className={linkClass(pathname.startsWith("/veiculos"))}>
                Veículos
              </Link>
              <Link to="/planos" className={linkClass(pathname.startsWith("/planos"))}>
                Planos
              </Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={sair}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
