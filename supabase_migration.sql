-- ============================================================
-- Mini-ATS — Migration: Company Admin profiles UPDATE policy
-- ============================================================
-- Date: 2026-04-22
-- Purpose: Allow company_admin to UPDATE (soft-delete) profiles
--          within their own company, enabling team member removal.
--
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Add policy: company_admin can update profiles in their company
CREATE POLICY "Company admins can update company profiles"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'company_admin'
    AND company_id = (SELECT company_id FROM public.get_my_profile())
  );

-- Note: PostgreSQL RLS policies are OR-combined, so this expands access
-- without affecting existing policies (self-update, admin full access).