
ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS from_import boolean NOT NULL DEFAULT false;

UPDATE public.movements SET from_import = true WHERE from_import = false;
