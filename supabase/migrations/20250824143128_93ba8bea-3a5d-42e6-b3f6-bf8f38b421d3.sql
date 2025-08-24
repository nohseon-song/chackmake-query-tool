-- Drop the publicly accessible inspectors_public view since it exposes sensitive data
-- The main inspectors table already has proper RLS policies that provide the same filtering

DROP VIEW IF EXISTS public.inspectors_public CASCADE;