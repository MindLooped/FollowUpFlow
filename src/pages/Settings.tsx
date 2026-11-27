import { useState, type ReactNode } from 'react'
import { Check, Copy, Database, Eye, EyeOff, KeyRound, Lock, PlugZap, ShieldCheck, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import { apiBaseUrl, getAccessToken, setAccessToken } from '../lib/api'
import type { ServerSettings } from '../lib/types'

export default function Settings({ settings }: { settings: ServerSettings | null }) {
  const [token, setToken] = useState(getAccessToken() || '')
  const [draft, setDraft] = useState(token)
  const [visible, setVisible] = useState(false)
  const { notify } = useToast()

  const mcpUrl = `${apiBaseUrl.replace(/\/api$/, '')}/mcp`
  const snippet = JSON.stringify({
    mcpServers: {
      followupflow: {
        type: 'http',
        url: mcpUrl,
        headers: settings?.auth_required ? { Authorization: `Bearer ${draft || '<APP_ACCESS_TOKEN>'}` } : {},
      },
    },
  }, null, 2)

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify(`${label} copied to clipboard`)
    } catch {
      notify('Clipboard access is unavailable in this browser', 'error')
    }
  }

  const save = () => {
    setAccessToken(draft.trim() || null)
    setToken(draft.trim())
    notify(draft.trim() ? 'Access token saved in this browser' : 'Access token removed')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Connection details, access control and Claude MCP setup.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Database className="h-5 w-5" /></span>
            <div><h3 className="text-sm font-bold text-slate-900">Application status</h3><p className="text-xs text-slate-500">Live configuration from the Flask backend</p></div>
          </div>
          <dl className="mt-5 divide-y divide-slate-100 text-sm">
            <StatusRow label="Database" value={settings?.database === 'sqlite' ? 'SQLite (local demo)' : settings?.database || 'Loading…'} icon={<Database className="h-4 w-4" />} />
            <StatusRow label="Authentication" value={settings?.auth_required ? 'Bearer token required' : 'Demo mode (open access)'} icon={<Lock className="h-4 w-4" />} />
            <StatusRow label="REST API" value={apiBaseUrl} icon={<PlugZap className="h-4 w-4" />} />
            <StatusRow label="MCP endpoint" value={mcpUrl} icon={<PlugZap className="h-4 w-4" />} />
          </dl>
          <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">
            FollowUpFlow contains no AI SDK, chat widget or model API calls. Claude is the only AI actor; it talks to the app exclusively through the MCP tools.
          </p>
        </section>

        <section className="card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><KeyRound className="h-5 w-5" /></span>
            <div><h3 className="text-sm font-bold text-slate-900">Access token</h3><p className="text-xs text-slate-500">Used by this browser to call the protected API</p></div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input className="input pr-10" type={visible ? 'text' : 'password'} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={settings?.auth_required ? 'Paste APP_ACCESS_TOKEN' : 'Not required in demo mode'} autoComplete="off" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide token' : 'Show token'}>
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button className="btn-primary" onClick={save}><Check className="h-4 w-4" /> Save</button>
            <button className="btn-secondary" onClick={() => { setDraft(''); setAccessToken(null); setToken(''); notify('Access token removed') }} disabled={!token && !draft}>
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            The token is stored only in this browser's localStorage and sent as <code className="rounded bg-slate-100 px-1 py-0.5">Authorization: Bearer …</code>. In demo mode it can be left empty.
          </p>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-indigo-600" /> Connect Claude through MCP</h3>
            <p className="mt-1 text-xs text-slate-500">Add this to Claude Desktop's <code className="rounded bg-slate-100 px-1 py-0.5">claude_desktop_config.json</code>, then restart Claude.</p>
          </div>
          <button className="btn-secondary self-start" onClick={() => void copy(snippet, 'MCP config')}><Copy className="h-4 w-4" /> Copy config</button>
        </div>
        <div className="p-6">
          <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">{snippet}</pre>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Deploy the MCP service on Render and set <code className="rounded bg-slate-100 px-1 py-0.5">MCP_ALLOWED_HOSTS</code> to its hostname.</li>
            <li>Set the same <code className="rounded bg-slate-100 px-1 py-0.5">APP_ACCESS_TOKEN</code> on the API and MCP services.</li>
            <li>Ask Claude: “Add Rahul from ABC Technologies, website project worth Rs. 50,000, and follow up in three days.”</li>
            <li>Claude calls <code className="rounded bg-slate-100 px-1 py-0.5">create_client</code> then <code className="rounded bg-slate-100 px-1 py-0.5">create_followup</code>; refresh any page to see the records.</li>
          </ol>
        </div>
      </section>
    </div>
  )
}

function StatusRow({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium text-slate-800" title={value}>{value}</dd>
    </div>
  )
}
