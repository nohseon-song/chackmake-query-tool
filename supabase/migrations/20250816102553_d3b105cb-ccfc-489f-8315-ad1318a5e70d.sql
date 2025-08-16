-- Harden user_profiles access without changing existing behavior
-- 1) Enforce Row Level Security even for table owners
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

-- 2) Ensure non-admins cannot change their role or organization
DROP TRIGGER IF EXISTS trg_prevent_role_org_change ON public.user_profiles;
CREATE TRIGGER trg_prevent_role_org_change
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_org_change();