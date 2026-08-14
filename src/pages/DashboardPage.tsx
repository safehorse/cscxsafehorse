import { useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  List,
  LogOut,
  MessageSquareText,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  User,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import logoSrc from '../assets/logo.png'
import { DateTimePicker } from '../components/DateTimePicker'
import { api, type AtendimentoFilters } from '../lib/api'
import type { Atendimento, CadastroOptions, DashboardData, PcpPedido, PcpPedidoItem } from '../lib/types'

const STATUS_OPTIONS = ['ABERTO', 'AGUARDANDO DEVOLUÇÃO', 'FINALIZADO', 'EM ANÁLISE', 'EM PRODUÇÃO', 'CRÉDITO GERADO', 'TROCA GERADA']
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'] as const
const PAGE_SIZE = 10

const emptyWizard = {
  data_solicitacao: new Date().toISOString().slice(0, 10),
  numero_pedido: '',
  codigo_cliente: '',
  cliente: '',
  codigo_produto: '',
  descricao_produto: '',
  quantidade: '',
  valor_unitario: '',
  valor_total: '',
  motivo: '',
  setor: '',
  responsavel: '',
  proxima_acao: '',
  status: 'ABERTO',
  novo_pedido: '',
  cliente_tem_desconto: '',
  vendedor: '',
  descricao_situacao: '',
  prioridade: 'normal',
  agendado_para: '',
}

type WizardForm = typeof emptyWizard

export function DashboardPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [cadastros, setCadastros] = useState<CadastroOptions>({ setores: [], responsaveis: [] })
  const [selected, setSelected] = useState<Atendimento | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [year, setYear] = useState('')
  const [page, setPage] = useState(1)
  const [totalAtendimentos, setTotalAtendimentos] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [note, setNote] = useState('')
  const filterParams = useMemo<AtendimentoFilters>(() => ({
    search,
    status,
    responsavel,
    dateFrom,
    dateTo,
    year,
  }), [search, status, responsavel, dateFrom, dateTo, year])
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, index) => String(currentYear - index))
  }, [])
  const hasFilters = Boolean(search || status || responsavel || dateFrom || dateTo || year)

  async function load() {
    setLoading(true)
    try {
      const [dash, list, options] = await Promise.all([
        api.dashboard(getToken, filterParams),
        api.atendimentos(getToken, { ...filterParams, page, pageSize: PAGE_SIZE }),
        api.cadastros(getToken),
      ])
      setDashboard(dash)
      setAtendimentos(list.data)
      setTotalAtendimentos(list.total)
      setCadastros(options)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(load, 250)
    return () => window.clearTimeout(timeout)
  }, [filterParams, page])

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) return
    api.syncUsuario(getToken, { email, nome: user.fullName }).catch(() => {
      // A nomeação não bloqueia o uso do app.
    })
  }, [user?.id])

  const totalPages = Math.max(1, Math.ceil(totalAtendimentos / PAGE_SIZE))

  function clearFilters() {
    setSearch('')
    setStatus('')
    setResponsavel('')
    setDateFrom('')
    setDateTo('')
    setYear('')
    setPage(1)
  }

  async function reloadCadastros() {
    try {
      setCadastros(await api.cadastros(getToken))
    } catch {
      // A lista continua funcionando com o cache atual.
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true)
    try {
      const { data } = await api.atendimento(getToken, id)
      setSelected(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao abrir atendimento.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function saveStatus(nextStatus: string) {
    if (!selected) return
    try {
      const isDone = ['FINALIZADO', 'CONCLUIDO'].includes(nextStatus)
      const { data } = await api.updateAtendimento(getToken, selected.id, {
        status: nextStatus,
        concluido_em: isDone ? selected.concluido_em ?? new Date().toISOString() : null,
      })
      setSelected(prev => prev ? { ...prev, ...data } : data)
      setAtendimentos(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      toast.success('Status atualizado.')
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar.')
    }
  }

  async function saveReembolso(valor: number | null, motivo: string) {
    if (!selected) return
    try {
      const hasRefund = valor !== null || motivo.trim()
      const { data } = await api.updateAtendimento(getToken, selected.id, {
        reembolso_valor: valor,
        reembolso_motivo: motivo.trim() || null,
        reembolso_em: hasRefund ? selected.reembolso_em ?? new Date().toISOString() : null,
      })
      setSelected(prev => prev ? { ...prev, ...data } : data)
      setAtendimentos(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      toast.success('Reembolso salvo.')
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar reembolso.')
    }
  }

  async function addNote() {
    if (!selected || !note.trim()) return
    try {
      await api.addInteracao(getToken, selected.id, { tipo: 'nota', descricao: note.trim() })
      setNote('')
      await openDetail(selected.id)
      toast.success('Histórico atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar nota.')
    }
  }

  async function consultPcp() {
    if (!selected?.numero_pedido) return
    try {
      const { data } = await api.pcpPedido(getToken, selected.numero_pedido)
      if (!data) toast.warning('Pedido não encontrado no PCP.')
      else toast.success('Pedido encontrado no PCP.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao consultar PCP.')
    }
  }

  const agenda = useMemo(() => {
    const rows = dashboard?.proximos ?? []
    return rows.filter(item => item.agendado_para).slice(0, 7)
  }, [dashboard])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3">
          <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-gray-950">CS/CX Safe Horse</h1>
            <p className="text-xs text-gray-400">Sucesso do Cliente 2026</p>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => load()}
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
          <Link
            to="/usuarios"
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
            title="Usuários"
          >
            <UsersRound size={15} />
          </Link>
          <div className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-600 sm:flex">
            <User size={15} className="text-gray-400" />
            <span>{user?.fullName ?? user?.primaryEmailAddress?.emailAddress}</span>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-red-500 transition-colors hover:bg-red-50"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1320px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Atendimentos" value={dashboard?.totais.total ?? 0} loading={loading} />
            <Metric label="Em aberto" value={dashboard?.totais.abertos ?? 0} loading={loading} tone="blue" />
            <Metric label="Agenda hoje" value={dashboard?.totais.hoje ?? 0} loading={loading} tone="amber" />
            <Metric label="Valor envolvido" value={money(dashboard?.totais.valor_total)} loading={loading} tone="emerald" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Atendimentos hoje" value={dashboard?.totais.atendimentos_hoje ?? 0} loading={loading} />
            <Metric label="Solucionados" value={dashboard?.totais.solucionados ?? 0} loading={loading} tone="emerald" />
            <Metric label="Reembolsados" value={dashboard?.totais.reembolsados ?? 0} loading={loading} tone="amber" />
            <Metric label="Valor reembolsado" value={money(dashboard?.totais.valor_reembolso)} loading={loading} tone="blue" />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={event => { setSearch(event.target.value); setPage(1) }}
                    placeholder="Buscar pedido, cliente ou produto..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <select
                  value={status}
                  onChange={event => { setStatus(event.target.value); setPage(1) }}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Todos os status</option>
                  {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <input
                  value={responsavel}
                  onChange={event => { setResponsavel(event.target.value); setPage(1) }}
                  placeholder="Responsável"
                  className="h-10 w-40 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Novo
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_auto]">
                <label className="min-w-0">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <CalendarDays size={13} className="text-gray-400" />
                    Data inicial
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={event => { setDateFrom(event.target.value); setPage(1) }}
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
                    onChange={event => { setDateTo(event.target.value); setPage(1) }}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Ano</span>
                  <select
                    value={year}
                    onChange={event => { setYear(event.target.value); setPage(1) }}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Todos</option>
                    {yearOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
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
            </div>

            {loading ? (
              <div className="grid place-items-center py-16 text-gray-400">
                <LoaderCircle className="animate-spin" size={28} />
              </div>
            ) : atendimentos.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">Nenhum atendimento encontrado.</div>
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {atendimentos.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openDetail(item.id)}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-950">#{item.numero_pedido ?? 'sem pedido'}</span>
                          <StatusBadge status={item.status} />
                          <PriorityBadge value={item.prioridade} />
                          {(item.reembolso_valor || item.reembolso_motivo) && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Reembolso</span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-600">{item.cliente ?? 'Cliente não informado'}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">{item.descricao_produto ?? item.motivo ?? 'Sem descrição'}</p>
                      </div>
                      <div className="hidden text-right text-xs text-gray-400 sm:block">
                        <p>{date(item.data_solicitacao)}</p>
                        <p>{item.responsavel ?? 'Sem responsável'}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                  <p className="text-xs text-gray-400">
                    {totalAtendimentos} atendimento{totalAtendimentos !== 1 ? 's' : ''} - pagina {page} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Próxima
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <CalendarDays size={16} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-950">Agenda</h2>
              <div className="flex-1" />
              <Link
                to="/agenda?modo=lista"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                <List size={13} />
                Modo lista
              </Link>
              <Link
                to="/agenda"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <CalendarDays size={13} />
                Abrir agenda
              </Link>
            </div>
            {agenda.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Sem agenda definida.</p>
            ) : (
              <div className="space-y-2">
                {agenda.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDetail(item.id)}
                    className="w-full rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                      <Clock3 size={13} className="text-gray-400" />
                      {dateTime(item.agendado_para)}
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-700">#{item.numero_pedido} - {item.cliente}</p>
                    <p className="truncate text-xs text-gray-400">{item.proxima_acao ?? item.status}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-950">Status</h2>
            </div>
            <StatusChart rows={dashboard?.status ?? []} loading={loading} />
          </div>
        </aside>
      </main>

      {selected && (
        <DetailDrawer
          selected={selected}
          loading={detailLoading}
          note={note}
          setNote={setNote}
          onClose={() => setSelected(null)}
          onSaveStatus={saveStatus}
          onSaveReembolso={saveReembolso}
          onAddNote={addNote}
          onConsultPcp={consultPcp}
        />
      )}

      {showCreate && (
        <CreateWizard
          getToken={getToken}
          cadastros={cadastros}
          onCadastroChanged={reloadCadastros}
          onClose={() => setShowCreate(false)}
          onSaved={(data) => {
            setShowCreate(false)
            setAtendimentos(prev => [data, ...prev])
            toast.success('Atendimento criado.')
            load()
          }}
        />
      )}
    </div>
  )
}

function DetailDrawer({ selected, loading, note, setNote, onClose, onSaveStatus, onSaveReembolso, onAddNote, onConsultPcp }: {
  selected: Atendimento
  loading: boolean
  note: string
  setNote: (value: string) => void
  onClose: () => void
  onSaveStatus: (status: string) => Promise<void>
  onSaveReembolso: (valor: number | null, motivo: string) => Promise<void>
  onAddNote: () => void
  onConsultPcp: () => void
}) {
  const [draftStatus, setDraftStatus] = useState(selected.status)
  const [savingStatus, setSavingStatus] = useState(false)
  const [showReembolso, setShowReembolso] = useState(Boolean(selected.reembolso_valor || selected.reembolso_motivo))
  const [reembolsoValor, setReembolsoValor] = useState(selected.reembolso_valor != null ? String(selected.reembolso_valor) : '')
  const [reembolsoMotivo, setReembolsoMotivo] = useState(selected.reembolso_motivo ?? '')
  const [savingReembolso, setSavingReembolso] = useState(false)
  const statusChanged = draftStatus !== selected.status

  useEffect(() => {
    setDraftStatus(selected.status)
    setShowReembolso(Boolean(selected.reembolso_valor || selected.reembolso_motivo))
    setReembolsoValor(selected.reembolso_valor != null ? String(selected.reembolso_valor) : '')
    setReembolsoMotivo(selected.reembolso_motivo ?? '')
  }, [selected.id, selected.status, selected.reembolso_valor, selected.reembolso_motivo])

  async function saveDraftStatus() {
    if (!statusChanged) return
    setSavingStatus(true)
    try {
      await onSaveStatus(draftStatus)
    } finally {
      setSavingStatus(false)
    }
  }

  async function saveRefund() {
    const valor = reembolsoValor.trim() ? Number(reembolsoValor.replace(',', '.')) : null
    if (valor !== null && !Number.isFinite(valor)) return toast.warning('Informe um valor de reembolso válido.')
    if ((valor !== null || reembolsoMotivo.trim()) && !reembolsoMotivo.trim()) return toast.warning('Informe o motivo do reembolso.')
    setSavingReembolso(true)
    try {
      await onSaveReembolso(valor, reembolsoMotivo)
    } finally {
      setSavingReembolso(false)
    }
  }

  return (
    <div className="drawer-backdrop-in fixed inset-0 z-30 bg-gray-950/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="drawer-panel-in ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-gray-950">Pedido #{selected.numero_pedido ?? 'sem número'}</h2>
              <p className="mt-1 truncate text-sm text-gray-500">{selected.cliente ?? 'Cliente não informado'}</p>
            </div>
            <button className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20 text-gray-400">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <PriorityBadge value={selected.prioridade} />
              {selected.agendado_para && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{dateTime(selected.agendado_para)}</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="ID cliente" value={selected.codigo_cliente} />
              <Info label="Produto" value={selected.descricao_produto} />
              <Info label="Código produto" value={selected.codigo_produto} />
              <Info label="Quantidade" value={selected.quantidade?.toString()} />
              <Info label="Valor unitario" value={money(selected.valor_unitario)} />
              <Info label="Valor total" value={money(selected.valor_total)} />
              <Info label="Valor reembolso" value={money(selected.reembolso_valor)} />
              <Info label="Setor" value={selected.setor} />
              <Info label="Responsável" value={selected.responsavel} />
              <Info label="Vendedor" value={selected.vendedor} />
              <Info label="Novo pedido" value={selected.novo_pedido} />
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-950">Situação</h3>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                <p className="font-medium text-gray-900">{selected.motivo ?? 'Sem motivo informado'}</p>
                {selected.descricao_situacao && <p className="mt-2 whitespace-pre-wrap">{selected.descricao_situacao}</p>}
                {selected.proxima_acao && <p className="mt-2 text-blue-700">Próxima ação: {selected.proxima_acao}</p>}
              </div>
            </section>

            {(selected.reembolso_valor || selected.reembolso_motivo || showReembolso) && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-amber-950">Reembolso</h3>
                    <p className="text-xs text-amber-700">Valor e motivo preenchidos manualmente.</p>
                  </div>
                  {selected.reembolso_em && <span className="text-xs font-semibold text-amber-700">{dateTime(selected.reembolso_em)}</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-amber-800">Valor</span>
                    <input
                      value={reembolsoValor}
                      onChange={event => setReembolsoValor(event.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-amber-800">Motivo</span>
                    <input
                      value={reembolsoMotivo}
                      onChange={event => setReembolsoMotivo(event.target.value)}
                      placeholder="Motivo do reembolso..."
                      className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={saveRefund}
                    disabled={savingReembolso}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {savingReembolso ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    Salvar reembolso
                  </button>
                </div>
              </section>
            )}

            <section className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDraftStatus(option)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    draftStatus === option
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {option}
                </button>
              ))}
              <button
                type="button"
                onClick={saveDraftStatus}
                disabled={!statusChanged || savingStatus}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {savingStatus ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Salvar status
              </button>
              <button
                type="button"
                onClick={() => setShowReembolso(prev => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                <Plus size={13} />
                Reembolso
              </button>
              <button
                type="button"
                onClick={onConsultPcp}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300"
              >
                <ExternalLink size={13} />
                PCP
              </button>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-950">Histórico</h3>
              <div className="space-y-2">
                {(selected.interacoes ?? []).map(item => (
                  <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                      <MessageSquareText size={13} />
                      {item.tipo} - {dateTime(item.realizado_em)}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{item.descricao}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  placeholder="Adicionar nota..."
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button onClick={onAddNote} className="rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
                  Salvar
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateWizard({ getToken, cadastros, onCadastroChanged, onClose, onSaved }: {
  getToken: () => Promise<string | null>
  cadastros: CadastroOptions
  onCadastroChanged: () => void
  onClose: () => void
  onSaved: (data: Atendimento) => void
}) {
  const [step, setStep] = useState(1)
  const [codigoBusca, setCodigoBusca] = useState('')
  const [pedido, setPedido] = useState<PcpPedido | null>(null)
  const [selectedItems, setSelectedItems] = useState<PcpPedidoItem[]>([])
  const [form, setForm] = useState<WizardForm>(emptyWizard)
  const [loadingPedido, setLoadingPedido] = useState(false)
  const [saving, setSaving] = useState(false)

  function update(key: keyof WizardForm, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function applyPedido(next: PcpPedido) {
    setPedido(next)
    setSelectedItems([])
    setForm(prev => ({
      ...prev,
      numero_pedido: next.codigo_venda,
      codigo_cliente: next.codigo_cliente ?? '',
      cliente: next.nome_cliente ?? '',
      vendedor: next.vendedor ?? '',
      data_solicitacao: prev.data_solicitacao || new Date().toISOString().slice(0, 10),
      descricao_situacao: next.observacoes ?? prev.descricao_situacao,
    }))
    if (next.itens.length === 1) applyItems([next.itens[0]], next)
    setStep(next.itens.length === 1 ? 3 : 2)
  }

  function applyItems(items: PcpPedidoItem[], sourcePedido = pedido) {
    setSelectedItems(items)
    const resumo = summarizeItems(items)
    setForm(prev => ({
      ...prev,
      numero_pedido: sourcePedido?.codigo_venda ?? prev.numero_pedido,
      codigo_cliente: sourcePedido?.codigo_cliente ?? prev.codigo_cliente,
      cliente: sourcePedido?.nome_cliente ?? prev.cliente,
      vendedor: sourcePedido?.vendedor ?? prev.vendedor,
      codigo_produto: resumo.codigo_produto,
      descricao_produto: resumo.descricao_produto,
      quantidade: resumo.quantidade,
      valor_unitario: resumo.valor_unitario,
      valor_total: resumo.valor_total,
      descricao_situacao: resumo.observacoes || prev.descricao_situacao,
    }))
  }

  function toggleItem(item: PcpPedidoItem) {
    const exists = selectedItems.some(selected => selected.id === item.id)
    const next = exists
      ? selectedItems.filter(selected => selected.id !== item.id)
      : [...selectedItems, item]
    applyItems(next)
  }

  async function buscarPedido() {
    const codigo = codigoBusca.trim()
    if (!codigo) return
    setLoadingPedido(true)
    try {
      const { data } = await api.pcpPedido(getToken, codigo)
      if (!data) {
        toast.warning('Pedido não encontrado no PCP.')
        return
      }
      applyPedido(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao buscar pedido.')
    } finally {
      setLoadingPedido(false)
    }
  }

  async function createCadastro(kind: 'setor' | 'responsavel') {
    const value = (kind === 'setor' ? form.setor : form.responsavel).trim()
    if (!value) return
    try {
      if (kind === 'setor') await api.createSetor(getToken, value)
      else await api.createResponsavel(getToken, value)
      toast.success(kind === 'setor' ? 'Setor cadastrado.' : 'Responsável cadastrado.')
      onCadastroChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao cadastrar.')
    }
  }

  async function save() {
    if (!pedido) return toast.warning('Busque o pedido.')
    if (!selectedItems.length) return toast.warning('Selecione pelo menos um produto.')
    if (!form.motivo.trim()) return toast.warning('Informe o motivo.')
    if (!form.setor.trim()) return toast.warning('Informe o setor.')
    if (!form.responsavel.trim()) return toast.warning('Informe o responsável.')

    setSaving(true)
    try {
      const { data } = await api.createAtendimento(getToken, {
        ...formToPayload(form),
        pcp_pedido_id: pedido.id,
        pcp_item_id: selectedItems.length === 1 ? selectedItems[0].id : null,
        pcp_payload: { pedido, itens: selectedItems },
      })
      onSaved(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar atendimento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-gray-950/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Novo atendimento</h2>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3].map(item => (
                <span key={item} className={`h-1.5 w-10 rounded-full ${step >= item ? 'bg-blue-600' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
          <div className="flex-1" />
          <button className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <PackageSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={codigoBusca}
                    onChange={event => setCodigoBusca(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') buscarPedido() }}
                    placeholder="Numero do pedido"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={buscarPedido}
                  disabled={loadingPedido}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loadingPedido ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
                  Buscar
                </button>
              </div>
              {pedido && <PedidoResumo pedido={pedido} />}
            </div>
          )}

          {step === 2 && pedido && (
            <div className="space-y-3">
              <PedidoResumo pedido={pedido} />
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <PackageSearch size={16} className="text-blue-600" />
                <p className="text-sm font-semibold text-blue-950">
                  {selectedItems.length} produto{selectedItems.length !== 1 ? 's' : ''} selecionado{selectedItems.length !== 1 ? 's' : ''}
                </p>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => applyItems(pedido.itens, pedido)}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => applyItems([], pedido)}
                  disabled={!selectedItems.length}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                >
                  Limpar
                </button>
              </div>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
                {pedido.itens.map(item => {
                  const checked = selectedItems.some(selected => selected.id === item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item)}
                      className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-colors ${checked ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}>
                        {checked && <CheckCircle2 size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-950">{item.descricao_produto ?? 'Produto sem nome'}</p>
                        <p className="text-xs text-gray-400">ERP {item.codigo_produto ?? '-'} - Qtd {item.quantidade ?? '-'}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{money(item.valor_total)}</p>
                        <p>{money(item.valor_unitario)} un.</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Pedido" value={form.numero_pedido} />
                <Info label="ID cliente" value={form.codigo_cliente} />
                <Info label="Cliente" value={form.cliente} />
                <Info label="Vendedor" value={form.vendedor} />
                <Info label={selectedItems.length > 1 ? 'Produtos' : 'Produto'} value={form.descricao_produto} />
                <Info label={selectedItems.length > 1 ? 'Códigos produtos' : 'Código produto'} value={form.codigo_produto} />
                <Info label="Quantidade" value={form.quantidade} />
                <Info label="Valor total" value={money(form.valor_total)} />
              </div>

              {selectedItems.length > 1 && (
                <div className="overflow-hidden rounded-2xl border border-gray-200">
                  <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
                    Produtos selecionados
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-gray-900">{item.descricao_produto ?? 'Produto sem nome'}</p>
                          <p className="text-xs text-gray-400">ERP {item.codigo_produto ?? '-'} - Qtd {item.quantidade ?? '-'}</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{money(item.valor_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Motivo" value={form.motivo} onChange={value => update('motivo', value)} />
                <SelectField label="Status" value={form.status} options={STATUS_OPTIONS} onChange={value => update('status', value)} />
                <CadastroField
                  label="Setor"
                  icon={<Building2 size={15} />}
                  value={form.setor}
                  options={cadastros.setores}
                  listId="setores-list"
                  onChange={value => update('setor', value)}
                  onCreate={() => createCadastro('setor')}
                />
                <ResponsavelListbox
                  value={form.responsavel}
                  options={cadastros.responsaveis}
                  onChange={value => update('responsavel', value)}
                  onCreate={() => createCadastro('responsavel')}
                />
                <Field label="Próxima ação" value={form.proxima_acao} onChange={value => update('proxima_acao', value)} />
                <DateTimePicker label="Agendado para" value={form.agendado_para} onChange={value => update('agendado_para', value)} />
                <SelectField label="Prioridade" value={form.prioridade} options={[...PRIORIDADES]} onChange={value => update('prioridade', value)} />
                <Field label="Novo pedido" value={form.novo_pedido} onChange={value => update('novo_pedido', value)} />
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-500">Descrição da situação</span>
                  <textarea
                    value={form.descricao_situacao}
                    onChange={event => update('descricao_situacao', event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-5">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1}
          >
            <ArrowLeft size={15} />
            Voltar
          </button>
          {step < 3 ? (
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              onClick={() => setStep(prev => Math.min(3, prev + 1))}
              disabled={(step === 1 && !pedido) || (step === 2 && !selectedItems.length)}
            >
              Continuar
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={save}
              disabled={saving}
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Salvar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PedidoResumo({ pedido }: { pedido: PcpPedido }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold text-gray-950">#{pedido.codigo_venda}</span>
        {pedido.situacao_erp && <StatusBadge status={pedido.situacao_erp} />}
        {pedido.financeiro_bloqueado && <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">Pendente financeiro</span>}
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="ID cliente" value={pedido.codigo_cliente} />
        <Info label="Cliente" value={pedido.nome_cliente} />
        <Info label="Vendedor" value={pedido.vendedor} />
        <Info label="Total pedido" value={money(pedido.valor_total)} />
      </div>
    </div>
  )
}

function Metric({ label, value, loading, tone = 'gray' }: { label: string; value: string | number; loading: boolean; tone?: 'gray' | 'blue' | 'amber' | 'emerald' }) {
  const classes = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className={`mt-3 inline-flex rounded-xl px-3 py-1.5 text-2xl font-bold ${classes[tone]}`}>{value}</p>
      )}
    </div>
  )
}

function StatusChart({ rows, loading }: { rows: DashboardData['status']; loading: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.total))

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map(item => (
          <div key={item} className="h-12 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-gray-400">Sem status neste filtro.</p>
  }

  return (
    <div className="space-y-3">
      {rows.map(row => {
        const percent = Math.max(6, Math.round((row.total / max) * 100))
        return (
          <div key={row.status} className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-gray-600">{row.status}</span>
              <strong className="shrink-0 text-gray-950">{row.total}</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function CadastroField({ label, value, options, listId, icon, onChange, onCreate }: {
  label: string
  value: string
  options: string[]
  listId: string
  icon: React.ReactNode
  onChange: (value: string) => void
  onCreate: () => void
}) {
  const exists = options.some(option => option.toLowerCase() === value.trim().toLowerCase())
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      <div className="flex gap-2">
        <input
          list={listId}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
        <button
          type="button"
          onClick={onCreate}
          disabled={!value.trim() || exists}
          className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          title={`Cadastrar ${label.toLowerCase()}`}
        >
          {icon}
        </button>
      </div>
    </label>
  )
}

function ResponsavelListbox({ value, options, onChange, onCreate }: {
  value: string
  options: string[]
  onChange: (value: string) => void
  onCreate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const normalizedValue = value.trim().toLowerCase()
  const exists = options.some(option => option.toLowerCase() === normalizedValue)
  const filtered = options
    .filter(option => option.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8)

  function openList() {
    setQuery(value)
    setOpen(true)
  }

  function selectOption(option: string) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-medium text-gray-500">Responsável</span>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <UserPlus size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={open ? query : value}
            onFocus={openList}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={event => {
              setQuery(event.target.value)
              onChange(event.target.value)
              setOpen(true)
            }}
            placeholder="Selecione ou digite..."
            className="h-10 w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <ChevronRight
            size={15}
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
          />

          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-400">Nenhum responsável encontrado.</div>
              ) : (
                <div className="max-h-56 overflow-y-auto p-1" role="listbox">
                  {filtered.map(option => {
                    const selected = option.toLowerCase() === normalizedValue
                    return (
                      <button
                        key={option}
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => selectOption(option)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                        role="option"
                        aria-selected={selected}
                      >
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          {selected ? <CheckCircle2 size={13} /> : <User size={13} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{option}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onCreate}
          disabled={!value.trim() || exists}
          className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40"
          title="Cadastrar responsável"
        >
          <UserPlus size={15} />
        </button>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-gray-800">{value || '-'}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const done = ['FINALIZADO', 'CONCLUIDO'].includes(status)
  const wait = status.includes('AGUARDANDO')
  const className = done
    ? 'bg-emerald-50 text-emerald-700'
    : wait
      ? 'bg-amber-50 text-amber-700'
      : 'bg-blue-50 text-blue-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>
}

function PriorityBadge({ value }: { value?: string }) {
  if (!value || value === 'normal') return null
  const className = value === 'urgente' ? 'bg-red-600 text-white' : value === 'alta' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{value}</span>
}

function date(value?: string | null) {
  if (!value) return '-'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
}

function dateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function money(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function summarizeItems(items: PcpPedidoItem[]) {
  const codigos = compactJoin(items.map(item => item.codigo_produto), ', ')
  const descricoes = compactJoin(items.map(item => item.descricao_produto), ' | ')
  const quantidadeTotal = sumNumbers(items.map(item => item.quantidade))
  const valorTotal = sumNumbers(items.map(item => item.valor_total))
  const valorUnitario = items.length === 1
    ? items[0].valor_unitario
    : valorTotal != null && quantidadeTotal ? valorTotal / quantidadeTotal : null

  return {
    codigo_produto: codigos,
    descricao_produto: items.length > 1 ? `${items.length} produtos: ${descricoes}` : descricoes,
    quantidade: quantidadeTotal != null ? String(round2(quantidadeTotal)) : '',
    valor_unitario: valorUnitario != null ? String(round2(valorUnitario)) : '',
    valor_total: valorTotal != null ? String(round2(valorTotal)) : '',
    observacoes: compactJoin(items.map(item => item.obs), '\n'),
  }
}

function sumNumbers(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(Number(value)))
  if (!valid.length) return null
  return valid.reduce((total, value) => total + Number(value), 0)
}

function compactJoin(values: Array<string | null | undefined>, separator: string) {
  return values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(separator)
}

function formToPayload(form: WizardForm) {
  return {
    ...form,
    quantidade: form.quantidade ? Number(form.quantidade) : null,
    valor_unitario: form.valor_unitario ? Number(form.valor_unitario) : null,
    valor_total: form.valor_total ? Number(form.valor_total) : null,
    agendado_para: form.agendado_para || null,
    prioridade: form.prioridade as 'baixa' | 'normal' | 'alta' | 'urgente',
  }
}
