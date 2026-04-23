-- ============================================================
-- Mini-ATS — Ultimate RLS Fix for Jobs and Candidates v2
-- ============================================================
-- تاريخ: 2026-04-23
-- التحديث الجديد: إضافة شرط فحص دور المستخدم (Role) 
-- لمنع الموظف من رؤية جميع وظائف الشركة، وحصرها لمدير الشركة فقط.
-- ============================================================

-- 1. دالة لفحص الوصول عبر مجموعات العمل (وظائف تمت مشاركتها)
CREATE OR REPLACE FUNCTION public.user_has_job_access(check_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_access ja
    JOIN public.job_group_members jgm ON ja.group_id = jgm.group_id
    WHERE ja.job_id = check_job_id
      AND jgm.user_id = auth.uid()
  );
$$;

-- 2. دالة شاملة للتحقق من صلاحية قراءة الوظيفة (تُستخدم لجدول المرشحين)
CREATE OR REPLACE FUNCTION public.user_can_view_job(check_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = check_job_id
    AND (
      -- مدير الشركة الخاص بالوظيفة
      (
        j.company_id = (SELECT company_id FROM public.get_my_profile())
        AND (SELECT role FROM public.get_my_profile()) = 'company_admin'
      )
      -- أو منشئ الوظيفة (الموظف الذي أنشأها)
      OR j.customer_id = auth.uid()
      -- أو تمت مشاركة الوظيفة معه عبر مجموعة
      OR EXISTS (
        SELECT 1 FROM public.job_access ja
        JOIN public.job_group_members jgm ON ja.group_id = jgm.group_id
        WHERE ja.job_id = check_job_id
          AND jgm.user_id = auth.uid()
      )
    )
  );
$$;

-- منح صلاحيات التنفيذ
GRANT EXECUTE ON FUNCTION public.user_has_job_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_job(UUID) TO authenticated;

-- ============================================================
-- 3. تحديث سياسات جدول Jobs
-- ============================================================
DROP POLICY IF EXISTS "Jobs comprehensive access" ON public.jobs;
DROP POLICY IF EXISTS "Jobs select with team access" ON public.jobs;
DROP POLICY IF EXISTS "Jobs visibility by company" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
DROP POLICY IF EXISTS "Jobs management v2" ON public.jobs;
DROP POLICY IF EXISTS "Employees can view shared jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_dynamic_access" ON public.jobs;

CREATE POLICY "jobs_dynamic_access" ON public.jobs
FOR SELECT TO authenticated
USING (
  -- 1. الأدمن العام يرى الكل
  (SELECT role FROM public.get_my_profile()) = 'admin'
  
  -- 2. مدير الشركة يرى وظائف شركته
  OR (
    (SELECT role FROM public.get_my_profile()) = 'company_admin'
    AND company_id = (SELECT company_id FROM public.get_my_profile())
  )
  
  -- 3. الموظف يرى الوظيفة التي أنشأها بنفسه
  OR customer_id = auth.uid()
  
  -- 4. الموظف يرى الوظيفة التي تمت مشاركتها معه
  OR public.user_has_job_access(id)
);

-- ============================================================
-- 4. تحديث سياسات جدول Candidates
-- ============================================================
DROP POLICY IF EXISTS "Candidates comprehensive access" ON public.candidates;
DROP POLICY IF EXISTS "candidates_select" ON public.candidates;
DROP POLICY IF EXISTS "candidates_dynamic_access" ON public.candidates;
DROP POLICY IF EXISTS "candidates_select_policy" ON public.candidates;

CREATE POLICY "candidates_dynamic_access" ON public.candidates
FOR SELECT TO authenticated
USING (
  -- 1. الأدمن العام يرى الكل
  (SELECT role FROM public.get_my_profile()) = 'admin'
  
  -- 2. الاعتماد على الدالة الشاملة للتحقق (تدعم مدير الشركة، المنشئ، والمشترك)
  OR public.user_can_view_job(job_id)
);

-- ============================================================
-- انتهى السكربت. يرجى إعادة تنفيذه في Supabase SQL Editor.
-- ============================================================
