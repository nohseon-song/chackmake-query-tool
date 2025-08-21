-- Enable Row Level Security on inspectors_public and add org-scoped SELECT policy
ALTER TABLE public.inspectors_public ENABLE ROW LEVEL SECURITY;

-- Ensure no overly permissive policies exist by dropping any existing SELECT policies if present (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'inspectors_public' AND perm = 'select'
  ) THEN
    -- Drop all existing SELECT policies to avoid accidental broad access
    EXECUTE (
      SELECT string_agg(format('DROP POLICY %I ON public.inspectors_public;', polname), ' ')
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'inspectors_public' AND perm = 'select'
    );
  END IF;
END $$;

-- Restrict read access to authenticated users in their organization
CREATE POLICY "Users can view inspector public data in their organization"
ON public.inspectors_public
FOR SELECT
TO authenticated
USING (organization_id = public.get_current_user_org_id());
