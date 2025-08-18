-- Secure monthly_api_billings with RLS and granular policies

-- 1) Enable RLS (idempotent setup)
ALTER TABLE public.monthly_api_billings ENABLE ROW LEVEL SECURITY;

-- 2) Clean up any previous policies to avoid duplicates on re-run
DROP POLICY IF EXISTS "Admins can view billing in their organization" ON public.monthly_api_billings;
DROP POLICY IF EXISTS "Users can view their own billing rows" ON public.monthly_api_billings;
DROP POLICY IF EXISTS "Admins can insert billing rows in org" ON public.monthly_api_billings;
DROP POLICY IF EXISTS "Admins can update billing rows in org" ON public.monthly_api_billings;
DROP POLICY IF EXISTS "Admins can delete billing rows in org" ON public.monthly_api_billings;

-- 3) Read access
-- Admins: can read all billing rows within their organization
CREATE POLICY "Admins can view billing in their organization"
ON public.monthly_api_billings
FOR SELECT
USING (
  is_admin() AND organization_id = get_current_user_org_id()
);

-- Regular users: can read only their own billing rows within their organization
CREATE POLICY "Users can view their own billing rows"
ON public.monthly_api_billings
FOR SELECT
USING (
  organization_id = get_current_user_org_id() AND user_id = auth.uid()
);

-- 4) Write access for admins (for functions and admin tools that manage billing rows)
CREATE POLICY "Admins can insert billing rows in org"
ON public.monthly_api_billings
FOR INSERT
WITH CHECK (
  is_admin() AND organization_id = get_current_user_org_id()
);

CREATE POLICY "Admins can update billing rows in org"
ON public.monthly_api_billings
FOR UPDATE
USING (
  is_admin() AND organization_id = get_current_user_org_id()
)
WITH CHECK (
  organization_id = get_current_user_org_id()
);

CREATE POLICY "Admins can delete billing rows in org"
ON public.monthly_api_billings
FOR DELETE
USING (
  is_admin() AND organization_id = get_current_user_org_id()
);
