ALTER TABLE public.materiais
  ADD COLUMN IF NOT EXISTS rot_x boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rot_y boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rot_z boolean NOT NULL DEFAULT true;

UPDATE public.materiais SET rot_x = false, rot_y = false, rot_z = false WHERE permite_rotacao = false;