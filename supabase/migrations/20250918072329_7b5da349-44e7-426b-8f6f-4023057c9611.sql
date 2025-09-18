-- Fix security definer view warning
-- Remove SECURITY DEFINER property from the view

-- Drop and recreate the view without security_invoker property
DROP VIEW IF EXISTS public.inspector_basic_info;

-- Create the view without SECURITY DEFINER property
CREATE VIEW public.inspector_basic_info AS
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

-- Grant access to the view for authenticated users
GRANT SELECT ON public.inspector_basic_info TO authenticated;