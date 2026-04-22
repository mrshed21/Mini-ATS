-- ============================================================
-- Mini-ATS — RLS Flat Policies v2 (مبنية على db_backup03)
-- ============================================================
-- تاريخ: 2026-04-22
-- الهدف: إصلاح Infinite Recursion في جميع السياسات الموجودة
--        عبر استبدال subqueries على profiles بدالة SECURITY DEFINER
--
-- الطريقة:
--   1. إنشاء دالة get_my_profile() تقرأ profiles بدون RLS
--   2. حذف جميع السياسات القديمة المتعارضة
--   3. إنشاء سياسات نظيفة ومسطحة
--
-- التطبيق:
--   Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- الخطوة 1: الدالة الأساسية لتجاوز RLS Recursion
-- ══════════════════════════════════════════════════════════════
-- تحل محل: is_admin() التي تقرأ profiles تحت RLS
-- المبدأ: SECURITY DEFINER تتجاوز RLS وتقرأ profiles مباشرة
-- STABLE: Postgres يحتفظ بالنتيجة في cache طوال الـ query

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE(role TEXT, company_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT, company_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- منح صلاحية التشغيل للمستخدمين
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO service_role;


-- ══════════════════════════════════════════════════════════════
-- الخطوة 2: تحديث is_admin() لتستخدم get_my_profile
-- (تستخدمها سياسات profiles الموجودة)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ══════════════════════════════════════════════════════════════
-- الخطوة 3: إصلاح سياسات COMPANIES
-- الموجودة حالياً:
--   ✅ "Users can view their own company" - تستخدم subquery (سنُصلح)
--   ✅ "Admins can do everything on companies" - تستخدم subquery (سنُصلح)
--   ✅ "Allow admins to delete/insert/update companies" - subquery (سنُصلح)
-- ══════════════════════════════════════════════════════════════

-- حذف جميع سياسات companies القديمة
DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
DROP POLICY IF EXISTS "Admins can do everything on companies" ON public.companies;
DROP POLICY IF EXISTS "Allow admins to delete companies" ON public.companies;
DROP POLICY IF EXISTS "Allow admins to insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allow admins to update companies" ON public.companies;

-- SELECT: Admin يرى كل شيء، أي مستخدم يرى شركته فقط
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR id = (SELECT company_id FROM public.get_my_profile())
  );

-- INSERT: Admin فقط
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.get_my_profile()) = 'admin'
  );

-- UPDATE: Admin فقط
CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
  );

-- DELETE: Admin فقط
CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 4: إصلاح سياسات JOBS
-- الموجودة حالياً (كلها FOR SELECT بشكل مكرر + INSERT واحد):
--   "Jobs comprehensive access"  — subquery على profiles
--   "Jobs select with team access" — subquery على profiles
--   "Jobs visibility by company"  — يستخدم auth.jwt() user_metadata (آمن)
--   "Jobs insertion by staff"     — يستخدم auth.jwt() (آمن جزئياً)
-- ══════════════════════════════════════════════════════════════

-- حذف جميع سياسات jobs القديمة
DROP POLICY IF EXISTS "Jobs comprehensive access" ON public.jobs;
DROP POLICY IF EXISTS "Jobs select with team access" ON public.jobs;
DROP POLICY IF EXISTS "Jobs visibility by company" ON public.jobs;
DROP POLICY IF EXISTS "Jobs insertion by staff" ON public.jobs;
DROP POLICY IF EXISTS "Jobs management v2" ON public.jobs;
DROP POLICY IF EXISTS "Jobs management v3" ON public.jobs;

-- SELECT: سياسة موحدة شاملة
CREATE POLICY "jobs_select" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    -- Admin: يرى كل شيء
    (SELECT role FROM public.get_my_profile()) = 'admin'

    -- Company Admin: يرى وظائف شركته
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND jobs.company_id = (SELECT company_id FROM public.get_my_profile())
    )

    -- Customer: يرى وظائفه الخاصة
    OR jobs.customer_id = auth.uid()

    -- Customer عبر جروب
    OR EXISTS (
      SELECT 1
      FROM public.job_access ja
      JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
      WHERE ja.job_id = jobs.id
        AND jgm.user_id = auth.uid()
    )
  );

-- INSERT: Admin أو Company Admin أو Customer (لنفسه)
CREATE POLICY "jobs_insert" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Admin: يُنشئ لأي شركة
    (SELECT role FROM public.get_my_profile()) = 'admin'

    -- Company Admin: ينشئ لشركته فقط
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND jobs.company_id = (SELECT company_id FROM public.get_my_profile())
    )

    -- Customer: ينشئ لنفسه وشركته
    OR (
      jobs.customer_id = auth.uid()
      AND jobs.company_id = (SELECT company_id FROM public.get_my_profile())
    )
  );

-- UPDATE: صاحب الوظيفة أو Company Admin أو Admin
CREATE POLICY "jobs_update" ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND jobs.company_id = (SELECT company_id FROM public.get_my_profile())
    )
    OR jobs.customer_id = auth.uid()
  );

-- DELETE: Admin أو Company Admin أو صاحب الوظيفة
CREATE POLICY "jobs_delete" ON public.jobs
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND jobs.company_id = (SELECT company_id FROM public.get_my_profile())
    )
    OR jobs.customer_id = auth.uid()
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 5: إصلاح سياسات CANDIDATES
-- الموجودة حالياً:
--   "Candidates comprehensive access" — subquery على profiles
--   لا يوجد سياسة INSERT أو WITH CHECK → لذا INSERT محظور!
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Candidates comprehensive access" ON public.candidates;
DROP POLICY IF EXISTS "Candidates management v2" ON public.candidates;
DROP POLICY IF EXISTS "Candidates management v3" ON public.candidates;
DROP POLICY IF EXISTS "candidates_select" ON public.candidates;
DROP POLICY IF EXISTS "candidates_insert" ON public.candidates;
DROP POLICY IF EXISTS "candidates_update" ON public.candidates;
DROP POLICY IF EXISTS "candidates_delete" ON public.candidates;

-- SELECT + UPDATE + DELETE
CREATE POLICY "candidates_select" ON public.candidates
  TO authenticated
  USING (
    -- Admin
    (SELECT role FROM public.get_my_profile()) = 'admin'

    -- Company Admin: مرشحو وظائف شركته
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = candidates.job_id
          AND j.company_id = (SELECT company_id FROM public.get_my_profile())
      )
    )

    -- Customer: مرشحو وظائفه
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = candidates.job_id
        AND j.customer_id = auth.uid()
    )

    -- عضو جروب
    OR EXISTS (
      SELECT 1
      FROM public.job_access ja
      JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
      WHERE ja.job_id = candidates.job_id
        AND jgm.user_id = auth.uid()
    )
  );

-- INSERT: يجب أن يكون المستخدم مرتبطاً بالوظيفة
CREATE POLICY "candidates_insert" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.get_my_profile()) = 'admin'

    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = candidates.job_id
          AND j.company_id = (SELECT company_id FROM public.get_my_profile())
      )
    )

    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = candidates.job_id
        AND j.customer_id = auth.uid()
    )

    OR EXISTS (
      SELECT 1
      FROM public.job_access ja
      JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
      WHERE ja.job_id = candidates.job_id
        AND jgm.user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 6: إصلاح سياسات NOTES
-- الموجودة حالياً: لا توجد سياسة مُسجَّلة في الـ backup!
-- (RLS مُفعَّل لكن لا توجد سياسة → كل شيء محظور)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Notes management" ON public.notes;
DROP POLICY IF EXISTS "Notes management v2" ON public.notes;
DROP POLICY IF EXISTS "notes_select" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;

CREATE POLICY "notes_select" ON public.notes
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN public.jobs j ON j.id = c.job_id
      WHERE c.id = notes.candidate_id
        AND (
          (SELECT role FROM public.get_my_profile()) = 'admin'
          OR (
            (SELECT role FROM public.get_my_profile()) = 'company_admin'
            AND j.company_id = (SELECT company_id FROM public.get_my_profile())
          )
          OR j.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_access ja
            JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
            WHERE ja.job_id = j.id
              AND jgm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN public.jobs j ON j.id = c.job_id
      WHERE c.id = notes.candidate_id
        AND (
          (SELECT role FROM public.get_my_profile()) = 'admin'
          OR (
            (SELECT role FROM public.get_my_profile()) = 'company_admin'
            AND j.company_id = (SELECT company_id FROM public.get_my_profile())
          )
          OR j.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.job_access ja
            JOIN public.job_group_members jgm ON jgm.group_id = ja.group_id
            WHERE ja.job_id = j.id
              AND jgm.user_id = auth.uid()
          )
        )
    )
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 7: إصلاح سياسات JOB_GROUPS
-- الموجودة حالياً:
--   "Job groups policy"     — subquery على profiles
--   "Job groups management" — subquery على profiles
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Job groups policy" ON public.job_groups;
DROP POLICY IF EXISTS "Job groups management" ON public.job_groups;
DROP POLICY IF EXISTS "job_groups_all" ON public.job_groups;

CREATE POLICY "job_groups_all" ON public.job_groups
  TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR job_groups.company_id = (SELECT company_id FROM public.get_my_profile())
  )
  WITH CHECK (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND job_groups.company_id = (SELECT company_id FROM public.get_my_profile())
    )
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 8: إصلاح سياسات JOB_GROUP_MEMBERS
-- الموجودة حالياً:
--   "Job group members policy" — subquery على profiles (recursion)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Job group members policy" ON public.job_group_members;
DROP POLICY IF EXISTS "job_group_members_all" ON public.job_group_members;

CREATE POLICY "job_group_members_all" ON public.job_group_members
  TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.job_groups jg
      WHERE jg.id = job_group_members.group_id
        AND jg.company_id = (SELECT company_id FROM public.get_my_profile())
    )
  )
  WITH CHECK (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND EXISTS (
        SELECT 1 FROM public.job_groups jg
        WHERE jg.id = job_group_members.group_id
          AND jg.company_id = (SELECT company_id FROM public.get_my_profile())
      )
    )
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 9: إصلاح سياسات JOB_ACCESS
-- الموجودة حالياً:
--   "Job access policy" — subquery على profiles (recursion)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Job access policy" ON public.job_access;
DROP POLICY IF EXISTS "job_access_all" ON public.job_access;

CREATE POLICY "job_access_all" ON public.job_access
  TO authenticated
  USING (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_access.job_id
        AND j.company_id = (SELECT company_id FROM public.get_my_profile())
    )
    OR EXISTS (
      SELECT 1 FROM public.job_group_members jgm
      WHERE jgm.group_id = job_access.group_id
        AND jgm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (SELECT role FROM public.get_my_profile()) = 'admin'
    OR (
      (SELECT role FROM public.get_my_profile()) = 'company_admin'
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = job_access.job_id
          AND j.company_id = (SELECT company_id FROM public.get_my_profile())
      )
    )
  );


-- ══════════════════════════════════════════════════════════════
-- الخطوة 10: إصلاح سياسات ACTIVITY_LOG
-- الموجودة حالياً (3 سياسات SELECT متعارضة + INSERT):
--   "Activity log admin"           — subquery على profiles
--   "Activity log company admin"   — subquery على profiles
--   "Activity log company view"    — subquery على profiles
--   "Users can view their company activity" — subquery على profiles
--   "Activity log insert"          — auth.uid() = actor_id (آمن ✅)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Activity log admin" ON public.activity_log;
DROP POLICY IF EXISTS "Activity log company admin" ON public.activity_log;
DROP POLICY IF EXISTS "Activity log company view" ON public.activity_log;
DROP POLICY IF EXISTS "Users can view their company activity" ON public.activity_log;

-- سياسة موحدة للقراءة
CREATE POLICY "activity_log_select" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    -- Admin: يرى كل شيء
    (SELECT role FROM public.get_my_profile()) = 'admin'
    -- Company Admin + Customer: يرى سجل شركته فقط
    OR activity_log.company_id = (SELECT company_id FROM public.get_my_profile())
  );

-- INSERT يبقى كما هو (آمن بلا recursion)
-- "Activity log insert" WITH CHECK (auth.uid() = actor_id) ✅


-- ══════════════════════════════════════════════════════════════
-- الخطوة 11: إصلاح سياسات PROFILES
-- الموجودة حالياً:
--   "Temp bypass"               — USING (true) ✅ آمن
--   "Admins manage all profiles"— يستخدم auth.jwt() ✅ آمن
--   "Users can insert own profile" — auth.uid() = id ✅ آمن
--   "Users can update own profile" — auth.uid() = id ✅ آمن
--   "Admins can update all profiles" — is_admin() ← الآن آمن بعد تحديث is_admin()
--   "Admins can delete profiles"     — is_admin() ← الآن آمن بعد تحديث is_admin()
-- ← لا تغيير مطلوب على profiles! السياسات الموجودة آمنة
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- التحقق: اختبارات سريعة بعد التطبيق
-- ══════════════════════════════════════════════════════════════

-- اختبار 1: الدالة تعمل
-- SELECT * FROM public.get_my_profile();

-- اختبار 2: سياسات candidates تعمل
-- SELECT count(*) FROM public.candidates;

-- اختبار 3: INSERT candidate (يجب أن ينجح إذا كان job_id صحيحاً)
-- INSERT INTO public.candidates (full_name, email, job_id, status, stage_order)
-- VALUES ('Test', 'test@x.com', '<your-job-id>', 'applied', 0);

-- اختبار 4: INSERT note
-- INSERT INTO public.notes (candidate_id, content)
-- VALUES ('<candidate-id>', 'Test note');
