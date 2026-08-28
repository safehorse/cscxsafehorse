import { useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { ExportRelatorioModal } from '../components/ExportRelatorioModal'
import { Layout } from '../components/Layout'

export function RelatoriosPage() {
  const [showExport, setShowExport] = useState(false)

  return (
    <Layout>
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <div className="mb-5">
          <h1 className="text-sm font-bold text-gray-950">Relatórios</h1>
          <p className="text-xs text-gray-400">Exporte dados dos chamados para acompanhamento</p>
        </div>

        <button
          type="button"
          onClick={() => setShowExport(true)}
          className="flex w-full max-w-sm items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
        >
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-950">Relatório de chamados</p>
            <p className="mt-0.5 text-sm text-gray-500">Filtre por período, status e responsável e exporte em Excel</p>
          </div>
          <Download size={18} className="shrink-0 text-gray-300" />
        </button>
      </div>

      {showExport && <ExportRelatorioModal onClose={() => setShowExport(false)} />}
    </Layout>
  )
}
