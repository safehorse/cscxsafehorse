import { useMemo, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { BarChart3, CalendarDays, Download, LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { api, type AtendimentoFilters } from '../lib/api'
import type { Atendimento } from '../lib/types'

const STATUS_OPTIONS = ['ABERTO', 'PENDENTE', 'AGUARDANDO DEVOLUÇÃO', 'FINALIZADO', 'EM ANÁLISE', 'EM PRODUÇÃO', 'CRÉDITO GERADO', 'TROCA GERADA']

function formatDate(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('pt-BR')
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ExportRelatorioModal({ onClose }: { onClose: () => void }) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [year, setYear] = useState('')
  const [exporting, setExporting] = useState(false)
  const [closing, setClosing] = useState(false)

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, index) => String(currentYear - index))
  }, [])

  function requestClose() {
    if (closing || exporting) return
    setClosing(true)
    window.setTimeout(onClose, 180)
  }

  function clearFilters() {
    setStatus('')
    setResponsavel('')
    setDateFrom('')
    setDateTo('')
    setYear('')
  }

  async function exportarExcel() {
    setExporting(true)
    try {
      const filters: AtendimentoFilters = { status, responsavel, dateFrom, dateTo, year }
      const pageSize = 100
      const rows: Atendimento[] = []
      let page = 1
      while (true) {
        const { data, total } = await api.atendimentos(getToken, { ...filters, page, pageSize })
        rows.push(...data)
        if (data.length === 0 || rows.length >= total) break
        page += 1
      }

      if (!rows.length) {
        toast.warning('Nenhum chamado encontrado para esses filtros.')
        return
      }

      const sheetRows = rows.map(item => ({
        Pedido: item.numero_pedido ?? '',
        Cliente: item.cliente ?? '',
        Status: item.status,
        Prioridade: item.prioridade,
        Setor: item.setor ?? '',
        Responsável: item.responsavel ?? '',
        Motivo: item.motivo ?? '',
        Produto: item.descricao_produto ?? '',
        Quantidade: item.quantidade ?? '',
        'Valor unitário': item.valor_unitario ?? '',
        'Valor total': item.valor_total ?? '',
        Crédito: item.reembolso_valor ?? '',
        'Motivo do crédito': item.reembolso_motivo ?? '',
        Vendedor: item.vendedor ?? '',
        'Data solicitação': formatDate(item.data_solicitacao),
        'Agendado para': formatDateTime(item.agendado_para),
        'Concluído em': formatDateTime(item.concluido_em),
        'Próxima ação': item.proxima_acao ?? '',
      }))

      const sheet = XLSX.utils.json_to_sheet(sheetRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, 'Chamados')
      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `relatorio-chamados-${stamp}.xlsx`)
      toast.success(`${rows.length} chamado${rows.length !== 1 ? 's' : ''} exportado${rows.length !== 1 ? 's' : ''}.`)
      requestClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao exportar relatório.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={`${closing ? 'drawer-backdrop-out' : 'drawer-backdrop-in'} fixed inset-0 z-40 grid place-items-center bg-gray-950/30 p-4 backdrop-blur-sm`} onMouseDown={requestClose}>
      <div className={`${closing ? 'modal-panel-out' : 'modal-panel-in'} w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl`} onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-950">Relatório de chamados</h2>
            <p className="text-xs text-gray-400">Exporte os chamados filtrados para Excel</p>
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={requestClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <CalendarDays size={13} className="text-gray-400" />
                Data inicial
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={event => setDateFrom(event.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label>
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <CalendarDays size={13} className="text-gray-400" />
                Data final
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={event => setDateTo(event.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-gray-500">Ano</span>
              <select
                value={year}
                onChange={event => setYear(event.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                {yearOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-gray-500">Status</span>
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos os status</option>
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Responsável</span>
            <input
              value={responsavel}
              onChange={event => setResponsavel(event.target.value)}
              placeholder="Filtrar por responsável"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={exportarExcel}
            disabled={exporting}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
            Exportar
          </button>
        </div>
      </div>
    </div>
  )
}
