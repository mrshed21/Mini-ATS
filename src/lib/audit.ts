/**
 * audit.ts — دالة مساعدة مركزية لتسجيل كل الإجراءات في activity_log
 *
 * الاستخدام:
 *   import { logActivity } from '@/lib/audit'
 *   await logActivity(supabase, { actor, action, entityType, ... })
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ActivityAction, EntityType } from '@/lib/types'

export interface LogActivityParams {
  supabase: SupabaseClient
  // المنفّذ الحقيقي
  actorId: string
  actorName: string
  actorRole: string
  // في حالة impersonation
  onBehalfOfId?: string | null
  onBehalfOfName?: string | null
  // الإجراء
  action: ActivityAction
  entityType: EntityType
  entityId?: string | null
  entityName?: string | null
  // التغيير (اختياري)
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  // الشركة
  companyId?: string | null
}

/**
 * يُسجّل إجراءً في جدول activity_log.
 * لا يُوقف تنفيذ الكود في حالة الفشل (silent).
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const {
    supabase,
    actorId,
    actorName,
    actorRole,
    onBehalfOfId,
    onBehalfOfName,
    action,
    entityType,
    entityId,
    entityName,
    oldValue,
    newValue,
    companyId,
  } = params

  try {
    await supabase.from('activity_log').insert([{
      actor_id: actorId,
      actor_name: actorName || 'Unknown',
      actor_role: actorRole,
      on_behalf_of_id: onBehalfOfId ?? null,
      on_behalf_of_name: onBehalfOfName ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      entity_name: entityName ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      company_id: companyId ?? null,
    }])
  } catch {
    // لا نوقف تدفق التطبيق إذا فشل التسجيل
    console.warn('[audit] Failed to log activity:', action, entityType)
  }
}

/**
 * نسخة مبسّطة: تجمع بيانات المستخدم تلقائياً من الـ Supabase session
 * + بيانات الـ impersonation من localStorage
 */
export async function logActivityAuto(
  supabase: SupabaseClient,
  opts: {
    action: ActivityAction
    entityType: EntityType
    entityId?: string | null
    entityName?: string | null
    oldValue?: Record<string, unknown> | null
    newValue?: Record<string, unknown> | null
    companyId?: string | null
    // impersonation (اختياري — مررها من useImpersonation)
    impersonating?: boolean
    impersonatorId?: string | null
    impersonatorName?: string | null
    impersonatedId?: string | null
    impersonatedName?: string | null
  }
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) return

    await logActivity({
      supabase,
      actorId: user.id,
      actorName: profile.full_name || user.email || 'Unknown',
      actorRole: profile.role,
      onBehalfOfId: opts.impersonating ? opts.impersonatedId : null,
      onBehalfOfName: opts.impersonating ? opts.impersonatedName : null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityName: opts.entityName,
      oldValue: opts.oldValue,
      newValue: opts.newValue,
      companyId: opts.companyId ?? profile.company_id,
    })
  } catch {
    console.warn('[audit] logActivityAuto failed')
  }
}
