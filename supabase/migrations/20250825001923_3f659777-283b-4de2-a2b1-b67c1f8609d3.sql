-- Defense-in-depth and precise RLS for inspector_contacts
-- 1) Ensure RLS is enabled
ALTER TABLE public.inspector_contacts ENABLE ROW LEVEL SECURITY;

-- 2) Explicitly revoke any anonymous/public access
REVOKE ALL ON TABLE public.inspector_contacts FROM anon;
REVOKE ALL ON TABLE public.inspector_contacts FROM public;

-- 3) Refine the explicit-access SELECT policy for managers/leads/owners
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspector_contacts'
      AND policyname = 'Managers with explicit access can view inspector contacts'
  ) THEN
    EXECUTE 'DROP POLICY "Managers with explicit access can view inspector contacts" ON public.inspector_contacts';
  END IF;
END$$;

CREATE POLICY "Managers/leads/owners with explicit access can view inspector contacts"
  ON public.inspector_contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_inspector_access a
      WHERE a.user_id = auth.uid()
        AND a.inspector_id = inspector_contacts.inspector_id
        AND a.organization_id = inspector_contacts.organization_id
        AND a.organization_id = public.get_current_user_org_id()
        AND a.role = ANY (ARRAY['manager','lead','owner'])
    )
  );

-- Note: Existing admin policies remain unchanged and continue to allow in-org admin access and management actions.