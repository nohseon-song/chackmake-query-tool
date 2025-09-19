-- Fix security issues with inspector contact information

-- 1. Enable RLS on inspector_basic_info table if not already enabled
ALTER TABLE public.inspector_basic_info ENABLE ROW LEVEL SECURITY;

-- 2. Add RLS policies for inspector_basic_info table
-- Only users in the same organization can view inspector basic info
CREATE POLICY "Users can view inspector basic info in their organization" 
ON public.inspector_basic_info 
FOR SELECT 
USING (organization_id = (
  SELECT organization_id 
  FROM public.user_profiles 
  WHERE id = auth.uid()
));

-- Only admins can insert inspector basic info
CREATE POLICY "Admins can insert inspector basic info" 
ON public.inspector_basic_info 
FOR INSERT 
WITH CHECK (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' 
  AND organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
);

-- Only admins can update inspector basic info
CREATE POLICY "Admins can update inspector basic info" 
ON public.inspector_basic_info 
FOR UPDATE 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' 
  AND organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
);

-- Only admins can delete inspector basic info
CREATE POLICY "Admins can delete inspector basic info" 
ON public.inspector_basic_info 
FOR DELETE 
USING (
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' 
  AND organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
);

-- 3. Strengthen inspector_contacts policies
-- Remove the overly permissive explicit access policy and replace with more restrictive one
DROP POLICY IF EXISTS "explicit_inspector_contact_access" ON public.inspector_contacts;

-- Create a more restrictive policy for viewing inspector contacts
-- Only allow viewing if user is admin OR has specific elevated access AND is viewing contacts for inspectors they have access to
CREATE POLICY "Restricted inspector contact access" 
ON public.inspector_contacts 
FOR SELECT 
USING (
  organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
  AND (
    -- Admin can view all contacts in their org
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- User with elevated access can only view contacts for inspectors they have explicit access to
    EXISTS (
      SELECT 1
      FROM public.user_inspector_access uia
      WHERE uia.user_id = auth.uid()
        AND uia.inspector_id = inspector_contacts.inspector_id
        AND uia.organization_id = inspector_contacts.organization_id
        AND uia.role IN ('manager', 'lead', 'owner')
    )
  )
);

-- 4. Update the get_inspector_contact_secure function to be more restrictive and add proper audit logging
CREATE OR REPLACE FUNCTION public.get_inspector_contact_secure(target_inspector_id uuid)
RETURNS TABLE(inspector_name text, inspector_email text, inspector_phone text, access_level text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
  inspector_org_id uuid;
  user_role text;
  has_explicit_access boolean := false;
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
  IF user_role = 'admin' THEN
    has_explicit_access := true;
  ELSE
    -- Check for explicit elevated access
    SELECT EXISTS (
      SELECT 1 FROM public.user_inspector_access 
      WHERE user_id = auth.uid() 
      AND inspector_id = target_inspector_id
      AND organization_id = user_org_id
      AND role IN ('manager', 'lead', 'owner')
    ) INTO has_explicit_access;
  END IF;
  
  IF NOT has_explicit_access THEN
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
    'SECURE_CONTACT_ACCESS',
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
$$;