-- Secure inspectors_public without breaking existing functionality
-- Handles both cases: table vs. view

DO $$
BEGIN
  -- Case 1: inspectors_public is a TABLE (or materialized view treated as table)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inspectors_public'
  ) THEN
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY';

    -- Create SELECT policy scoped to the current user's organization
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'inspectors_public' 
        AND policyname = 'Users can view inspectors_public in their organization'
    ) THEN
      EXECUTE $$
        CREATE POLICY "Users can view inspectors_public in their organization"
        ON public.inspectors_public
        FOR SELECT
        USING (organization_id = public.get_current_user_org_id());
      $$;
    END IF;

    -- Do NOT create insert/update/delete policies to keep it read-only by default

  -- Case 2: inspectors_public is a VIEW
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'inspectors_public'
  ) THEN
    -- RLS cannot be applied to views. Lock down privileges instead.
    -- Revoke any broad/public access and allow only authenticated users.
    -- Base table RLS (on public.inspectors) will still enforce row access.
    EXECUTE 'REVOKE ALL ON TABLE public.inspectors_public FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON TABLE public.inspectors_public FROM anon';
    EXECUTE 'GRANT SELECT ON TABLE public.inspectors_public TO authenticated';
  END IF;
END$$;
