ALTER TABLE public.lead_pipelines
  ADD COLUMN initial_stage_id uuid;

-- Pipelines created before this change need a real first stage as well.
INSERT INTO public.lead_pipeline_stages (pipeline_id, name, position)
SELECT p.id, 'Novo lead', 0
FROM public.lead_pipelines AS p
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_pipeline_stages AS s WHERE s.pipeline_id = p.id
);

UPDATE public.lead_pipelines AS p
SET initial_stage_id = (
  SELECT s.id
  FROM public.lead_pipeline_stages AS s
  WHERE s.pipeline_id = p.id
  ORDER BY s.position, s.created_at, s.id
  LIMIT 1
);

ALTER TABLE public.lead_pipelines
  ADD CONSTRAINT lead_pipelines_initial_stage_fkey
  FOREIGN KEY (id, initial_stage_id)
  REFERENCES public.lead_pipeline_stages (pipeline_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION public.create_lead_pipeline_with_stage(
  p_name text,
  p_initial_stage_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pipeline_id uuid;
  v_stage_id uuid;
BEGIN
  IF NOT public.is_owner() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 1 AND 80
    OR p_initial_stage_name IS NULL
    OR char_length(trim(p_initial_stage_name)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid pipeline or stage name' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.lead_pipelines (owner_id, name)
  VALUES (auth.uid(), trim(p_name))
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.lead_pipeline_stages (pipeline_id, name, position)
  VALUES (v_pipeline_id, trim(p_initial_stage_name), 0)
  RETURNING id INTO v_stage_id;

  UPDATE public.lead_pipelines
  SET initial_stage_id = v_stage_id
  WHERE id = v_pipeline_id;

  RETURN v_pipeline_id;
END;
$$;

CREATE FUNCTION public.delete_lead_pipeline_stage(
  p_stage_id uuid,
  p_replacement_stage_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pipeline_id uuid;
  v_initial_stage_id uuid;
BEGIN
  IF NOT public.is_owner() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.initial_stage_id
  INTO v_pipeline_id, v_initial_stage_id
  FROM public.lead_pipeline_stages AS s
  JOIN public.lead_pipelines AS p ON p.id = s.pipeline_id
  WHERE s.id = p_stage_id AND p.owner_id = auth.uid()
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_replacement_stage_id IS NULL OR p_replacement_stage_id = p_stage_id
    OR NOT EXISTS (
      SELECT 1 FROM public.lead_pipeline_stages
      WHERE id = p_replacement_stage_id AND pipeline_id = v_pipeline_id
    ) THEN
    RAISE EXCEPTION 'Choose another stage in this pipeline' USING ERRCODE = '22023';
  END IF;

  UPDATE public.lead_pipeline_assignments
  SET stage_id = p_replacement_stage_id, updated_at = now()
  WHERE pipeline_id = v_pipeline_id AND stage_id = p_stage_id;

  IF v_initial_stage_id = p_stage_id THEN
    UPDATE public.lead_pipelines
    SET initial_stage_id = p_replacement_stage_id
    WHERE id = v_pipeline_id;
  END IF;

  DELETE FROM public.lead_pipeline_stages
  WHERE id = p_stage_id AND pipeline_id = v_pipeline_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lead_pipeline_with_stage(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_lead_pipeline_stage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_lead_pipeline_with_stage(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_lead_pipeline_stage(uuid, uuid) TO authenticated;
