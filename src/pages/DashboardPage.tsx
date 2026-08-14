import { useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import logoSrc from '../assets/logo.png'
import { api } from '../lib/api'
import type { Atendimento, DashboardData } from '../lib/types'

const STATUS_OPTIONS = ['ABERTO', 'AGUARDANDO DEVOLUCAO', 'FINALIZADO', 'EM ANALISE', 'CREDITO GERADO', 'TROCA GERADA']

const emptyForm = {
  data_solicitacao: '',
  numero_pedido: '',
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

type FormState = typeof emptyForm

export function DashboardPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [selected, setSelected] = useState<Atendimento | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [note, setNote] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [dash, list] = await Promise.all([
        api.dashboard(getToken),
        api.atendimentos(getToken, { search, status, responsavel }),
      ])
      setDashboard(dash)
      setAtendimentos(list.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(load, 250)
    return () => window.clearTimeout(timeout)
  }, [search, status, responsavel])

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
      const { data } = await api.updateAtendimento(getToken, selected.id, { status: nextStatus })
      setSelected(prev => prev ? { ...prev, ...data } : data)
      setAtendimentos(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      toast.success('Status atualizado.')
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar.')
    }
  }

  async function createAtendimento() {
    try {
      const body = formToPayload(form)
      const { data } = await api.createAtendimento(getToken, body)
      setShowCreate(false)
      setForm(emptyForm)
      setAtendimentos(prev => [data, ...prev])
      toast.success('Atendimento criado.')
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar atendimento.')
    }
  }

  async function addNote() {
    if (!selected || !note.trim()) return
    try {
      await api.addInteracao(getToken, selected.id, { tipo: 'nota', descricao: note.trim() })
      setNote('')
      await openDetail(selected.id)
      toast.success('Historico atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar nota.')
    }
  }

  async function consultPcp() {
    if (!selected?.numero_pedido) return
    try {
      const { data } = await api.pcpPedido(getToken, selected.numero_pedido)
      if (!data) toast.warning('Pedido nao encontrado no PCP.')
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

          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Buscar pedido, cliente ou produto..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <select
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Todos os status</option>
                  {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <input
                  value={responsavel}
                  onChange={event => setResponsavel(event.target.value)}
                  placeholder="Responsavel"
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
            </div>

            {loading ? (
              <div className="grid place-items-center py-16 text-gray-400">
                <LoaderCircle className="animate-spin" size={28} />
              </div>
            ) : atendimentos.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">Nenhum atendimento encontrado.</div>
            ) : (
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
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-600">{item.cliente ?? 'Cliente nao informado'}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-400">{item.descricao_produto ?? item.motivo ?? 'Sem descricao'}</p>
                    </div>
                    <div className="hidden text-right text-xs text-gray-400 sm:block">
                      <p>{date(item.data_solicitacao)}</p>
                      <p>{item.responsavel ?? 'Sem responsavel'}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays size={16} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-950">Agenda</h2>
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
            <div className="space-y-2">
              {(dashboard?.status ?? []).map(row => (
                <div key={row.status} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
                  <span className="truncate text-gray-600">{row.status}</span>
                  <strong className="text-gray-950">{row.total}</strong>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {selected && (
        <div className="fixed inset-0 z-30 bg-gray-950/30 p-4 backdrop-blur-sm" onMouseDown={() => setSelected(null)}>
          <div
            className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold text-gray-950">Pedido #{selected.numero_pedido ?? 'sem numero'}</h2>
                  <p className="mt-1 truncate text-sm text-gray-500">{selected.cliente ?? 'Cliente nao informado'}</p>
                </div>
                <button className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSelected(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {detailLoading ? (
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
                  <Info label="Produto" value={selected.descricao_produto} />
                  <Info label="Codigo produto" value={selected.codigo_produto} />
                  <Info label="Quantidade" value={selected.quantidade?.toString()} />
                  <Info label="Valor total" value={money(selected.valor_total)} />
                  <Info label="Setor" value={selected.setor} />
                  <Info label="Responsavel" value={selected.responsavel} />
                  <Info label="Vendedor" value={selected.vendedor} />
                  <Info label="Novo pedido" value={selected.novo_pedido} />
                </div>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-950">Situacao</h3>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                    <p className="font-medium text-gray-900">{selected.motivo ?? 'Sem motivo informado'}</p>
                    {selected.descricao_situacao && <p className="mt-2 whitespace-pre-wrap">{selected.descricao_situacao}</p>}
                    {selected.proxima_acao && <p className="mt-2 text-blue-700">Proxima acao: {selected.proxima_acao}</p>}
                  </div>
                </section>

                <section className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => saveStatus(option)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        selected.status === option
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={consultPcp}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300"
                  >
                    <ExternalLink size={13} />
                    PCP
                  </button>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-950">Historico</h3>
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
                    <button onClick={addNote} className="rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
                      Salvar
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal
          form={form}
          setForm={setForm}
          onClose={() => setShowCreate(false)}
          onSave={createAtendimento}
        />
      )}
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

function CreateModal({ form, setForm, onClose, onSave }: {
  form: FormState
  setForm: (form: FormState) => void
  onClose: () => void
  onSave: () => void
}) {
  function update(key: keyof FormState, value: string) {
    setForm({ ...form, [key]: value })
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-gray-950/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-950">Novo atendimento</h2>
          <div className="flex-1" />
          <button className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Data" type="date" value={form.data_solicitacao} onChange={value => update('data_solicitacao', value)} />
          <Field label="Pedido" value={form.numero_pedido} onChange={value => update('numero_pedido', value)} />
          <Field label="Cliente" value={form.cliente} onChange={value => update('cliente', value)} />
          <Field label="Vendedor" value={form.vendedor} onChange={value => update('vendedor', value)} />
          <Field label="Codigo produto" value={form.codigo_produto} onChange={value => update('codigo_produto', value)} />
          <Field label="Produto" value={form.descricao_produto} onChange={value => update('descricao_produto', value)} />
          <Field label="Quantidade" type="number" value={form.quantidade} onChange={value => update('quantidade', value)} />
          <Field label="Valor total" type="number" value={form.valor_total} onChange={value => update('valor_total', value)} />
          <Field label="Motivo" value={form.motivo} onChange={value => update('motivo', value)} />
          <Field label="Responsavel" value={form.responsavel} onChange={value => update('responsavel', value)} />
          <Field label="Setor" value={form.setor} onChange={value => update('setor', value)} />
          <Field label="Agendado para" type="datetime-local" value={form.agendado_para} onChange={value => update('agendado_para', value)} />
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-500">Descricao da situacao</span>
            <textarea
              value={form.descricao_situacao}
              onChange={event => update('descricao_situacao', event.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 p-5">
          <button className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50" onClick={onClose}>Cancelar</button>
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onSave}>Salvar</button>
        </div>
      </div>
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
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formToPayload(form: FormState) {
  return {
    ...form,
    quantidade: form.quantidade ? Number(form.quantidade) : null,
    valor_unitario: form.valor_unitario ? Number(form.valor_unitario) : null,
    valor_total: form.valor_total ? Number(form.valor_total) : null,
    agendado_para: form.agendado_para || null,
    prioridade: form.prioridade as 'baixa' | 'normal' | 'alta' | 'urgente',
  }
}
