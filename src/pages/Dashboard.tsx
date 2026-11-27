import { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowRight, BellRing, CalendarClock, Check, CheckCircle2,
  Clock3, FileText, Plus, UserPlus, Users,
} from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import StatCard from '../components/StatCard'
import { useToast } from '../components/Toast'
import { apiRequest } from '../lib/api'
import { avatarColor, formatDateTime, initials, priorityClass, relativeDate, statusClass } from '../lib/format'
import type { Activity, DashboardStats } from '../lib/types'

const activityIcons: Record<string, { icon: typeof Plus; className: string }> = {
  client_created: { icon: UserPlus, className: 'bg-indigo-50 text-indigo-600' },
  client_updated: { icon: Users, className: 'bg-violet-50 text-violet-600' },
  client_deleted: { icon: Users, className: 'bg-rose-50 text-rose-600' },
  followup_created: { icon: CalendarClock, className: 'bg-sky-50 text-sky-600' },
  followup_updated: { icon: FileText, className: 'bg-amber-50 text-amber-600' },
  followup_completed: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' },
  followup_deleted: { icon: AlertTriangle, className: 'bg-rose-50 text-rose-600' },
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState<string | null>(null)
  const { notify } = useToast()

  const load = () => {
    setError('')
    apiRequest<DashboardStats>('/dashboard')
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }

  useEffect(load, [])

  const complete = async (id: string) => {
    setCompleting(id)
    try {
      await apiRequest(`/followups/${id}/complete`, { method: 'POST' })
      notify('Follow-up marked as completed')
      load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setCompleting(null)
    }
  }

  if (error) {
    return <div className="card p-6"><EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Could not load dashboard" description={error} action={<button className="btn-primary" onClick={load}>Try again</button>} /></div>
  }

  if (!data) return <DashboardSkeleton />

  const total = data.total_followups || 1
  const pipeline = [
    { label: 'Pending', value: data.pending_followups, className: 'bg-indigo-500' },
    { label: 'Overdue', value: data.overdue_followups, className: 'bg-rose-500' },
    { label: 'Completed', value: data.completed_followups, className: 'bg-emerald-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Good to see you.</h2>
          <p className="mt-1 text-sm text-slate-500">Here's what needs your attention today.</p>
        </div>
        <a href="#/followups" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          Open all follow-ups <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total clients" value={data.total_clients} hint="Relationships you manage" icon={<Users className="h-5 w-5" />} tone="indigo" />
        <StatCard label="Pending" value={data.pending_followups} hint="Scheduled and on track" icon={<Clock3 className="h-5 w-5" />} tone="violet" />
        <StatCard label="Completed" value={data.completed_followups} hint="Conversations closed" icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Overdue" value={data.overdue_followups} hint="Need immediate attention" icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
        <StatCard label="Next 7 days" value={data.upcoming_reminders} hint="Upcoming reminders" icon={<BellRing className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upcoming follow-ups</h3>
              <p className="mt-0.5 text-xs text-slate-500">Your next conversations, ordered by due date</p>
            </div>
            <a href="#/followups" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">View all</a>
          </div>
          {data.upcoming_followups.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nothing due soon" description="Create a follow-up or ask Claude to schedule one for you." action={<a href="#/followups" className="btn-primary"><Plus className="h-4 w-4" /> New follow-up</a>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcoming_followups.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/60">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(item.client_name)}`}>{initials(item.client_name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <Badge className={priorityClass[item.priority]}>{item.priority}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.client_name}{item.company ? ` · ${item.company}` : ''}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className={`text-xs font-semibold ${item.effective_status === 'overdue' ? 'text-rose-600' : 'text-indigo-600'}`}>{relativeDate(item.due_date)}</p>
                    <p className="text-[11px] text-slate-400">{item.due_date}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                    onClick={() => void complete(item.id)}
                    disabled={completing === item.id}
                    aria-label={`Complete ${item.title}`}
                    title="Mark as completed"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="text-sm font-bold text-slate-900">Follow-up pipeline</h3>
            <p className="mt-0.5 text-xs text-slate-500">{data.total_followups} total follow-ups</p>
            <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              {pipeline.map((segment) => <div key={segment.label} className={segment.className} style={{ width: `${(segment.value / total) * 100}%` }} />)}
            </div>
            <div className="mt-4 space-y-2">
              {pipeline.map((segment) => (
                <div key={segment.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600"><span className={`h-2 w-2 rounded-full ${segment.className}`} />{segment.label}</span>
                  <span className="font-bold text-slate-900">{segment.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
              <p className="mt-0.5 text-xs text-slate-500">Manual edits and Claude actions</p>
            </div>
            {data.recent_activity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No activity yet. Add a client to get started.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recent_activity.slice(0, 5).map((item) => <ActivityRow key={item.id} item={item} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ item }: { item: Activity }) {
  const meta = activityIcons[item.action] || { icon: FileText, className: 'bg-slate-100 text-slate-600' }
  const Icon = meta.icon
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.className}`}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">{item.description}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(item.created_at)}</p>
      </div>
      {item.followup_title && <Badge className={statusClass.pending}>Follow-up</Badge>}
    </li>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-64 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="card h-36 animate-pulse bg-white" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="card h-80 animate-pulse" />
        <div className="card h-80 animate-pulse" />
      </div>
    </div>
  )
}
