import { useEffect, useState, type FormEvent } from 'react'
import type { Client, ClientInput } from '../lib/types'

interface ClientFormProps {
  initial: Client | null
  onSubmit: (values: ClientInput) => Promise<void> | void
  onCancel: () => void
  saving: boolean
}

export default function ClientForm({ initial, onSubmit, onCancel, saving }: ClientFormProps) {
  const [values, setValues] = useState<ClientInput>({
    name: '', company: '', email: '', phone: '', project_details: '', notes: '',
  })

  useEffect(() => {
    setValues(initial ? {
      name: initial.name,
      company: initial.company || '',
      email: initial.email || '',
      phone: initial.phone || '',
      project_details: initial.project_details || '',
      notes: initial.notes || '',
    } : { name: '', company: '', email: '', phone: '', project_details: '', notes: '' })
  }, [initial])

  const set = (field: keyof ClientInput, value: string) => setValues((current) => ({ ...current, [field]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!values.name.trim()) return
    void onSubmit(values)
  }

  return (
    <form id="client-form" onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="client-name">Client name *</label>
          <input id="client-name" className="input" value={values.name} onChange={(event) => set('name', event.target.value)} placeholder="Rahul Sharma" maxLength={120} required />
        </div>
        <div>
          <label className="label" htmlFor="client-company">Company</label>
          <input id="client-company" className="input" value={values.company || ''} onChange={(event) => set('company', event.target.value)} placeholder="ABC Technologies" maxLength={120} />
        </div>
        <div>
          <label className="label" htmlFor="client-email">Email</label>
          <input id="client-email" type="email" className="input" value={values.email || ''} onChange={(event) => set('email', event.target.value)} placeholder="rahul@example.com" maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="client-phone">Phone</label>
          <input id="client-phone" className="input" value={values.phone || ''} onChange={(event) => set('phone', event.target.value)} placeholder="+91 98765 43210" maxLength={50} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="client-project">Project details</label>
        <textarea id="client-project" className="input min-h-[96px] resize-y" value={values.project_details || ''} onChange={(event) => set('project_details', event.target.value)} placeholder="Website development worth Rs. 50,000" maxLength={2000} />
      </div>
      <div>
        <label className="label" htmlFor="client-notes">Notes</label>
        <textarea id="client-notes" className="input min-h-[80px] resize-y" value={values.notes || ''} onChange={(event) => set('notes', event.target.value)} placeholder="Preferences, decision makers, next steps…" maxLength={2000} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving || !values.name.trim()}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add client'}
        </button>
      </div>
    </form>
  )
}
