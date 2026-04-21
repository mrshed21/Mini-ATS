-- ============================================================
-- Mini-ATS — Migration: Job Groups + Activity Log
-- Apply this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. job_groups
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job groups policy" ON public.job_groups;
CREATE POLICY "Job groups policy" ON public.job_groups
  USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    OR (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  );

-- ─────────────────────────────────────────
-- 2. job_group_members
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.job_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.profiles(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.job_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job group members policy" ON public.job_group_members;
CREATE POLICY "Job group members policy" ON public.job_group_members
  USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    OR (EXISTS (
      SELECT 1 FROM public.job_groups jg
      WHERE jg.id = group_id
        AND jg.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    ))
  );

-- ─────────────────────────────────────────
-- 3. job_access  (ربط جروب بوظيفة)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.job_groups(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (job_id, group_id)
);

ALTER TABLE public.job_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job access policy" ON public.job_access;
CREATE POLICY "Job access policy" ON public.job_access
  USING (
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    OR (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    ))
  );

-- ─────────────────────────────────────────
-- 4. تحديث RLS لـ jobs (يشمل الجروبات)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "Jobs management v2" ON public.jobs;
DROP POLICY IF EXISTS "Jobs management v3" ON public.jobs;

CREATE POLICY "Jobs management v3" ON public.jobs USING (
  -- Admin: كل شيء
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  -- Company Admin: وظائف شركته
  OR (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'company_admin' AND company_id = jobs.company_id
  ))
  -- Customer: وظائفه الخاصة
  OR (customer_id = auth.uid())
  -- Customer في جروب: الوظائف المشتركة معه
  OR (EXISTS (
    SELECT 1 FROM public.job_access ja
    JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
    WHERE ja.job_id = jobs.id AND jgm.user_id = auth.uid()
  ))
);

-- ─────────────────────────────────────────
-- 5. تحديث RLS لـ candidates (يشمل الجروبات)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "Candidates management v2" ON public.candidates;
DROP POLICY IF EXISTS "Candidates management v3" ON public.candidates;

CREATE POLICY "Candidates management v3" ON public.candidates USING (
  -- Admin
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  -- Company Admin: مرشحو وظائف شركته
  OR (EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.profiles p ON p.company_id = j.company_id
    WHERE j.id = candidates.job_id AND p.id = auth.uid() AND p.role = 'company_admin'
  ))
  -- Customer: مرشحو وظائفه الخاصة
  OR (EXISTS (
    SELECT 1 FROM public.jobs WHERE id = candidates.job_id AND customer_id = auth.uid()
  ))
  -- Customer في جروب: مرشحو الوظائف المشتركة معه
  OR (EXISTS (
    SELECT 1 FROM public.job_access ja
    JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
    WHERE ja.job_id = candidates.job_id AND jgm.user_id = auth.uid()
  ))
);

-- ─────────────────────────────────────────
-- 6. تحديث RLS لـ notes (يشمل الجروبات)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "Notes management" ON public.notes;

CREATE POLICY "Notes management v2" ON public.notes USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = notes.candidate_id AND (
      -- Admin
      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
      -- Company Admin
      OR (EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.profiles p ON p.company_id = j.company_id
        WHERE j.id = c.job_id AND p.id = auth.uid() AND p.role = 'company_admin'
      ))
      -- صاحب الوظيفة
      OR (EXISTS (
        SELECT 1 FROM public.jobs WHERE id = c.job_id AND customer_id = auth.uid()
      ))
      -- عبر الجروب
      OR (EXISTS (
        SELECT 1 FROM public.job_access ja
        JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
        WHERE ja.job_id = c.job_id AND jgm.user_id = auth.uid()
      ))
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = notes.candidate_id AND (
      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
      OR (EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.profiles p ON p.company_id = j.company_id
        WHERE j.id = c.job_id AND p.id = auth.uid() AND p.role = 'company_admin'
      ))
      OR (EXISTS (
        SELECT 1 FROM public.jobs WHERE id = c.job_id AND customer_id = auth.uid()
      ))
      OR (EXISTS (
        SELECT 1 FROM public.job_access ja
        JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
        WHERE ja.job_id = c.job_id AND jgm.user_id = auth.uid()
      ))
    )
  )
);

-- ─────────────────────────────────────────
-- 7. activity_log
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- من نفّذ الإجراء (الحقيقي)
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  -- باسم من (في حالة impersonation)
  on_behalf_of_id UUID REFERENCES public.profiles(id),
  on_behalf_of_name TEXT,
  -- الإجراء
  action TEXT NOT NULL,
  -- create | update | delete | stage_change | note_added | group_assigned | job_reassigned | impersonation_start | impersonation_end
  entity_type TEXT NOT NULL,
  -- job | candidate | note | profile | group | job_access | session
  entity_id UUID,
  entity_name TEXT,
  -- التغيير
  old_value JSONB,
  new_value JSONB,
  -- الشركة
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Admin يرى كل شيء
DROP POLICY IF EXISTS "Activity log admin" ON public.activity_log;
CREATE POLICY "Activity log admin" ON public.activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Company Admin يرى سجل شركته فقط
DROP POLICY IF EXISTS "Activity log company admin" ON public.activity_log;
CREATE POLICY "Activity log company admin" ON public.activity_log FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'company_admin'
  );

-- أي مستخدم مصادَق عليه يستطيع الكتابة (يُسجَّل بـ actor_id = auth.uid())
DROP POLICY IF EXISTS "Activity log insert" ON public.activity_log;
CREATE POLICY "Activity log insert" ON public.activity_log FOR INSERT
  WITH CHECK (auth.uid() = actor_id);
