-- Fix security issue on inspectors_public view by restricting access to authenticated users only
-- Remove public and anonymous access
REVOKE ALL ON public.inspectors_public FROM PUBLIC;
REVOKE ALL ON public.inspectors_public FROM anon;

-- Grant access only to authenticated users
GRANT SELECT ON public.inspectors_public TO authenticated;

-- The view already filters by organization_id = get_current_user_org_id()
-- so authenticated users will only see inspectors from their own organization