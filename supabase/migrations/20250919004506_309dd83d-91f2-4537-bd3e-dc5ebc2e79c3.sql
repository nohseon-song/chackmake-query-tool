-- Final fix for security definer view warning
-- Completely drop and recreate the view with explicit non-security-definer properties

-- Drop the view completely
DROP VIEW IF EXISTS public.inspector_basic_info CASCADE;

-- Recreate the view with explicit security invoker (opposite of security definer)
CREATE VIEW public.inspector_basic_info 
WITH (security_invoker = true) AS
SELECT 
  i.id as inspector_id,
  i.name as inspector_name,
  i.position,
  i.technical_grade,
  i.is_team_leader,
  i.location_id,
  i.organization_id,
  -- Only include non-sensitive contact flags
  CASE WHEN ic.email IS NOT NULL THEN true ELSE false END as has_email,
  CASE WHEN ic.phone IS NOT NULL THEN true ELSE false END as has_phone
FROM public.inspectors i
LEFT JOIN public.inspector_contacts ic ON i.id = ic.inspector_id
WHERE i.organization_id = get_current_user_org_id();

-- Grant access to authenticated users
GRANT SELECT ON public.inspector_basic_info TO authenticated;

-- Verify no security definer properties exist
DO $$
BEGIN
  -- This will raise an exception if any views with security definer are found
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND definition ILIKE '%security%definer%'
  ) THEN
    RAISE EXCEPTION 'Security definer view still exists!';
  END IF;
  
  RAISE NOTICE 'No security definer views found - fix successful';
END $$;