-- Harden inspectors table against cross-organization access
-- 1) Ensure RLS is enabled and enforced
ALTER TABLE public.inspectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspectors FORCE ROW LEVEL SECURITY;

-- 2) Ensure organization/user context is automatically set on writes
CREATE OR REPLACE FUNCTION public.set_org_and_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := public.get_current_user_org_id();
    END IF;
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Attach trigger to inspectors table (covers both insert and update)
DROP TRIGGER IF EXISTS trg_inspectors_set_org_and_user ON public.inspectors;
CREATE TRIGGER trg_inspectors_set_org_and_user
BEFORE INSERT OR UPDATE ON public.inspectors
FOR EACH ROW
EXECUTE FUNCTION public.set_org_and_user_columns();
