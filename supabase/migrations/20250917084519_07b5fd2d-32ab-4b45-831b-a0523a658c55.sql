-- Fix security issue: Add RLS policies to knowledge_vectors table
-- First, add organization_id column to knowledge_vectors for proper access control
ALTER TABLE public.knowledge_vectors 
ADD COLUMN organization_id UUID;

-- Enable Row Level Security on knowledge_vectors table
ALTER TABLE public.knowledge_vectors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies similar to knowledge_base table for organization-based access control

-- Policy for authenticated users to read knowledge vectors in their organization
CREATE POLICY "Authenticated users can read knowledge vectors in their org" 
ON public.knowledge_vectors 
FOR SELECT 
USING (
  organization_id = (
    SELECT user_profiles.organization_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

-- Policy for users to insert knowledge vectors in their organization
CREATE POLICY "Users can insert knowledge vectors in their org" 
ON public.knowledge_vectors 
FOR INSERT 
WITH CHECK (
  organization_id = (
    SELECT user_profiles.organization_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

-- Policy for users to update knowledge vectors in their organization
CREATE POLICY "Users can update knowledge vectors in their org" 
ON public.knowledge_vectors 
FOR UPDATE 
USING (
  organization_id = (
    SELECT user_profiles.organization_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
)
WITH CHECK (
  organization_id = (
    SELECT user_profiles.organization_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);

-- Policy for users to delete knowledge vectors in their organization
CREATE POLICY "Users can delete knowledge vectors in their org" 
ON public.knowledge_vectors 
FOR DELETE 
USING (
  organization_id = (
    SELECT user_profiles.organization_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);