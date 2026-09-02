-- Transactional persistence for UC01 Active Context.
-- Run after AI_Workspace / AI_Project / Learning_Material tables exist.

CREATE OR REPLACE FUNCTION public.set_project_active_context(
  p_learner_id uuid,
  p_project_id uuid,
  p_selected_material_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_requested_count integer;
  v_owned_count integer;
  v_selected_ids uuid[];
BEGIN
  SELECT w."learnerId"
    INTO v_owner_id
  FROM "AI_Project" p
  JOIN "AI_Workspace" w ON w."workspaceId" = p."workspaceId"
  WHERE p."projectId" = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id IS DISTINCT FROM p_learner_id THEN
    RAISE EXCEPTION 'PROJECT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT count(DISTINCT selected_id)
    INTO v_requested_count
  FROM unnest(COALESCE(p_selected_material_ids, '{}'::uuid[])) AS selected_id;

  SELECT count(*)
    INTO v_owned_count
  FROM "Learning_Material"
  WHERE "projectId" = p_project_id
    AND "materialId" = ANY(COALESCE(p_selected_material_ids, '{}'::uuid[]));

  IF v_owned_count <> v_requested_count THEN
    RAISE EXCEPTION 'MATERIAL_NOT_IN_PROJECT' USING ERRCODE = '22023';
  END IF;

  UPDATE "Learning_Material"
  SET "selectedAsContext" = false
  WHERE "projectId" = p_project_id;

  IF v_requested_count > 0 THEN
    UPDATE "Learning_Material"
    SET "selectedAsContext" = true
    WHERE "projectId" = p_project_id
      AND "materialId" = ANY(p_selected_material_ids);
  END IF;

  SELECT COALESCE(array_agg("materialId" ORDER BY "materialId"), '{}'::uuid[])
    INTO v_selected_ids
  FROM "Learning_Material"
  WHERE "projectId" = p_project_id
    AND "selectedAsContext" = true;

  RETURN jsonb_build_object(
    'success', true,
    'selectedMaterialIds', to_jsonb(v_selected_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_active_context(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_active_context(uuid, uuid, uuid[]) TO service_role;
