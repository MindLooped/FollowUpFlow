import { useEffect, useMemo, useState } from 'react'
import { Activity as ActivityIcon, AlertTriangle, CalendarClock, CheckCircle2, FileText, Search, UserPlus, Users } from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { apiRequest } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { Activity } from '../lib/types'

const actionMeta: Record<string, { label: string; icon: typeof FileText; className: string }> = {
  client_created: { label: 'Client created', icon: UserPlus, className: 'bg-indigo-50 text-indigo-600' },
  client_updated: { label: 'Client updated', icon: Users, className: 'bg-violet-50 text-violet-600' },
  client_deleted: { label: 'Client deleted', icon: Users, className: 'bg-rose-50 text-rose-600' },
  followup_created: { label: 'Follow-up created', icon: CalendarClock, className: 'bg-sky-50 text-sky-600' },
  followup_updated: { label: 'Follow-up updated', icon: FileText, className: 'bg-amber-50 text-amber-600' },
  followup_completed: { label: 'Follow-up completed', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' },
  followup_deleted: { label: 'Follow-up deleted', icon: AlertTriangle, className: 'bg-rose-50 text-rose-600' },
}

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([])
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    setLoading(true)
    apiRequest<Activity[]>('/activity?limit=200')
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesAction = action === 'all' || item.action === action
      const matchesSearch = !term || `${item.description} ${item.client_name || ''} ${item.followup_title || ''}`.toLowerCase().includes(term)
      return matchesAction && matchesSearch
    })
  }, [items, search, action])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Activity</h2>
        <p className="mt-1 text-sm text-slate-500">A complete history of changes, including actions Claude takes through MCP.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search activity…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select className="input sm:w-56" value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filter activity type">
            <option value="all">All activity</option>
            {Object.entries(actionMeta).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
          </select>
        </div>

        {error ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Could not load activity" description={error} action={<button className="btn-primary" onClick={load}>Try again</button>} />
        ) : loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ActivityIcon className="h-6 w-6" />} title="No activity yet" description="Create or update a client or follow-up to build your timeline." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const meta = actionMeta[item.action] || { label: item.action, icon: FileText, className: 'bg-slate-100 text-slate-600' }
              const Icon = meta.icon
              return (
                <li key={item.id} className="flex gap-4 px-5 py-4 transition hover:bg-slate-50/60">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.className}`}><Icon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                      {item.client_name && <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">{item.client_name}</Badge>}
                      {item.followup_title && <Badge className="bg-slate-100 text-slate-600 ring-slate-200">{item.followup_title}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
