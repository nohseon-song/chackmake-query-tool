-- Secure inspectors_public table by enabling RLS and adding restrictive policies
-- 1) Enable Row Level Security
ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY;

-- 2) Allow authenticated users to view inspectors only within their organization
CREATE POLICY "Users can view inspectors in their organization"
ON public.inspectors_public
FOR SELECT
USING (organization_id = public.get_current_user_org_id());

-- 3) Allow service_role (backend automations) full access to prevent breaking integrations
CREATE POLICY "Service role full access"
ON public.inspectors_public
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');