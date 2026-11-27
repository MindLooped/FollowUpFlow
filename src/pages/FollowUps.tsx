import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import Badge from '../components/Badge'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import FollowUpForm from '../components/FollowUpForm'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { apiRequest } from '../lib/api'
import { avatarColor, formatDate, initials, priorityClass, relativeDate, statusClass } from '../lib/format'
import type { Client, FollowUp, FollowUpInput, FollowUpStatus, FollowUpUpdate } from '../lib/types'

type StatusFilter = 'all' | FollowUpStatus

export default function FollowUps() {
  const [items, setItems] = useState<FollowUp[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<StatusFilter>('all')
  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FollowUp | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<FollowUp | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { notify } = useToast()

  useEffect(() => {
    apiRequest<Client[]>('/clients').then(setClients).catch(() => undefined)
  }, [])

  const load = () => {
    setError('')
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (clientId) params.set('client_id', clientId)
    if (search) params.set('q', search)
    apiRequest<FollowUp[]>(`/followups?${params.toString()}`)
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(load, status === 'all' && !clientId ? 0 : 200)
    return () => window.clearTimeout(timer)
  }, [status, clientId, search])

  const save = async (values: FollowUpInput) => {
    setSaving(true)
    try {
      if (editing) {
        await apiRequest(`/followups/${editing.id}`, { method: 'PATCH', body: JSON.stringify(values as FollowUpUpdate) })
        notify('Follow-up updated')
      } else {
        await apiRequest('/followups', { method: 'POST', body: JSON.stringify(values) })
        notify('Follow-up created')
      }
      setFormOpen(false)
      setEditing(null)
      load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const complete = async (item: FollowUp) => {
    setBusyId(item.id)
    try {
      await apiRequest(`/followups/${item.id}/complete`, { method: 'POST' })
      notify('Follow-up completed')
      load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await apiRequest(`/followups/${deleting.id}`, { method: 'DELETE' })
      notify('Follow-up deleted')
      setDeleting(null)
      load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const counts = {
    all: items.length,
    pending: items.filter((item) => item.effective_status === 'pending').length,
    completed: items.filter((item) => item.effective_status === 'completed').length,
    overdue: items.filter((item) => item.effective_status === 'overdue').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Follow-ups</h2>
          <p className="mt-1 text-sm text-slate-500">Schedule, reschedule and close every client conversation.</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true) }} disabled={clients.length === 0} title={clients.length === 0 ? 'Add a client first' : undefined}>
          <Plus className="h-4 w-4" /> New follow-up
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'pending', 'overdue', 'completed'] as StatusFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${status === value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {value} <span className={status === value ? 'text-indigo-200' : 'text-slate-400'}>{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" placeholder="Search follow-ups…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select className="input sm:w-52" value={clientId} onChange={(event) => setClientId(event.target.value)} aria-label="Filter by client">
              <option value="">All clients</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
        </div>

        {error ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Could not load follow-ups" description={error} action={<button className="btn-primary" onClick={load}>Try again</button>} />
        ) : loading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No follow-ups found" description={status !== 'all' || search || clientId ? 'Try clearing a filter to see more results.' : 'Create a follow-up manually or let Claude schedule one for you.'} action={status === 'all' && !search && !clientId && <button className="btn-primary" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> New follow-up</button>} />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="table-th">Follow-up</th>
                  <th className="table-th">Client</th>
                  <th className="table-th">Due</th>
                  <th className="table-th">Priority</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50/60">
                    <td className="table-td">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 line-clamp-1 max-w-[300px] text-xs text-slate-500">{item.description || 'No description'}</p>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ${avatarColor(item.client_name)}`}>{initials(item.client_name)}</span>
                        <div><p className="text-sm font-medium text-slate-800">{item.client_name}</p><p className="text-xs text-slate-500">{item.company}</p></div>
                      </div>
                    </td>
                    <td className="table-td">
                      <p className={`text-sm font-semibold ${item.effective_status === 'overdue' ? 'text-rose-600' : 'text-slate-700'}`}>{relativeDate(item.due_date)}</p>
                      <p className="text-xs text-slate-400">{formatDate(item.due_date, true)}</p>
                    </td>
                    <td className="table-td"><Badge className={priorityClass[item.priority]}>{item.priority}</Badge></td>
                    <td className="table-td"><Badge className={statusClass[item.effective_status]}>{item.effective_status}</Badge></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        {item.status !== 'completed' && (
                          <button className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50" onClick={() => void complete(item)} disabled={busyId === item.id} title="Mark completed" aria-label={`Complete ${item.title}`}><Check className="h-4 w-4" /></button>
                        )}
                        <button className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" onClick={() => { setEditing(item); setFormOpen(true) }} title="Edit follow-up" aria-label={`Edit ${item.title}`}><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleting(item)} title="Delete follow-up" aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit follow-up' : 'New follow-up'} description={editing ? 'Reschedule or update this follow-up.' : 'Set the next client interaction and its priority.'}>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-600">Add a client before creating a follow-up.</p>
        ) : (
          <FollowUpForm clients={clients} initial={editing} onSubmit={save} onCancel={() => setFormOpen(false)} saving={saving} />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete follow-up?"
        message={`“${deleting?.title || 'This follow-up'}” will be permanently removed.`}
        loading={deleteLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
