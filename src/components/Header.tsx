import { ArrowUpRight, Check, PlugZap, RefreshCw } from 'lucide-react'
import { NAV_ITEMS, type PageId } from './Sidebar'

interface HeaderProps {
  page: PageId
  onRefresh?: () => void
  refreshing?: boolean
  authRequired?: boolean
}

export default function Header({ page, onRefresh, refreshing, authRequired }: HeaderProps) {
  const item = NAV_ITEMS.find((nav) => nav.id === page) || NAV_ITEMS[0]

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-500">
            FollowUpFlow <span className="text-slate-300">/</span> {item.label}
          </div>
          <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{item.label}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex" title="Claude connects to this app through MCP; no AI APIs run inside the app.">
            <PlugZap className="h-3.5 w-3.5" /> MCP ready
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 md:inline-flex">
            <Check className="h-3.5 w-3.5 text-indigo-500" /> {authRequired ? 'Protected' : 'Demo mode'}
          </span>
          {onRefresh && (
            <button type="button" className="btn-secondary px-3 py-2" onClick={onRefresh} disabled={refreshing} aria-label="Refresh data">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          )}
          <a href="#/settings" className="hidden h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 sm:flex" aria-label="Open settings">
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
      <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
        {NAV_ITEMS.map((nav) => {
          const Icon = nav.icon
          const active = nav.id === page
          return (
            <a key={nav.id} href={`#/${nav.id}`} className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon className="h-3.5 w-3.5" /> {nav.label}
            </a>
          )
        })}
      </nav>
    </header>
  )
}
