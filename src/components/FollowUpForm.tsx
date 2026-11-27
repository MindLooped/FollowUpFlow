import { useEffect, useState, type FormEvent } from 'react'
import { todayISO } from '../lib/format'
import type { Client, FollowUp, FollowUpInput, Priority } from '../lib/types'

interface FollowUpFormProps {
  clients: Client[]
  initial: FollowUp | null
  defaultClientId?: string
  onSubmit: (values: FollowUpInput) => Promise<void> | void
  onCancel: () => void
  saving: boolean
}

export default function FollowUpForm({ clients, initial, defaultClientId, onSubmit, onCancel, saving }: FollowUpFormProps) {
  const [values, setValues] = useState<FollowUpInput>({
    client_id: defaultClientId || clients[0]?.id || '',
    title: '',
    description: '',
    due_date: todayISO(),
    priority: 'medium',
    status: 'pending',
  })

  useEffect(() => {
    if (initial) {
      setValues({
        client_id: initial.client_id,
        title: initial.title,
        description: initial.description || '',
        due_date: initial.due_date,
        priority: initial.priority,
        status: initial.status,
      })
    } else {
      setValues({
        client_id: defaultClientId || clients[0]?.id || '',
        title: '', description: '', due_date: todayISO(), priority: 'medium', status: 'pending',
      })
    }
  }, [initial, defaultClientId, clients])

  const set = <K extends keyof FollowUpInput>(field: K, value: FollowUpInput[K]) =>
    setValues((current) => ({ ...current, [field]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!values.title.trim() || !values.client_id || !values.due_date) return
    void onSubmit(values)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="followup-client">Client *</label>
        <select id="followup-client" className="input" value={values.client_id} onChange={(event) => set('client_id', event.target.value)} required>
          <option value="" disabled>Select a client</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` — ${client.company}` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="followup-title">Follow-up title *</label>
        <input id="followup-title" className="input" value={values.title} onChange={(event) => set('title', event.target.value)} placeholder="Send proposal for website development" maxLength={200} required />
      </div>
      <div>
        <label className="label" htmlFor="followup-description">Description</label>
        <textarea id="followup-description" className="input min-h-[96px] resize-y" value={values.description || ''} onChange={(event) => set('description', event.target.value)} placeholder="Agenda, context, or talking points…" maxLength={2000} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="followup-date">Due date *</label>
          <input id="followup-date" type="date" className="input" value={values.due_date} onChange={(event) => set('due_date', event.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="followup-priority">Priority</label>
          <select id="followup-priority" className="input" value={values.priority} onChange={(event) => set('priority', event.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="followup-status">Status</label>
          <select id="followup-status" className="input" value={values.status} onChange={(event) => set('status', event.target.value as 'pending' | 'completed')}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving || !values.title.trim() || !values.client_id || !values.due_date}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create follow-up'}
        </button>
      </div>
    </form>
  )
}
