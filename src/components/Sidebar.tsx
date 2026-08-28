import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, CalendarDays, Grid3X3, LayoutDashboard, List, PanelLeftClose, PanelLeftOpen, UsersRound } from 'lucide-react'
import logoSrc from '../assets/logo.png'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chamados', label: 'Chamados', icon: List },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/kanban', label: 'Kanban', icon: Grid3X3 },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/usuarios', label: 'Usuários', icon: UsersRound },
]

const STORAGE_KEY = 'cscx-sidebar-collapsed'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // preferencia nao sera lembrada
    }
  }, [collapsed])

  function isActive(to: string) {
    const path = to.split('?')[0]
    return path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  }

  function itemClasses(active: boolean) {
    return `flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
      active ? 'bg-blue-50 font-bold text-blue-700' : 'font-medium text-gray-500'
    } ${collapsed ? 'lg:justify-start lg:pl-3.5' : ''}`
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-gray-950/30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-4 transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-64 lg:w-[76px]' : 'w-64 lg:w-[224px]'}`}
      >
        <Link to="/" onClick={onClose} className="mb-4 flex h-[42px] shrink-0 items-center overflow-hidden px-2">
          <img
            src={logoSrc}
            alt="Safe Horse"
            className={`h-[34px] w-[126px] shrink-0 object-contain object-left ${collapsed ? 'lg:hidden' : ''}`}
          />
          <img
            src="/favicon.png"
            alt="Safe Horse"
            className={`hidden h-[34px] w-[34px] shrink-0 object-contain ${collapsed ? 'lg:block' : ''}`}
          />
        </Link>

        <nav className="flex flex-col gap-1 overflow-y-auto">
          {NAV_LINKS.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={itemClasses(isActive(item.to))}
              >
                <Icon size={18} className="shrink-0" />
                <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`mt-auto border border-gray-200 bg-white ${itemClasses(false)}`}
        >
          {collapsed ? <PanelLeftOpen size={18} className="shrink-0" /> : <PanelLeftClose size={18} className="shrink-0" />}
          <span className={collapsed ? 'lg:hidden' : ''}>{collapsed ? 'Expandir' : 'Recolher'}</span>
        </button>
      </aside>
    </>
  )
}
