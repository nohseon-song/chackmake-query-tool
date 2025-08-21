-- Secure the inspectors_public view by filtering rows to the caller's organization and restricting privileges
-- 1) Recreate the view with an org filter using the authenticated user's org id
CREATE OR REPLACE VIEW public.inspectors_public
WITH (security_barrier=true)
AS
SELECT 
  i.id,
  i.name,
  i.position,
  i.technical_grade,
  i.is_team_leader,
  i.location_id,
  i.organization_id,
  i.created_at,
  i.updated_at,
  i.created_by,
  i.updated_by
FROM public.inspectors AS i
WHERE i.organization_id = public.get_current_user_org_id();

-- 2) Lock down privileges: no public/anon access; allow only authenticated and service_role to read
REVOKE ALL ON public.inspectors_public FROM PUBLIC;
REVOKE ALL ON public.inspectors_public FROM anon;
REVOKE ALL ON public.inspectors_public FROM authenticated;
REVOKE ALL ON public.inspectors_public FROM service_role;

GRANT SELECT ON public.inspectors_public TO authenticated;
GRANT SELECT ON public.inspectors_public TO service_role;