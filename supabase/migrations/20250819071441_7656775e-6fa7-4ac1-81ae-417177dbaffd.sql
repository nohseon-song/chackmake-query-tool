-- Secure inspectors_public: enforce org scoping at the view level and restrict privileges

-- 1) Redefine the view with a security barrier and per-org filter
CREATE OR REPLACE VIEW public.inspectors_public
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
  i.updated_at,
  i.updated_by
FROM public.inspectors AS i
WHERE i.organization_id = public.get_current_user_org_id();

-- 2) Lock down privileges: remove broad access and only allow authenticated + service_role
REVOKE ALL PRIVILEGES ON TABLE public.inspectors_public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.inspectors_public FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.inspectors_public FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.inspectors_public FROM service_role;

GRANT SELECT ON TABLE public.inspectors_public TO authenticated;
GRANT SELECT ON TABLE public.inspectors_public TO service_role;