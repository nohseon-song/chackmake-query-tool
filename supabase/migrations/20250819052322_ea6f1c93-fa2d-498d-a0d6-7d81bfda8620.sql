-- Tighten access to inspector PII by restricting explicit access for 'viewer' role
-- Drop the broad explicit-access policy if it exists
DROP POLICY IF EXISTS "Users can view inspectors with explicit access" ON public.inspectors;

-- Recreate with stricter condition: only users with elevated explicit access (non-'viewer') can select rows
CREATE POLICY "Users with elevated explicit access can view inspector rows"
ON public.inspectors
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_inspector_access a
    WHERE a.user_id = auth.uid()
      AND a.inspector_id = inspectors.id
      AND a.organization_id = inspectors.organization_id
      AND a.role <> 'viewer'
  )
);

-- Note: Existing policies remain in place:
--  - "Admins can view inspectors in their organization" (admins see all in-org)
--  - "Creators can view their own inspector rows" (inspectors see their own)
-- This change prevents basic 'viewer' grants from exposing phone/email while preserving current functionality.