-- Retry with corrected dynamic SQL quoting for policy creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inspectors_public'
  ) THEN
    EXECUTE 'ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'inspectors_public' 
        AND policyname = 'Users can view inspectors_public in their organization'
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view inspectors_public in their organization" ON public.inspectors_public FOR SELECT USING (organization_id = public.get_current_user_org_id())';
    END IF;

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'inspectors_public'
  ) THEN
    EXECUTE 'REVOKE ALL ON TABLE public.inspectors_public FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON TABLE public.inspectors_public FROM anon';
    EXECUTE 'GRANT SELECT ON TABLE public.inspectors_public TO authenticated';
  END IF;
END$$;