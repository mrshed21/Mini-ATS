'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'
import { ActivityLog } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import {
  Activity, Shield, User, ArrowRight, Search, Filter,
  Briefcase, Users, FileText, Link2, UserCog, LogIn,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

// ─── helpers ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  stage_change: 'Stage Changed',
  note_added: 'Note Added',
  group_assigned: 'Job Linked to Group',
  job_reassigned: 'Job Reassigned',
  impersonation_start: 'Logged in as',
  impersonation_end: 'Session Ended',
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  job: <Briefcase className="w-3.5 h-3.5" />,
  candidate: <Users className="w-3.5 h-3.5" />,
  note: <FileText className="w-3.5 h-3.5" />,
  group: <Shield className="w-3.5 h-3.5" />,
  job_access: <Link2 className="w-3.5 h-3.5" />,
  profile: <UserCog className="w-3.5 h-3.5" />,
  session: <LogIn className="w-3.5 h-3.5" />,
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  update: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-500 border-red-500/20',
  stage_change: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  note_added: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  group_assigned: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  job_reassigned: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  impersonation_start: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  impersonation_end: 'bg-muted text-muted-foreground border-border',
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function formatFullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ActivityRow({ log }: { log: ActivityLog }) {
  const actionColor = ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground border-border'
  const entityIcon = ENTITY_ICONS[log.entity_type] || <Activity className="w-3.5 h-3.5" />
  const actionLabel = ACTION_LABELS[log.action] || log.action

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-muted/10 transition-colors group border-b border-border/40 last:border-0">
      {/* Icon */}
      <div className={`mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${actionColor}`}>
        {entityIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {/* Actor */}
          <span className="font-semibold text-sm text-foreground">{log.actor_name}</span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            log.actor_role === 'admin'
              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              : log.actor_role === 'company_admin'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
          }`}>
            {log.actor_role === 'admin' && <Shield className="w-2.5 h-2.5" />}
            {log.actor_role === 'company_admin' ? 'Manager' : log.actor_role}
          </span>

          {/* Impersonation */}
          {log.on_behalf_of_name && (
            <>
              <span className="text-xs text-muted-foreground">as</span>
              <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
                <User className="w-3 h-3" />
                {log.on_behalf_of_name}
              </span>
            </>
          )}

          {/* Action */}
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${actionColor}`}>
            {actionLabel}
          </span>

          {/* Entity */}
          {log.entity_name && (
            <>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{log.entity_name}</span>
            </>
          )}
        </div>

        {/* Stage change detail */}
        {log.action === 'stage_change' && log.old_value && log.new_value && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
              {String(log.old_value.status || log.old_value.stage || '')}
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-foreground px-2 py-0.5 bg-muted/70 rounded font-medium">
              {String(log.new_value.status || log.new_value.stage || '')}
            </span>
          </div>
        )}

        {/* General new_value note */}
        {log.action !== 'stage_change' && log.new_value && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {Object.entries(log.new_value)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground" title={formatFullTime(log.created_at)}>
          {formatRelativeTime(log.created_at)}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 capitalize">{log.entity_type}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ActivityPageProps {
  /** إذا null → company_admin mode (مقيّد بشركته) | إذا 'all' → admin mode (كل الشركات) */
  scope: 'company' | 'all'
}

export default function ActivityLogPage({ scope }: ActivityPageProps) {
  const { companyId } = useAuth()
  const supabase = createClient()

  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (scope === 'company' && companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data } = await query
    setLogs(data || [])
    setLoading(false)
  }, [scope, companyId])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const filtered = logs.filter(log => {
    const matchSearch = !search ||
      log.actor_name.toLowerCase().includes(search.toLowerCase()) ||
      (log.entity_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.on_behalf_of_name || '').toLowerCase().includes(search.toLowerCase())
    const matchAction = filterAction === 'all' || log.action === filterAction
    return matchSearch && matchAction
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {scope === 'all'
            ? 'Full audit trail — all actions across all companies.'
            : 'All decisions and actions within your company.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or entity..."
            className="pl-9 bg-muted/50"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="flex h-10 w-full sm:w-52 rounded-md border border-input bg-muted/50 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none"
          >
            <option value="all">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <CardContent className="py-24 text-center">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium">No activity yet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Actions taken by your team will appear here.
            </p>
          </CardContent>
        ) : (
          <div>
            {filtered.map(log => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
