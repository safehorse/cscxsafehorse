import { useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grid3X3,
  List,
  LoaderCircle,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import logoSrc from '../assets/logo.png'
import { UserNameButton } from '../components/UserNameButton'
import { api } from '../lib/api'
import { getStatusTone } from '../lib/statusStyles'
import type { Atendimento } from '../lib/types'

type ViewMode = 'calendar' | 'list'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

export function AgendaPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [items, setItems] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Atendimento | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const mode: ViewMode = searchParams.get('modo') === 'lista' ? 'list' : 'calendar'
  const range = useMemo(() => monthRange(month), [month])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.agenda(getToken, { from: range.from, to: range.to })
      setItems(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar agenda.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [range.from, range.to])

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) return
    api.syncUsuario(getToken, { email, nome: user.fullName }).catch(() => {
      // A nomeação não bloqueia o uso do app.
    })
  }, [user?.id])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(item => [
      item.numero_pedido,
      item.cliente,
      item.responsavel,
      item.proxima_acao,
      item.descricao_produto,
      item.motivo,
    ].some(value => String(value || '').toLowerCase().includes(term)))
  }, [items, search])

  const days = useMemo(() => calendarDays(month), [month])
  const grouped = useMemo(() => {
    const map = new Map<string, Atendimento[]>()
    for (const item of filtered) {
      if (!item.agendado_para) continue
      const key = dayKey(new Date(item.agendado_para))
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [filtered])

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

  function setMode(nextMode: ViewMode) {
    if (nextMode === 'list') setSearchParams({ modo: 'lista' })
    else setSearchParams({})
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3">
          <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-gray-950">Agenda CS/CX</h1>
            <p className="text-xs text-gray-400">Calendário de atendimentos</p>
          </div>
          <div className="flex-1" />
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
          <Link
            to="/chamados"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <List size={15} />
            Chamados
          </Link>
          <Link
            to="/whatsapp"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <MessageCircle size={15} />
            WhatsApp
          </Link>
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
          <UserNameButton />
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

      <main className="mx-auto max-w-[1320px] space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth(prev => addMonths(prev, -1))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                title="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-[180px] text-center">
                <h2 className="text-base font-bold capitalize text-gray-950">{monthLabel(month)}</h2>
                <p className="text-xs text-gray-400">{filtered.length} agendamento{filtered.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => setMonth(prev => addMonths(prev, 1))}
                className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                title="Próximo mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar pedido, cliente ou responsável..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setMode('calendar')}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${mode === 'calendar' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <Grid3X3 size={13} />
                Calendário
              </button>
              <button
                type="button"
                onClick={() => setMode('list')}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${mode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <List size={13} />
                Modo lista
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="grid place-items-center rounded-2xl border border-gray-200 bg-white py-20 text-gray-400">
            <LoaderCircle className="animate-spin" size={28} />
          </div>
        ) : mode === 'calendar' ? (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
              {WEEKDAYS.map(day => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-500">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-7">
              {days.map(day => {
                const dayItems = grouped.get(dayKey(day)) ?? []
                const muted = day.getMonth() !== month.getMonth()
                return (
                  <div key={day.toISOString()} className={`min-h-[132px] border-b border-gray-100 p-2 sm:border-r ${muted ? 'bg-gray-50/70' : 'bg-white'}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${isToday(day) ? 'bg-blue-600 text-white' : muted ? 'text-gray-300' : 'text-gray-700'}`}>
                        {day.getDate()}
                      </span>
                      {dayItems.length > 0 && <span className="text-[11px] font-semibold text-blue-600">{dayItems.length}</span>}
                    </div>
                    <div className="space-y-1.5">
                      {dayItems.slice(0, 3).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openDetail(item.id)}
                          className="w-full rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-left text-xs transition-colors hover:border-blue-300 hover:bg-blue-100"
                        >
                          <span className="block font-semibold text-blue-950">{time(item.agendado_para)}</span>
                          <span className="block truncate text-blue-800">#{item.numero_pedido} - {item.cliente}</span>
                        </button>
                      ))}
                      {dayItems.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setMode('list')}
                          className="w-full rounded-lg bg-gray-100 px-2 py-1 text-left text-xs font-semibold text-gray-600 hover:bg-gray-200"
                        >
                          +{dayItems.length - 3} na lista
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">Nenhum agendamento encontrado.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDetail(item.id)}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                      <CalendarDays size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-950">#{item.numero_pedido ?? 'sem pedido'}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-600">{item.cliente ?? 'Cliente não informado'}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">{item.proxima_acao ?? item.descricao_produto ?? item.motivo ?? 'Sem descrição'}</p>
                    </div>
                    <div className="hidden text-right text-xs text-gray-500 sm:block">
                      <p className="font-semibold text-gray-900">{dateTime(item.agendado_para)}</p>
                      <p>{item.responsavel ?? 'Sem responsável'}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {selected && (
        <AgendaDetail
          item={selected}
          loading={detailLoading}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function AgendaDetail({ item, loading, onClose }: { item: Atendimento; loading: boolean; onClose: () => void }) {
  const [closing, setClosing] = useState(false)

  function requestClose() {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 180)
  }

  return (
    <div className={`${closing ? 'drawer-backdrop-out' : 'drawer-backdrop-in'} fixed inset-0 z-30 bg-gray-950/30 p-4 backdrop-blur-sm`} onMouseDown={requestClose}>
      <div className={`${closing ? 'drawer-panel-out' : 'drawer-panel-in'} ml-auto h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl`} onMouseDown={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-gray-100 bg-white p-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-gray-950">Pedido #{item.numero_pedido ?? 'sem número'}</h2>
            <p className="mt-1 truncate text-sm text-gray-500">{item.cliente ?? 'Cliente não informado'}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={requestClose}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20 text-gray-400">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                <Clock3 size={16} />
                {dateTime(item.agendado_para)}
              </div>
              <p className="mt-2 text-sm text-blue-800">{item.proxima_acao ?? 'Sem próxima ação informada.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Responsável" value={item.responsavel} />
              <Info label="Status" value={item.status} />
              <Info label="Produto" value={item.descricao_produto} />
              <Info label="Setor" value={item.setor} />
            </div>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-950">Situação</h3>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                <p className="font-medium text-gray-900">{item.motivo ?? 'Sem motivo informado'}</p>
                {item.descricao_situacao && <p className="mt-2 whitespace-pre-wrap">{item.descricao_situacao}</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-gray-800">{value || '-'}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status)
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>{status}</span>
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function monthRange(date: Date) {
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

function calendarDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start)
    next.setDate(start.getDate() + index)
    return next
  })
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isToday(date: Date) {
  return dayKey(date) === dayKey(new Date())
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function dateTime(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function time(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
