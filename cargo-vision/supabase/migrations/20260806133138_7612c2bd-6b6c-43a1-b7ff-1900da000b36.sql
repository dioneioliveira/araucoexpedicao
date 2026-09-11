ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS qtd_chapas integer,
  ADD COLUMN IF NOT EXISTS espessura_chapa_cm numeric,
  ADD COLUMN IF NOT EXISTS capa_superior_cm numeric,
  ADD COLUMN IF NOT EXISTS capa_inferior_cm numeric,
  ADD COLUMN IF NOT EXISTS altura_calcos_cm numeric,
  ADD COLUMN IF NOT EXISTS peso_insumos_kg numeric;