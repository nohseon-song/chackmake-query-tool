-- 1) Create an explicit access-control table for inspectors
CREATE TABLE IF NOT EXISTS public.user_inspector_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  inspector_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- viewer | editor | manager
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_inspector_access_role_check CHECK (role IN ('viewer','editor','manager'))
);

-- Enable RLS on the new table
ALTER TABLE public.user_inspector_access ENABLE ROW LEVEL SECURITY;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_inspector_access_user_inspector ON public.user_inspector_access (user_id, inspector_id);
CREATE INDEX IF NOT EXISTS idx_user_inspector_access_org ON public.user_inspector_access (organization_id);

-- Policies for the access table
-- Users can read their own access grants
DROP POLICY IF EXISTS "Users can read their own access grants" ON public.user_inspector_access;
CREATE POLICY "Users can read their own access grants"
ON public.user_inspector_access
FOR SELECT
USING (user_id = auth.uid());

-- Only admins can manage grants inside their org
DROP POLICY IF EXISTS "Admins manage access grants in org (insert)" ON public.user_inspector_access;
CREATE POLICY "Admins manage access grants in org (insert)"
ON public.user_inspector_access
FOR INSERT
WITH CHECK (is_admin() AND organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins manage access grants in org (update)" ON public.user_inspector_access;
CREATE POLICY "Admins manage access grants in org (update)"
ON public.user_inspector_access
FOR UPDATE
USING (is_admin() AND organization_id = get_current_user_org_id())
WITH CHECK (is_admin() AND organization_id = get_current_user_org_id());

DROP POLICY IF EXISTS "Admins manage access grants in org (delete)" ON public.user_inspector_access;
CREATE POLICY "Admins manage access grants in org (delete)"
ON public.user_inspector_access
FOR DELETE
USING (is_admin() AND organization_id = get_current_user_org_id());


-- 2) Tighten inspectors SELECT access
-- Remove broad organization-wide read access
DROP POLICY IF EXISTS "Users can view data in their organization" ON public.inspectors;

-- Keep admin full visibility within org
DROP POLICY IF EXISTS "Admins can view inspectors in their organization" ON public.inspectors;
CREATE POLICY "Admins can view inspectors in their organization"
ON public.inspectors
FOR SELECT
USING (is_admin() AND organization_id = get_current_user_org_id());

-- Allow creators to see their own inspector rows (to avoid breaking flows)
DROP POLICY IF EXISTS "Creators can view their own inspector rows" ON public.inspectors;
CREATE POLICY "Creators can view their own inspector rows"
ON public.inspectors
FOR SELECT
USING (created_by = auth.uid());

-- Allow users to view inspectors explicitly granted via access table
DROP POLICY IF EXISTS "Users can view inspectors with explicit access" ON public.inspectors;
CREATE POLICY "Users can view inspectors with explicit access"
ON public.inspectors
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_inspector_access a
    WHERE a.user_id = auth.uid()
      AND a.inspector_id = public.inspectors.id
  )
);

-- Note: Existing INSERT/UPDATE/DELETE policies remain unchanged to preserve current behavior.
