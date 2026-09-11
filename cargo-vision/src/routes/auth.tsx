import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Cuboid } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CargoSim" },
      {
        name: "description",
        content: "Entre com a conta cadastrada pelo administrador para simular cargas 3D no CargoSim.",
      },
      { property: "og:title", content: "Entrar — CargoSim" },
      {
        property: "og:description",
        content: "Entre com a conta cadastrada pelo administrador para simular cargas 3D no CargoSim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/simulacoes" });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/simulacoes" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Cuboid className="h-5 w-5" />
          </div>
          <CardTitle>CargoSim</CardTitle>
          <p className="text-sm text-slate-500">Acesse sua conta para simular cargas</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={entrar} className="space-y-3">
            <div>
              <Label htmlFor="e1">E-mail</Label>
              <Input id="e1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="s1">Senha</Label>
              <Input id="s1" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
