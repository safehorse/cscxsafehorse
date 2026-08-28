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
    return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
    } ${collapsed ? 'lg:justify-center' : ''}`
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-gray-950/30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-64 lg:w-20' : 'w-64'}`}
      >
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <Link to="/" onClick={onClose} className={itemClasses(false)}>
            <img src={logoSrc} alt="Safe Horse" className="h-7 shrink-0 object-contain" />
          </Link>

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
                <Icon size={17} className="shrink-0" />
                <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-3">
          <button
            type="button"
            onClick={() => setCollapsed(prev => !prev)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={`w-full ${itemClasses(false)}`}
          >
            {collapsed ? <PanelLeftOpen size={17} className="shrink-0" /> : <PanelLeftClose size={17} className="shrink-0" />}
            <span className={collapsed ? 'lg:hidden' : ''}>Recolher menu</span>
          </button>
        </div>
      </aside>
    </>
  )
}
