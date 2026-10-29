CREATE TABLE public.lead_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.lead_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  position integer NOT NULL CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, id),
  UNIQUE (pipeline_id, name)
);

CREATE INDEX lead_pipeline_stages_order_idx
  ON public.lead_pipeline_stages (pipeline_id, position, created_at);

CREATE TABLE public.lead_pipeline_assignments (
  pipeline_id uuid NOT NULL REFERENCES public.lead_pipelines(id) ON DELETE CASCADE,
  lead_key text NOT NULL CHECK (char_length(lead_key) BETWEEN 3 AND 180),
  stage_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pipeline_id, lead_key),
  FOREIGN KEY (pipeline_id, stage_id)
    REFERENCES public.lead_pipeline_stages (pipeline_id, id) ON DELETE CASCADE
);

CREATE INDEX lead_pipeline_assignments_stage_idx
  ON public.lead_pipeline_assignments (stage_id);

ALTER TABLE public.lead_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pipeline_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages lead pipeline" ON public.lead_pipelines
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND (SELECT public.is_owner()))
  WITH CHECK (owner_id = (SELECT auth.uid()) AND (SELECT public.is_owner()));

CREATE POLICY "Owner manages lead pipeline stages" ON public.lead_pipeline_stages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_pipelines p
    WHERE p.id = pipeline_id AND p.owner_id = (SELECT auth.uid())
      AND (SELECT public.is_owner())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lead_pipelines p
    WHERE p.id = pipeline_id AND p.owner_id = (SELECT auth.uid())
      AND (SELECT public.is_owner())
  ));

CREATE POLICY "Owner manages lead pipeline assignments" ON public.lead_pipeline_assignments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lead_pipelines p
    WHERE p.id = pipeline_id AND p.owner_id = (SELECT auth.uid())
      AND (SELECT public.is_owner())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lead_pipelines p
    WHERE p.id = pipeline_id AND p.owner_id = (SELECT auth.uid())
      AND (SELECT public.is_owner())
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_pipelines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_pipeline_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_pipeline_assignments TO authenticated;
GRANT ALL ON public.lead_pipelines, public.lead_pipeline_stages,
  public.lead_pipeline_assignments TO service_role;
