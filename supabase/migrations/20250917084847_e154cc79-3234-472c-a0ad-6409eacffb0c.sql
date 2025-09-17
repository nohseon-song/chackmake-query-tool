-- Fix security issue: Remove overly permissive admin access to user profiles
-- This prevents compromised admin accounts from stealing all user contact information

-- Drop the existing admin policy that allows viewing all profiles
DROP POLICY "Admins can view all profiles in their organization" ON public.user_profiles;

-- Create a secure function for admins to get basic user management info (no sensitive contact data)
CREATE OR REPLACE FUNCTION public.get_organization_users()
RETURNS TABLE(
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id as user_id,
    name as user_name,
    role as user_role,
    is_active,
    created_at
  FROM user_profiles
  WHERE organization_id = get_current_user_org_id()
    AND is_admin();
$$;

-- Create an audited function for legitimate admin access to contact info (with logging)
CREATE OR REPLACE FUNCTION public.get_user_contact_for_admin(target_user_id UUID)
RETURNS TABLE(
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT
)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins in the same organization
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Verify the target user is in the same organization
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = target_user_id 
    AND organization_id = get_current_user_org_id()
  ) THEN
    RAISE EXCEPTION 'Access denied: User not found in your organization';
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
    'user_profiles',
    'ADMIN_CONTACT_ACCESS',
    target_user_id,
    auth.uid(),
    get_current_user_org_id(),
    jsonb_build_object('accessed_user_id', target_user_id, 'timestamp', now())
  );
  
  -- Return the contact information
  RETURN QUERY
  SELECT 
    up.name as user_name,
    up.email as user_email,
    up.phone as user_phone
  FROM user_profiles up
  WHERE up.id = target_user_id;
END;
$$;