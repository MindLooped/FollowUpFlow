import { useEffect, useState } from 'react'
import { AlertTriangle, Eye, Mail, Pencil, Phone, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import Badge from '../components/Badge'
import ClientForm from '../components/ClientForm'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { apiRequest } from '../lib/api'
import { avatarColor, formatDate, initials, priorityClass, relativeDate, statusClass } from '../lib/format'
import type { Client, ClientDetail, ClientInput } from '../lib/types'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { notify } = useToast()

  const load = () => {
    setError('')
    setLoading(true)
    apiRequest<Client[]>(`/clients?q=${encodeURIComponent(search)}`)
      .then(setClients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const save = async (values: ClientInput) => {
    setSaving(true)
    try {
      if (editing) {
        await apiRequest(`/clients/${editing.id}`, { method: 'PATCH', body: JSON.stringify(values) })
        notify('Client updated')
      } else {
        await apiRequest('/clients', { method: 'POST', body: JSON.stringify(values) })
        notify('Client added')
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

  const remove = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await apiRequest(`/clients/${deleting.id}`, { method: 'DELETE' })
      notify('Client and their follow-ups deleted')
      setDeleting(null)
      load()
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const view = async (client: Client) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await apiRequest<ClientDetail>(`/clients/${client.id}`))
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Clients</h2>
          <p className="mt-1 text-sm text-slate-500">Every relationship in one place. {clients.length} shown.</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <UserPlus className="h-4 w-4" /> Add client
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Search name, company, email…" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearch('')} aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </div>
          <span className="text-xs text-slate-500">Changes made by Claude appear here automatically.</span>
        </div>

        {error ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Could not load clients" description={error} action={<button className="btn-primary" onClick={load}>Try again</button>} />
        ) : loading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : clients.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title={search ? 'No matching clients' : 'No clients yet'} description={search ? 'Try a different search term.' : 'Add your first client manually or ask Claude to create one through MCP.'} action={!search && <button className="btn-primary" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add client</button>} />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="table-th">Client</th>
                  <th className="table-th">Contact</th>
                  <th className="table-th">Project</th>
                  <th className="table-th">Follow-ups</th>
                  <th className="table-th">Added</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-slate-50/60">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(client.name)}`}>{initials(client.name)}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{client.name}</p>
                          <p className="text-xs text-slate-500">{client.company || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <p className="flex items-center gap-1.5 text-xs text-slate-600"><Mail className="h-3.5 w-3.5 text-slate-400" /> {client.email || '—'}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3.5 w-3.5 text-slate-400" /> {client.phone || '—'}</p>
                    </td>
                    <td className="table-td"><p className="line-clamp-2 max-w-[240px] text-xs text-slate-600">{client.project_details || '—'}</p></td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-50 text-indigo-700 ring-indigo-200">{client.followup_count || 0} total</Badge>
                        {(client.pending_count || 0) > 0 && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{client.pending_count} open</Badge>}
                      </div>
                    </td>
                    <td className="table-td text-xs text-slate-500">{formatDate(client.created_at, true)}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-1">
                        <button className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" onClick={() => void view(client)} title="View details" aria-label={`View ${client.name}`}><Eye className="h-4 w-4" /></button>
                        <button className="rounded-lg p-2 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" onClick={() => { setEditing(client); setFormOpen(true) }} title="Edit client" aria-label={`Edit ${client.name}`}><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleting(client)} title="Delete client" aria-label={`Delete ${client.name}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit client' : 'Add a new client'} description={editing ? 'Update the details stored for this client.' : 'Capture the context you need for great follow-ups.'}>
        <ClientForm initial={editing} onSubmit={save} onCancel={() => setFormOpen(false)} saving={saving} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete client?"
        message={`This permanently removes ${deleting?.name || 'this client'} and all of their follow-ups. This action cannot be undone.`}
        loading={deleteLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />

      <Modal open={Boolean(detail) || detailLoading} onClose={() => setDetail(null)} title={detail?.name || 'Client details'} description={detail?.company || undefined} size="lg">
        {detailLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : detail && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Email" value={detail.email} />
              <DetailRow label="Phone" value={detail.phone} />
              <DetailRow label="Added" value={formatDate(detail.created_at, true)} />
              <DetailRow label="Last updated" value={formatDate(detail.updated_at, true)} />
            </div>
            <div>
              <p className="label">Project details</p>
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{detail.project_details || 'No project details recorded.'}</p>
            </div>
            <div>
              <p className="label">Notes</p>
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{detail.notes || 'No notes recorded.'}</p>
            </div>
            <div>
              <p className="label">Follow-ups ({detail.followups.length})</p>
              {detail.followups.length === 0 ? (
                <p className="text-sm text-slate-500">No follow-ups for this client yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {detail.followups.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                      <span className="flex-1 font-medium text-slate-800">{item.title}</span>
                      <Badge className={priorityClass[item.priority]}>{item.priority}</Badge>
                      <Badge className={statusClass[item.effective_status]}>{item.effective_status}</Badge>
                      <span className="text-xs text-slate-500">{relativeDate(item.due_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value || '—'}</p>
    </div>
  )
}
