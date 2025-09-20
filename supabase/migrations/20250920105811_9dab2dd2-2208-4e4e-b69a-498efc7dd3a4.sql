-- Simplify and strengthen inspector contact security
-- The current complex RLS policies have potential gaps, so we'll implement a single, clear policy

-- 1. Remove all existing SELECT policies on inspector_contacts to avoid conflicts
DROP POLICY IF EXISTS "Restricted inspector contact access" ON public.inspector_contacts;
DROP POLICY IF EXISTS "admin_org_contact_access" ON public.inspector_contacts;
DROP POLICY IF EXISTS "explicit_inspector_contact_access" ON public.inspector_contacts;

-- 2. Create a single, clear, restrictive SELECT policy
-- ONLY admins in the same organization can access inspector contact information
CREATE POLICY "Admin only inspector contact access" 
ON public.inspector_contacts 
FOR SELECT 
USING (
  -- User must be an admin
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  AND
  -- User must be in the same organization as the contact
  organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
);

-- 3. Ensure all other policies are restrictive and consistent
-- Update INSERT policy to be more explicit
DROP POLICY IF EXISTS "Admins manage inspector contacts (insert)" ON public.inspector_contacts;
CREATE POLICY "Admin only inspector contact insert" 
ON public.inspector_contacts 
FOR INSERT 
WITH CHECK (
  -- Only admins can create contact records
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  AND
  -- Must be in the same organization
  organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
  AND
  -- Ensure the inspector belongs to the same organization
  EXISTS (
    SELECT 1 FROM public.inspectors 
    WHERE id = inspector_id 
    AND organization_id = (
      SELECT organization_id 
      FROM public.user_profiles 
      WHERE id = auth.uid()
    )
  )
);

-- Update UPDATE policy to be more explicit
DROP POLICY IF EXISTS "Admins manage inspector contacts (update)" ON public.inspector_contacts;
CREATE POLICY "Admin only inspector contact update" 
ON public.inspector_contacts 
FOR UPDATE 
USING (
  -- Only admins can update contact records
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  AND
  -- Must be in the same organization
  organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  -- Ensure the updated record maintains same organization
  organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
);

-- Update DELETE policy to be more explicit
DROP POLICY IF EXISTS "Admins manage inspector contacts (delete)" ON public.inspector_contacts;
CREATE POLICY "Admin only inspector contact delete" 
ON public.inspector_contacts 
FOR DELETE 
USING (
  -- Only admins can delete contact records
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  AND
  -- Must be in the same organization
  organization_id = (
    SELECT organization_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  )
);

-- 4. Update the security definer function to match the simplified access model
-- Remove the complex elevated access logic and make it admin-only
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
BEGIN
  -- Get current user's organization and role
  SELECT organization_id, role INTO user_org_id, user_role
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  -- Verify user exists and has required access
  IF user_org_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: User not found or not in an organization';
  END IF;
  
  -- Only admins can access contact information
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required to view contact information';
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
    user_org_id,
    jsonb_build_object(
      'accessed_inspector_id', target_inspector_id,
      'access_level', 'admin',
      'timestamp', now(),
      'user_role', user_role
    )
  );
  
  -- Return the contact information
  RETURN QUERY
  SELECT 
    i.name as inspector_name,
    COALESCE(ic.email, 'Not available') as inspector_email,
    COALESCE(ic.phone, 'Not available') as inspector_phone,
    'admin'::text as access_level
  FROM public.inspectors i
  LEFT JOIN public.inspector_contacts ic ON i.id = ic.inspector_id
  WHERE i.id = target_inspector_id;
END;
$$;

-- 5. Create a simplified function for getting inspector contact info for admins only
CREATE OR REPLACE FUNCTION public.get_inspector_contact_for_admin(target_inspector_id uuid)
RETURNS TABLE(inspector_name text, inspector_email text, inspector_phone text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins in the same organization
  IF NOT (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin' THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Verify the target inspector is in the same organization
  IF NOT EXISTS (
    SELECT 1 FROM public.inspectors 
    WHERE id = target_inspector_id 
    AND organization_id = (
      SELECT organization_id 
      FROM public.user_profiles 
      WHERE id = auth.uid()
    )
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
    (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()),
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
$$;