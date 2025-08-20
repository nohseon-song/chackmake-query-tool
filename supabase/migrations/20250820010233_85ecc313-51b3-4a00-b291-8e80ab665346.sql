-- Secure inspectors_public view: restrict to authenticated and service_role only
DO $$ BEGIN
  -- Revoke any existing grants from PUBLIC, anon, and authenticated to start clean
  REVOKE ALL ON TABLE public.inspectors_public FROM PUBLIC;
  REVOKE ALL ON TABLE public.inspectors_public FROM anon;
  REVOKE ALL ON TABLE public.inspectors_public FROM authenticated;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'inspectors_public view does not exist; nothing to revoke';
END $$;

DO $$ BEGIN
  -- Grant least-privilege access
  GRANT SELECT ON TABLE public.inspectors_public TO authenticated;
  GRANT SELECT ON TABLE public.inspectors_public TO service_role;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'inspectors_public view does not exist; nothing to grant';
END $$;