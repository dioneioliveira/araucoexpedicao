ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS espessura_cm numeric,
  ADD COLUMN IF NOT EXISTS densidade_kg_m3 numeric;