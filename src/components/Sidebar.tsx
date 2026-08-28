import { Link, useLocation } from 'react-router-dom'
import { BarChart3, CalendarDays, Grid3X3, LayoutDashboard, List, MessageSquareText, UsersRound } from 'lucide-react'
import logoSrc from '../assets/logo.png'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chamados', label: 'Chamados', icon: List },
  { to: '/clientes', label: 'Clientes', icon: UsersRound },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/kanban', label: 'Kanban', icon: Grid3X3 },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/usuarios', label: 'Usuários', icon: UsersRound },
  { to: '/?whatsapp=1', label: 'WhatsApp', icon: MessageSquareText },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-gray-950/30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link to="/" onClick={onClose} className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-gray-950">CS/CX Safe Horse</h1>
            <p className="text-xs text-gray-400">Sucesso do Cliente 2026</p>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(item => {
            const path = item.to.split('?')[0]
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
