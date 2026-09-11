
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perfil proprio leitura" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "perfil proprio update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "perfil proprio insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- trigger para criar profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- materiais
CREATE TABLE public.materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sku TEXT,
  comprimento_cm NUMERIC NOT NULL CHECK (comprimento_cm > 0),
  largura_cm NUMERIC NOT NULL CHECK (largura_cm > 0),
  altura_cm NUMERIC NOT NULL CHECK (altura_cm > 0),
  peso_kg NUMERIC NOT NULL CHECK (peso_kg >= 0),
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT ALL ON public.materiais TO service_role;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materiais proprios" ON public.materiais FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- simulacoes
CREATE TABLE public.simulacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  container_tipo TEXT NOT NULL DEFAULT '40HC',
  capacidade_peso_kg NUMERIC NOT NULL DEFAULT 26500,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;
ALTER TABLE public.simulacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulacoes proprias" ON public.simulacoes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- simulacao_itens
CREATE TABLE public.simulacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID NOT NULL REFERENCES public.simulacoes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_itens TO authenticated;
GRANT ALL ON public.simulacao_itens TO service_role;
ALTER TABLE public.simulacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens via dono simulacao" ON public.simulacao_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.simulacoes s WHERE s.id = simulacao_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulacoes s WHERE s.id = simulacao_id AND s.user_id = auth.uid()));

CREATE INDEX idx_materiais_user ON public.materiais(user_id);
CREATE INDEX idx_simulacoes_user ON public.simulacoes(user_id);
CREATE INDEX idx_simulacao_itens_sim ON public.simulacao_itens(simulacao_id);
