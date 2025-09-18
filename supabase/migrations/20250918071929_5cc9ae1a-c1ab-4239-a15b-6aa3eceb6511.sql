-- Fix function search path warnings for security compliance
-- Update the functions to have proper search_path settings

DROP FUNCTION IF EXISTS public.get_organization_inspectors();
DROP FUNCTION IF EXISTS public.get_inspector_contact_for_admin(uuid);

-- Recreate function with proper search_path
CREATE OR REPLACE FUNCTION public.get_organization_inspectors()
RETURNS TABLE(
    inspector_id uuid,
    inspector_name text,
    inspector_position text,
    technical_grade text[],
    is_team_leader boolean,
    location_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $function$
  SELECT 
    i.id as inspector_id,
    i.name as inspector_name,
    i.position as inspector_position,
    i.technical_grade,
    i.is_team_leader,
    i.location_id
  FROM public.inspectors i
  WHERE i.organization_id = public.get_current_user_org_id()
    AND public.is_admin();
$function$;

-- Recreate function with proper search_path
CREATE OR REPLACE FUNCTION public.get_inspector_contact_for_admin(target_inspector_id uuid)
RETURNS TABLE(
    inspector_name text,
    inspector_email text,
    inspector_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admins in the same organization
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Verify the target inspector is in the same organization
  IF NOT EXISTS (
    SELECT 1 FROM public.inspectors 
    WHERE id = target_inspector_id 
    AND organization_id = public.get_current_user_org_id()
  ) THEN
    RAISE EXCEPTION 'Access denied: Inspector not found in your organization';
  END IF;
  
  -- Log the access for audit purposes
  INSERT INTO public.audit_logs (
    table_name,
    action,
    record_id,
    user_id,
    organization_id,
    new_values
  ) VALUES (
    'inspector_contacts',
    'ADMIN_CONTACT_ACCESS',
    target_inspector_id,
    auth.uid(),
    public.get_current_user_org_id(),
    jsonb_build_object('accessed_inspector_id', target_inspector_id, 'timestamp', now())
  );
  
  -- Return the contact information
  RETURN QUERY
  SELECT 
    i.name as inspector_name,
    ic.email as inspector_email,
    ic.phone as inspector_phone
  FROM public.inspectors i
  LEFT JOIN public.inspector_contacts ic ON i.id = ic.inspector_id
  WHERE i.id = target_inspector_id;
END;
$function$;