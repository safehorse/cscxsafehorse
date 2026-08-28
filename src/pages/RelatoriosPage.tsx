import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { BarChart3, CalendarDays, X } from 'lucide-react'
import { toast } from 'sonner'
import { Layout } from '../components/Layout'
import { AtendimentosPorDataChart, Metric, StatusChart } from './DashboardPage'
import { api, type AtendimentoFilters } from '../lib/api'
import type { DashboardData } from '../lib/types'

const STATUS_OPTIONS = ['ABERTO', 'PENDENTE', 'AGUARDANDO DEVOLUÇÃO', 'FINALIZADO', 'EM ANÁLISE', 'EM PRODUÇÃO', 'CRÉDITO GERADO', 'TROCA GERADA']

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toDateInputValue(from), to: toDateInputValue(to) }
}

function money(value?: string | number | null) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function RelatoriosPage() {
  const { getToken } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [dateFrom, setDateFrom] = useState(() => currentMonthRange().from)
  const [dateTo, setDateTo] = useState(() => currentMonthRange().to)
  const [year, setYear] = useState('')

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, index) => String(currentYear - index))
  }, [])

  const filterParams = useMemo<AtendimentoFilters>(() => ({
    status,
    responsavel,
    dateFrom,
    dateTo,
    year,
  }), [status, responsavel, dateFrom, dateTo, year])

  const hasFilters = Boolean(status || responsavel || dateFrom || dateTo || year)

  async function load() {
    setLoading(true)
    try {
      setDashboard(await api.dashboard(getToken, filterParams))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar relatório.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(load, 250)
    return () => window.clearTimeout(timeout)
  }, [filterParams])

  function setCurrentMonthFilter() {
    const { from, to } = currentMonthRange()
    setDateFrom(from)
    setDateTo(to)
    setYear('')
  }

  function clearFilters() {
    setStatus('')
    setResponsavel('')
    setDateFrom('')
    setDateTo('')
    setYear('')
  }

  return (
    <Layout>
      <div className="mx-auto max-w-[1320px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <BarChart3 size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-950">Relatório de chamados</h1>
            <p className="text-xs text-gray-400">Visão geral dos atendimentos no período filtrado</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_1fr_auto_auto]">
            <label className="min-w-0">
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
            <label className="min-w-0">
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
            <label className="min-w-0">
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
            <label className="min-w-0">
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
            <button
              type="button"
              onClick={setCurrentMonthFilter}
              className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
            >
              <CalendarDays size={15} />
              Mês atual
            </button>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <X size={15} />
              Limpar
            </button>
          </div>
          <label className="mt-3 block max-w-xs">
            <span className="mb-1 block text-xs font-medium text-gray-500">Responsável</span>
            <input
              value={responsavel}
              onChange={event => setResponsavel(event.target.value)}
              placeholder="Filtrar por responsável"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Atendimentos" value={dashboard?.totais.total ?? 0} loading={loading} />
          <Metric label="Em andamento" value={dashboard?.totais.abertos ?? 0} loading={loading} tone="blue" />
          <Metric label="Solucionados" value={dashboard?.totais.solucionados ?? 0} loading={loading} tone="emerald" />
          <Metric label="Valor envolvido" value={money(dashboard?.totais.valor_total)} loading={loading} tone="emerald" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Atendimentos hoje" value={dashboard?.totais.atendimentos_hoje ?? 0} loading={loading} />
          <Metric label="Agenda hoje" value={dashboard?.totais.hoje ?? 0} loading={loading} tone="amber" />
          <Metric label="Creditados" value={dashboard?.totais.reembolsados ?? 0} loading={loading} tone="amber" />
          <Metric label="Valor creditado" value={money(dashboard?.totais.valor_reembolso)} loading={loading} tone="blue" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <AtendimentosPorDataChart rows={dashboard?.por_data ?? []} loading={loading} />
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-950">Chamados por status</h2>
            <StatusChart rows={dashboard?.status ?? []} loading={loading} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
