import type { LucideIcon } from 'lucide-react'
import { Activity, CalendarClock, LayoutDashboard, Settings, Users } from 'lucide-react'

export type PageId = 'dashboard' | 'clients' | 'followups' | 'activity' | 'settings'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview of your pipeline' },
  { id: 'clients', label: 'Clients', icon: Users, description: 'People and companies' },
  { id: 'followups', label: 'Follow-ups', icon: CalendarClock, description: 'Every next conversation' },
  { id: 'activity', label: 'Activity', icon: Activity, description: 'Chronological history' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Connection and access' },
]

export function pageFromHash(hash: string): PageId {
  const value = hash.replace(/^#\/?/, '').split('/')[0]
  return NAV_ITEMS.some((item) => item.id === value) ? value as PageId : 'dashboard'
}
