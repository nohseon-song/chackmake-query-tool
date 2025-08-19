-- Secure inspectors_public with RLS restricted to org members
ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY;

-- Ensure idempotency by dropping any existing conflicting policy
DROP POLICY IF EXISTS "Users can view public inspectors in their organization" ON public.inspectors_public;

-- Restrictive read policy: only authenticated users within their org can read
CREATE POLICY "Users can view public inspectors in their organization"
ON public.inspectors_public
FOR SELECT
USING (organization_id = public.get_current_user_org_id());