-- Fix linter: make view run with invoker privileges and ensure RLS applies

-- 1) Ensure view uses invoker's permissions and keeps barrier
ALTER VIEW public.inspectors_public SET (security_invoker = on);
ALTER VIEW public.inspectors_public SET (security_barrier = on);

-- 2) Ensure authenticated users can read underlying table (RLS enforced)
REVOKE ALL ON public.inspectors FROM PUBLIC;
REVOKE ALL ON public.inspectors FROM anon;
GRANT SELECT ON public.inspectors TO authenticated;
GRANT SELECT ON public.inspectors TO service_role;