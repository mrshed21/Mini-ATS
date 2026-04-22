-- ============================================================
-- Mini-ATS — Radical Fix for Jobs RLS Recursion
-- ============================================================
-- This script completely removes dependency on the "profiles" table 
-- inside "jobs" RLS policies by using auth.jwt() user_metadata.
-- ============================================================

-- 1. Drop ALL existing policies on the jobs table to ensure a clean slate
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'jobs' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs', pol.policyname);
    END LOOP;
END $$;

-- 2. Create high-performance SELECT policy (Zero Recursion)
-- Relies exclusively on JWT metadata for company isolation
CREATE POLICY "jobs_select_flat_jwt" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    company_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'company_id')::uuid
  );

-- 3. Create high-performance INSERT policy
CREATE POLICY "jobs_insert_flat_jwt" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'company_id')::uuid
  );

-- 4. Create UPDATE policy
CREATE POLICY "jobs_update_flat_jwt" ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    company_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'company_id')::uuid
  );

-- 5. Create DELETE policy
CREATE POLICY "jobs_delete_flat_jwt" ON public.jobs
  FOR DELETE TO authenticated
  USING (
    company_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'company_id')::uuid
  );

-- 6. Safety check: Ensure profiles table policies do NOT touch the jobs table
-- None found in current schema.

-- 7. Grant necessary permissions
GRANT ALL ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
