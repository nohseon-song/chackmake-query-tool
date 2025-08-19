-- Secure inspectors_public without breaking functionality
DO $$
DECLARE
  relkind "char";
BEGIN
  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'inspectors_public';

  -- Base table
  IF relkind = 'r' THEN
    EXECUTE 'ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'inspectors_public' 
        AND policyname = 'Users can view inspectors_public in their organization'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view inspectors_public in their organization" ON public.inspectors_public FOR SELECT USING (organization_id = public.get_current_user_org_id())';
    END IF;

  -- Regular view or materialized view
  ELSIF relkind IN ('v','m') THEN
    -- Lock down privileges
    EXECUTE 'REVOKE ALL ON TABLE public.inspectors_public FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON TABLE public.inspectors_public FROM anon';
    -- Allow only server-side and authenticated clients
    EXECUTE 'GRANT SELECT ON TABLE public.inspectors_public TO authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.inspectors_public TO service_role';
  ELSE
    RAISE NOTICE 'public.inspectors_public not found';
  END IF;
END$$;