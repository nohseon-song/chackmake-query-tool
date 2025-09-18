-- Fix security vulnerability in inspector_contacts table
-- Remove overly permissive policies that allow bulk access to contact information

-- Drop existing permissive SELECT policies
DROP POLICY IF EXISTS "Admins can view inspector contacts in org" ON public.inspector_contacts;
DROP POLICY IF EXISTS "Managers/leads/owners with explicit access can view inspector c" ON public.inspector_contacts;

-- Create secure function to get basic inspector information without sensitive contact details
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
SET search_path = 'public'
AS $function$
  SELECT 
    i.id as inspector_id,
    i.name as inspector_name,
    i.position as inspector_position,
    i.technical_grade,
    i.is_team_leader,
    i.location_id
  FROM inspectors i
  WHERE i.organization_id = get_current_user_org_id()
    AND is_admin();
$function$;

-- Create secure function for legitimate contact access with audit logging
CREATE OR REPLACE FUNCTION public.get_inspector_contact_for_admin(target_inspector_id uuid)
RETURNS TABLE(
    inspector_name text,
    inspector_email text,
    inspector_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow admins in the same organization
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Verify the target inspector is in the same organization
  IF NOT EXISTS (
    SELECT 1 FROM inspectors 
    WHERE id = target_inspector_id 
    AND organization_id = get_current_user_org_id()
  ) THEN
    RAISE EXCEPTION 'Access denied: Inspector not found in your organization';
  END IF;
  
  -- Log the access for audit purposes
  INSERT INTO audit_logs (
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
    get_current_user_org_id(),
    jsonb_build_object('accessed_inspector_id', target_inspector_id, 'timestamp', now())
  );
  
  -- Return the contact information
  RETURN QUERY
  SELECT 
    i.name as inspector_name,
    ic.email as inspector_email,
    ic.phone as inspector_phone
  FROM inspectors i
  LEFT JOIN inspector_contacts ic ON i.id = ic.inspector_id
  WHERE i.id = target_inspector_id;
END;
$function$;

-- Create restrictive policy for viewing inspector contacts (only individual access)
CREATE POLICY "Users can view inspector contacts they created"
ON public.inspector_contacts 
FOR SELECT 
USING (created_by = auth.uid());