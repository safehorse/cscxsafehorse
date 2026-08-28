import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { ExportRelatorioModal } from './ExportRelatorioModal'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showRelatorio, setShowRelatorio] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenRelatorio={() => setShowRelatorio(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 lg:hidden"
              title="Abrir menu"
            >
              <Menu size={17} />
            </button>
            <div className="flex-1" />
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {showRelatorio && <ExportRelatorioModal onClose={() => setShowRelatorio(false)} />}
    </div>
  )
}
