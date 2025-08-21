-- Tighten privileges on the view since RLS cannot be applied to views
-- Ensure only authenticated users can select from the view
REVOKE ALL ON VIEW public.inspectors_public FROM PUBLIC;
REVOKE ALL ON VIEW public.inspectors_public FROM anon;
GRANT SELECT ON VIEW public.inspectors_public TO authenticated;

-- Double-check underlying table already has strict RLS (it does) and the view already filters by org via get_current_user_org_id()
-- No further changes needed to preserve existing app behavior.