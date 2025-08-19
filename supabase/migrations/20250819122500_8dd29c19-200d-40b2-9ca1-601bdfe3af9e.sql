-- Secure inspectors_public view by recreating with security barrier and proper access controls

-- 1) Drop existing view first
DROP VIEW IF EXISTS public.inspectors_public;

-- 2) Recreate as a security barrier view with proper organization filtering
CREATE VIEW public.inspectors_public 
WITH (security_barrier = true, security_invoker = true)
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
    i.created_by,
    i.updated_at,
    i.updated_by
FROM public.inspectors i
WHERE i.organization_id = public.get_current_user_org_id();

-- 3) Restrict table privileges (defense in depth)
REVOKE ALL ON public.inspectors_public FROM PUBLIC;
REVOKE ALL ON public.inspectors_public FROM anon;
GRANT SELECT ON public.inspectors_public TO authenticated;
GRANT SELECT ON public.inspectors_public TO service_role;