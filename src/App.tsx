import { useEffect, useState } from 'react'
import { CalendarClock, PlugZap } from 'lucide-react'
import Header from './components/Header'
import { NAV_ITEMS, pageFromHash, type PageId } from './components/Sidebar'
import { ToastProvider, useToast } from './components/Toast'
import { apiRequest } from './lib/api'
import type { ServerSettings } from './lib/types'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import FollowUps from './pages/FollowUps'
import Activity from './pages/Activity'
import Settings from './pages/Settings'

function Shell() {
  const [page, setPage] = useState<PageId>(() => pageFromHash(window.location.hash))
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [settings, setSettings] = useState<ServerSettings | null>(null)
  const { notify } = useToast()

  useEffect(() => {
    const sync = () => setPage(pageFromHash(window.location.hash))
    window.addEventListener('hashchange', sync)
    if (!window.location.hash) window.location.hash = '#/dashboard'
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    let active = true
    apiRequest<ServerSettings>('/settings')
      .then((data) => { if (active) setSettings(data) })
      .catch(() => { /* Pages surface connection errors with actionable messages. */ })
    return () => { active = false }
  }, [refreshKey])

  const refresh = () => {
    setRefreshing(true)
    setRefreshKey((current) => current + 1)
    window.setTimeout(() => setRefreshing(false), 700)
    notify('Data refreshed', 'info')
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-4 py-6 lg:flex">
        <a href="#/dashboard" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-slate-900">FollowUpFlow</p>
            <p className="text-[11px] font-medium text-slate-400">Client relationships, on track</p>
          </div>
        </a>

        <nav className="mt-9 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = item.id === page
            return (
              <a
                key={item.id}
                href={`#/${item.id}`}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />}
              </a>
            )
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
              <PlugZap className="h-4 w-4" /> Claude + MCP
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Ask Claude to add clients and follow-ups. Records appear here instantly — no AI code runs inside the app.
            </p>
            <a href="#/settings" className="mt-3 inline-block text-xs font-bold text-indigo-600 hover:text-indigo-800">View connection setup →</a>
          </div>
          <p className="px-2 text-[11px] text-slate-400">FollowUpFlow MVP · {settings?.database === 'sqlite' ? 'Local database' : 'Supabase PostgreSQL'}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <Header page={page} onRefresh={refresh} refreshing={refreshing} authRequired={settings?.auth_required} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {page === 'dashboard' && <Dashboard key={refreshKey} />}
          {page === 'clients' && <Clients key={refreshKey} />}
          {page === 'followups' && <FollowUps key={refreshKey} />}
          {page === 'activity' && <Activity key={refreshKey} />}
          {page === 'settings' && <Settings settings={settings} />}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return <ToastProvider><Shell /></ToastProvider>
}
