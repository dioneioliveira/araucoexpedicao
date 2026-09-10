import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Cuboid } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CargoSim" },
      {
        name: "description",
        content: "Entre ou crie sua conta no CargoSim para simular cargas 3D.",
      },
      { property: "og:title", content: "Entrar — CargoSim" },
      {
        property: "og:description",
        content: "Entre ou crie sua conta no CargoSim para simular cargas 3D.",
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
  const [nome, setNome] = useState("");
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

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Você já pode entrar.");
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error("Falha no login com Google");
    if (result.redirected) return;
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
          <Tabs defaultValue="entrar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar">
              <form onSubmit={entrar} className="mt-4 space-y-3">
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
            </TabsContent>
            <TabsContent value="cadastrar">
              <form onSubmit={cadastrar} className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="n2">Nome</Label>
                  <Input id="n2" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="e2">E-mail</Label>
                  <Input id="e2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="s2">Senha</Label>
                  <Input
                    id="s2"
                    type="password"
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            Continuar com Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
