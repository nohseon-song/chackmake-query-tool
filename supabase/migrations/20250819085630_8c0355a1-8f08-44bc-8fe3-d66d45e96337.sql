-- Fix previous failure: preserve existing view column order while securing the view
-- Re-attempt full hardening for both VIEW and TABLE cases

-- 1) If it's a VIEW, (re)define with same column order and add org filter + security options
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_views 
    WHERE schemaname = 'public' AND viewname = 'inspectors_public'
  ) THEN
    CREATE OR REPLACE VIEW public.inspectors_public
    (created_at, created_by, id, is_team_leader, location_id, name, organization_id, position, technical_grade, updated_at, updated_by)
    WITH (security_barrier = true, security_invoker = true)
    AS
    SELECT 
      i.created_at,
      i.created_by,
      i.id,
      i.is_team_leader,
      i.location_id,
      i.name,
      i.organization_id,
      i.position,
      i.technical_grade,
      i.updated_at,
      i.updated_by
    FROM public.inspectors i
    WHERE i.organization_id = public.get_current_user_org_id();
  END IF;
END $$;

-- 2) If it's a TABLE, enable RLS and add org-scoped policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inspectors_public'
  ) THEN
    EXECUTE 'ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view inspectors in their organization" ON public.inspectors_public';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete inspectors in org" ON public.inspectors_public';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert inspectors in org" ON public.inspectors_public';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update inspectors in org" ON public.inspectors_public';

    EXECUTE 'CREATE POLICY "Users can view inspectors in their organization" ON public.inspectors_public FOR SELECT USING (organization_id = public.get_current_user_org_id())';
    EXECUTE 'CREATE POLICY "Users can insert inspectors in org" ON public.inspectors_public FOR INSERT WITH CHECK ((organization_id = public.get_current_user_org_id()) AND (created_by = auth.uid()))';
    EXECUTE 'CREATE POLICY "Users can update inspectors in org" ON public.inspectors_public FOR UPDATE USING (organization_id = public.get_current_user_org_id()) WITH CHECK (updated_by = auth.uid())';
    EXECUTE 'CREATE POLICY "Admins can delete inspectors in org" ON public.inspectors_public FOR DELETE USING (public.is_admin() AND (organization_id = public.get_current_user_org_id()))';
  END IF;
END $$;

-- 3) Lock down privileges: remove public/anon; allow authenticated + service_role
DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON public.inspectors_public FROM PUBLIC';
  EXCEPTION WHEN undefined_table THEN
  END;

  BEGIN
    EXECUTE 'REVOKE ALL ON public.inspectors_public FROM anon';
  EXCEPTION WHEN undefined_object THEN
  END;

  BEGIN
    EXECUTE 'GRANT SELECT ON public.inspectors_public TO authenticated';
  EXCEPTION WHEN undefined_object THEN
  END;

  BEGIN
    EXECUTE 'GRANT SELECT ON public.inspectors_public TO service_role';
  EXCEPTION WHEN undefined_object THEN
  END;
END $$;