-- Secure inspectors_public by enforcing org-level access and removing public readability
-- This migration handles both cases: when inspectors_public is a VIEW or a TABLE

-- 1) If it's a VIEW, (re)define it as a security_barrier + security_invoker view filtered by current user's org
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_views 
    WHERE schemaname = 'public' AND viewname = 'inspectors_public'
  ) THEN
    -- Recreate the view to guarantee org filtering and safer planning
    CREATE OR REPLACE VIEW public.inspectors_public
    WITH (security_barrier = true, security_invoker = true)
    AS
    SELECT 
      i.id,
      i.name,
      i.position,
      i.technical_grade,
      i.is_team_leader,
      i.location_id,
      i.organization_id,
      i.created_by,
      i.created_at,
      i.updated_by,
      i.updated_at
    FROM public.inspectors i
    WHERE i.organization_id = public.get_current_user_org_id();
  END IF;
END $$;

-- 2) If it's a TABLE, enable RLS and add tight org-scoped policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inspectors_public'
  ) THEN
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY';

    -- Drop old policies if they exist to avoid duplicates
    EXECUTE 'DROP POLICY IF EXISTS "Users can view inspectors in their organization" ON public.inspectors_public';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete inspectors in org" ON public.inspectors_public';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert inspectors in org" ON public.inspectors_public';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update inspectors in org" ON public.inspectors_public';

    -- Select limited to same organization
    EXECUTE 'CREATE POLICY "Users can view inspectors in their organization" ON public.inspectors_public FOR SELECT USING (organization_id = public.get_current_user_org_id())';

    -- Insert/update/delete controls (match project conventions)
    EXECUTE 'CREATE POLICY "Users can insert inspectors in org" ON public.inspectors_public FOR INSERT WITH CHECK ((organization_id = public.get_current_user_org_id()) AND (created_by = auth.uid()))';

    EXECUTE 'CREATE POLICY "Users can update inspectors in org" ON public.inspectors_public FOR UPDATE USING (organization_id = public.get_current_user_org_id()) WITH CHECK (updated_by = auth.uid())';

    EXECUTE 'CREATE POLICY "Admins can delete inspectors in org" ON public.inspectors_public FOR DELETE USING (public.is_admin() AND (organization_id = public.get_current_user_org_id()))';
  END IF;
END $$;

-- 3) Lock down privileges: no public/anon access; allow only authenticated and service_role to SELECT
DO $$
BEGIN
  -- REVOKE may fail if object doesn't exist, but we know one of table/view exists from above.
  BEGIN
    EXECUTE 'REVOKE ALL ON public.inspectors_public FROM PUBLIC';
  EXCEPTION WHEN undefined_table THEN
    -- ignore
  END;

  BEGIN
    EXECUTE 'REVOKE ALL ON public.inspectors_public FROM anon';
  EXCEPTION WHEN undefined_object THEN
    -- ignore (role may not exist in local env)
  END;

  BEGIN
    EXECUTE 'GRANT SELECT ON public.inspectors_public TO authenticated';
  EXCEPTION WHEN undefined_object THEN
    -- ignore (role may not exist in local env)
  END;

  BEGIN
    EXECUTE 'GRANT SELECT ON public.inspectors_public TO service_role';
  EXCEPTION WHEN undefined_object THEN
    -- ignore (role may not exist in local env)
  END;
END $$;