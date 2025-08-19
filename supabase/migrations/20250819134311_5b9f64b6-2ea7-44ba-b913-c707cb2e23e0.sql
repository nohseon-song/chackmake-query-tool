-- Secure inspectors_public from public access and restrict to org-scoped authenticated users
-- This migration is idempotent and handles both table or view cases.

-- 1) Revoke broad privileges and grant only to authenticated
DO $$
DECLARE
  objkind char;
  exists_obj boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inspectors_public'
  ) INTO exists_obj;

  IF exists_obj THEN
    -- Revoke any broad access; apply to either table or view
    EXECUTE 'REVOKE ALL ON public.inspectors_public FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON public.inspectors_public FROM anon';
    -- Ensure authenticated role can read object (RLS still applies for tables)
    EXECUTE 'GRANT SELECT ON public.inspectors_public TO authenticated';
  END IF;

  -- 2) If object is a TABLE, enable RLS and add org-scoped SELECT policy
  SELECT c.relkind
  INTO objkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'inspectors_public';

  IF objkind = 'r' THEN  -- 'r' = ordinary table
    BEGIN
      EXECUTE 'ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY';
    EXCEPTION WHEN others THEN
      -- Ignore if already enabled or table missing
      NULL;
    END;

    -- Create SELECT policy if it doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'inspectors_public' 
        AND policyname = 'Authenticated users can view inspectors_public in their org'
    ) THEN
      EXECUTE 'CREATE POLICY "Authenticated users can view inspectors_public in their org" ON public.inspectors_public FOR SELECT TO authenticated USING (organization_id = public.get_current_user_org_id())';
    END IF;
  END IF;
END $$;