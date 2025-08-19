-- Secure inspectors_public: enable RLS, restrict reads to org, and tighten grants

-- 1) Enable Row Level Security
ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY;

-- 2) Restrict table privileges (defense in depth)
REVOKE ALL ON TABLE public.inspectors_public FROM PUBLIC;
REVOKE ALL ON TABLE public.inspectors_public FROM anon;
GRANT SELECT ON TABLE public.inspectors_public TO authenticated;
GRANT SELECT ON TABLE public.inspectors_public TO service_role;

-- 3) Organization-scoped SELECT policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inspectors_public'
      AND policyname = 'Users can view inspectors_public in their organization'
  ) THEN
    CREATE POLICY "Users can view inspectors_public in their organization"
      ON public.inspectors_public
      FOR SELECT
      TO authenticated
      USING (organization_id = public.get_current_user_org_id());
  END IF;
END$$;
