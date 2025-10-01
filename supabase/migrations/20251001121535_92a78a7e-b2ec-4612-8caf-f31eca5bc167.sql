-- Drop the insecure inspector_basic_info view
DROP VIEW IF EXISTS public.inspector_basic_info CASCADE;

-- Create a secure function to get inspector basic info
CREATE OR REPLACE FUNCTION public.get_inspector_basic_info()
RETURNS TABLE(
  inspector_id uuid,
  inspector_name text,
  organization_id uuid,
  "position" text,
  technical_grade text[],
  is_team_leader boolean,
  location_id uuid,
  has_email boolean,
  has_phone boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Return inspector basic info filtered by organization
  RETURN QUERY
  SELECT 
    i.id as inspector_id,
    i.name as inspector_name,
    i.organization_id,
    i."position",
    i.technical_grade,
    i.is_team_leader,
    i.location_id,
    (ic.email IS NOT NULL) as has_email,
    (ic.phone IS NOT NULL) as has_phone
  FROM public.inspectors i
  LEFT JOIN public.inspector_contacts ic ON i.id = ic.inspector_id
  WHERE i.organization_id = public.get_current_user_org_id();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_inspector_basic_info() TO authenticated;

COMMENT ON FUNCTION public.get_inspector_basic_info() IS 'Securely retrieve inspector basic information scoped to the current user''s organization';