-- Comprehensive fix for inspector_contacts security vulnerability
-- Replace overly restrictive policy with organization-scoped access control

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users can view inspector contacts they created" ON public.inspector_contacts;

-- Create comprehensive organization-scoped policies for inspector_contacts

-- Policy 1: Users in same organization can view basic inspector info (but not sensitive contact details)
-- This will be handled through a view that excludes sensitive data

-- Policy 2: Admin-only access to sensitive contact information with organization scoping
CREATE POLICY "Admins can view inspector contacts in their organization"
ON public.inspector_contacts 
FOR SELECT 
USING (
  is_admin() 
  AND organization_id = get_current_user_org_id()
);

-- Policy 3: Allow users to view contacts for inspectors they have explicit access to
CREATE POLICY "Users with inspector access can view basic contact info"
ON public.inspector_contacts 
FOR SELECT 
USING (
  organization_id = get_current_user_org_id()
  AND EXISTS (
    SELECT 1 FROM user_inspector_access uia
    WHERE uia.user_id = auth.uid()
    AND uia.inspector_id = inspector_contacts.inspector_id
    AND uia.organization_id = inspector_contacts.organization_id
  )
);

-- Create a secure view for basic inspector information without sensitive contact details
CREATE OR REPLACE VIEW public.inspector_basic_info AS
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

-- Enable RLS on the view (though views inherit RLS from underlying tables)
ALTER VIEW public.inspector_basic_info SET (security_invoker = true);

-- Grant access to the view for authenticated users
GRANT SELECT ON public.inspector_basic_info TO authenticated;

-- Update the secure admin function to include better error handling and logging
CREATE OR REPLACE FUNCTION public.get_inspector_contact_secure(target_inspector_id uuid)
RETURNS TABLE(
    inspector_name text,
    inspector_email text,
    inspector_phone text,
    access_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $function$
DECLARE
  user_org_id uuid;
  inspector_org_id uuid;
  user_role text;
BEGIN
  -- Get current user's organization and role
  SELECT organization_id, role INTO user_org_id, user_role
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: User not found or not in an organization';
  END IF;
  
  -- Get inspector's organization
  SELECT organization_id INTO inspector_org_id
  FROM public.inspectors 
  WHERE id = target_inspector_id;
  
  IF inspector_org_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: Inspector not found';
  END IF;
  
  -- Verify same organization
  IF user_org_id != inspector_org_id THEN
    RAISE EXCEPTION 'Access denied: Inspector not in your organization';
  END IF;
  
  -- Check if user has appropriate access
  IF user_role != 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.user_inspector_access 
    WHERE user_id = auth.uid() 
    AND inspector_id = target_inspector_id
    AND role IN ('manager', 'lead', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied: Insufficient privileges to view contact information';
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
    'CONTACT_INFO_ACCESS',
    target_inspector_id,
    auth.uid(),
    user_org_id,
    jsonb_build_object(
      'accessed_inspector_id', target_inspector_id,
      'access_level', CASE WHEN user_role = 'admin' THEN 'admin' ELSE 'authorized_user' END,
      'timestamp', now(),
      'user_role', user_role
    )
  );
  
  -- Return the contact information with access level
  RETURN QUERY
  SELECT 
    i.name as inspector_name,
    COALESCE(ic.email, 'Not available') as inspector_email,
    COALESCE(ic.phone, 'Not available') as inspector_phone,
    CASE WHEN user_role = 'admin' THEN 'admin' ELSE 'authorized' END as access_level
  FROM public.inspectors i
  LEFT JOIN public.inspector_contacts ic ON i.id = ic.inspector_id
  WHERE i.id = target_inspector_id;
END;
$function$;