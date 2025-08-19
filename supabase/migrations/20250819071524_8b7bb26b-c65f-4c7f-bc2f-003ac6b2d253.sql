-- Secure inspectors_public view by dropping and recreating with proper access controls

-- Drop the existing view
DROP VIEW IF EXISTS public.inspectors_public;

-- Recreate the view with security barrier and org filtering
CREATE VIEW public.inspectors_public
WITH (security_barrier=true)
AS
SELECT
  i.created_at,
  i.created_by,
  i.id,
  i.is_team_leader,
  i.location_id,
  i.name,
  i.organization_id,
  i.position,
  i.technical_grade,
  i.updated_at,
  i.updated_by
FROM public.inspectors AS i
WHERE i.organization_id = public.get_current_user_org_id();

-- Set restrictive privileges: only authenticated users can read
REVOKE ALL ON public.inspectors_public FROM PUBLIC;
REVOKE ALL ON public.inspectors_public FROM anon;

GRANT SELECT ON public.inspectors_public TO authenticated;
GRANT SELECT ON public.inspectors_public TO service_role;