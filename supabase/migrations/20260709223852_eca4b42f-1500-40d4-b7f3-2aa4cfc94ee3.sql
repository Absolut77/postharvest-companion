
-- Enums
CREATE TYPE public.batch_stage AS ENUM (
  'harvest','drying','debudding','sorting','curing','bulk_packaging','vault'
);
CREATE TYPE public.qualification AS ENUM (
  'handtrim','large','medium','small','trim'
);
CREATE TYPE public.bag_stage AS ENUM (
  'post_debudding','in_curing','bulk_packed','sampled','retained','shipped','destroyed'
);
CREATE TYPE public.debudding_method AS ENUM ('hand_trim','mobius');

-- updated_at trigger fn (already exists as set_updated_at in project)

-- =============== batches ===============
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL UNIQUE,
  strain text NOT NULL DEFAULT '',
  plant_count integer NOT NULL DEFAULT 0,
  harvest_date date,
  wet_weight_g numeric NOT NULL DEFAULT 0,
  dry_weight_g numeric NOT NULL DEFAULT 0,
  current_stage public.batch_stage NOT NULL DEFAULT 'harvest',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO anon, authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read batches" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Public insert batches" ON public.batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update batches" ON public.batches FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete batches" ON public.batches FOR DELETE USING (true);
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== batch_stage_events ===============
CREATE TABLE public.batch_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  from_stage public.batch_stage,
  to_stage public.batch_stage NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_stage_events TO anon, authenticated;
GRANT ALL ON public.batch_stage_events TO service_role;
ALTER TABLE public.batch_stage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw stage events" ON public.batch_stage_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_stage_events_batch ON public.batch_stage_events(batch_id, at DESC);

-- =============== drying_readings ===============
CREATE TABLE public.drying_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  room_temp_c numeric,
  internal_humidity numeric,
  external_humidity numeric,
  water_activity numeric,
  sartorius_value numeric,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drying_readings TO anon, authenticated;
GRANT ALL ON public.drying_readings TO service_role;
ALTER TABLE public.drying_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw drying" ON public.drying_readings FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_drying_batch ON public.drying_readings(batch_id, taken_at DESC);
CREATE TRIGGER trg_drying_updated_at BEFORE UPDATE ON public.drying_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== curing_readings ===============
CREATE TABLE public.curing_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  water_activity numeric,
  humidity numeric,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curing_readings TO anon, authenticated;
GRANT ALL ON public.curing_readings TO service_role;
ALTER TABLE public.curing_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw curing" ON public.curing_readings FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_curing_batch ON public.curing_readings(batch_id, taken_at DESC);
CREATE TRIGGER trg_curing_updated_at BEFORE UPDATE ON public.curing_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== debudding_sessions ===============
CREATE TABLE public.debudding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  method public.debudding_method NOT NULL DEFAULT 'hand_trim',
  ease_rating integer,
  quality_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ease_rating IS NULL OR (ease_rating BETWEEN 1 AND 5))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debudding_sessions TO anon, authenticated;
GRANT ALL ON public.debudding_sessions TO service_role;
ALTER TABLE public.debudding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw debudding" ON public.debudding_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_debudding_batch ON public.debudding_sessions(batch_id, started_at DESC);
CREATE TRIGGER trg_debudding_updated_at BEFORE UPDATE ON public.debudding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== bags ===============
CREATE TABLE public.bags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  qualification public.qualification NOT NULL,
  bag_number integer NOT NULL,
  target_weight_g numeric NOT NULL DEFAULT 0,
  actual_weight_g numeric NOT NULL DEFAULT 0,
  is_exception boolean NOT NULL DEFAULT false,
  stage public.bag_stage NOT NULL DEFAULT 'post_debudding',
  photo_urls text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, qualification, bag_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bags TO anon, authenticated;
GRANT ALL ON public.bags TO service_role;
ALTER TABLE public.bags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw bags" ON public.bags FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_bags_batch ON public.bags(batch_id);
CREATE INDEX idx_bags_stage ON public.bags(stage);
CREATE TRIGGER trg_bags_updated_at BEFORE UPDATE ON public.bags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== bag_events ===============
CREATE TABLE public.bag_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id uuid NOT NULL REFERENCES public.bags(id) ON DELETE CASCADE,
  event text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  delta_g numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  actor text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bag_events TO anon, authenticated;
GRANT ALL ON public.bag_events TO service_role;
ALTER TABLE public.bag_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw bag events" ON public.bag_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_bag_events_bag ON public.bag_events(bag_id, at DESC);

-- =============== bulk_packaging_runs ===============
CREATE TABLE public.bulk_packaging_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_out_curing_g numeric NOT NULL DEFAULT 0,
  processing_loss_g numeric NOT NULL DEFAULT 0,
  sample_weight_g numeric NOT NULL DEFAULT 0,
  retention_weight_g numeric NOT NULL DEFAULT 0,
  form_a_url text NOT NULL DEFAULT '',
  form_b_url text NOT NULL DEFAULT '',
  global_photo_urls text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_packaging_runs TO anon, authenticated;
GRANT ALL ON public.bulk_packaging_runs TO service_role;
ALTER TABLE public.bulk_packaging_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public rw bulk runs" ON public.bulk_packaging_runs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_bulk_runs_batch ON public.bulk_packaging_runs(batch_id, run_date DESC);
CREATE TRIGGER trg_bulk_runs_updated_at BEFORE UPDATE ON public.bulk_packaging_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
