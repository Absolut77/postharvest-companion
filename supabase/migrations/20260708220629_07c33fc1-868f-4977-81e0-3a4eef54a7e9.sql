
CREATE TABLE public.movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  initials TEXT NOT NULL,
  strain TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT '',
  product_format TEXT NOT NULL DEFAULT '',
  quantity_g NUMERIC(12,2) NOT NULL DEFAULT 0,
  units INTEGER NOT NULL DEFAULT 0,
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  reason TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX movements_batch_idx ON public.movements(batch_id);
CREATE INDEX movements_strain_idx ON public.movements(strain);
CREATE INDEX movements_date_idx ON public.movements(event_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read movements" ON public.movements FOR SELECT USING (true);
CREATE POLICY "Public insert movements" ON public.movements FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update movements" ON public.movements FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete movements" ON public.movements FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER movements_updated_at BEFORE UPDATE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
