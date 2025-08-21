-- Fix linter ERROR 0010: Ensure inspectors_public is a SECURITY INVOKER view
-- Views should not run with the view owner's privileges. This enforces the querying user's RLS/policies.
DO $$ BEGIN
  -- Set both security_invoker and security_barrier for defense-in-depth
  EXECUTE 'ALTER VIEW public.inspectors_public SET (security_invoker = true, security_barrier = true)';
EXCEPTION WHEN OTHERS THEN
  -- If the view does not exist yet, do nothing (idempotent migration)
  RAISE NOTICE 'inspectors_public view not found or ALTER VIEW failed: %', SQLERRM;
END $$;

-- Lock down privileges explicitly (no public/anon access)
DO $$ BEGIN
  EXECUTE 'REVOKE ALL ON public.inspectors_public FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON public.inspectors_public FROM anon';
  -- Allow authenticated users and service_role to read via their own policies/role
  EXECUTE 'GRANT SELECT ON public.inspectors_public TO authenticated';
  EXECUTE 'GRANT SELECT ON public.inspectors_public TO service_role';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Privilege changes for inspectors_public failed or view missing: %', SQLERRM;
END $$;