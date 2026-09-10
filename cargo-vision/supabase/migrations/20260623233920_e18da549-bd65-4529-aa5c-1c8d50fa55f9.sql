CREATE TABLE public.veiculos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  comprimento_cm numeric NOT NULL,
  largura_cm numeric NOT NULL,
  altura_cm numeric NOT NULL,
  capacidade_peso_kg numeric NOT NULL DEFAULT 0,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "veiculos proprios" ON public.veiculos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.simulacoes
  ADD COLUMN comprimento_cm numeric NOT NULL DEFAULT 1200,
  ADD COLUMN largura_cm numeric NOT NULL DEFAULT 230,
  ADD COLUMN altura_cm numeric NOT NULL DEFAULT 269,
  ADD COLUMN veiculo_nome text NOT NULL DEFAULT 'Container 40HC';