-- Defense-in-depth hardening for inspector_contacts
-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.inspector_contacts ENABLE ROW LEVEL SECURITY;

-- 2) Explicitly revoke any anonymous/public access
REVOKE ALL ON TABLE public.inspector_contacts FROM anon;
REVOKE ALL ON TABLE public.inspector_contacts FROM public;

-- Note: Existing RLS policies already restrict SELECT to admins in-org and users with explicit access
-- and limit INSERT/UPDATE/DELETE to admins in the same organization.
-- No policy changes are made to avoid breaking current behavior.