-- Enable RLS for inspectors_public and restrict access to authorized users only
-- If inspectors_public is a table, this will enable RLS. If it's a view, the REVOKE/GRANT still ensure anon cannot select.

-- 1) Ensure only authenticated users can access the relation (revoke anon)
REVOKE ALL ON TABLE public.inspectors_public FROM anon;
GRANT SELECT ON TABLE public.inspectors_public TO authenticated;

-- 2) Enable Row Level Security
ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY;

-- 3) Add SELECT policies
-- a) Users can see inspectors in their own organization
CREATE POLICY "Users can view inspectors_public in their organization"
ON public.inspectors_public
FOR SELECT
USING (organization_id = public.get_current_user_org_id());

-- b) Users with explicit access grants can view specific inspectors (manager/lead/owner roles)
CREATE POLICY "Users with explicit access can view inspectors_public"
ON public.inspectors_public
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_inspector_access a
    WHERE a.user_id = auth.uid()
      AND a.inspector_id = inspectors_public.id
      AND a.organization_id = inspectors_public.organization_id
      AND a.role <> 'viewer'
  )
);

-- c) Admins can view inspectors in their org
CREATE POLICY "Admins can view inspectors_public in their organization"
ON public.inspectors_public
FOR SELECT
USING (public.is_admin() AND organization_id = public.get_current_user_org_id());