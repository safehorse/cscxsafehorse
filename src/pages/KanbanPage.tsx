import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import logoSrc from '../assets/logo.png'
import { UserNameButton } from '../components/UserNameButton'
import { api } from '../lib/api'
import { getStatusTone } from '../lib/statusStyles'
import type { Atendimento, CadastroOptions } from '../lib/types'
import { DetailDrawer, formToPayload, type WizardForm } from './DashboardPage'

const DEFAULT_STATUS_ORDER = [
  'ABERTO',
  'PENDENTE',
  'AGUARDANDO DEVOLUÇÃO',
  'EM ANÁLISE',
  'EM PRODUÇÃO',
  'CRÉDITO GERADO',
  'TROCA GERADA',
  'FINALIZADO',
]

const STORAGE_KEY = 'cscx-kanban-column-order'

export function KanbanPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [items, setItems] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadColumnOrder())
  const [draggingStatus, setDraggingStatus] = useState<string | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<number | null>(null)
  const [cadastros, setCadastros] = useState<CadastroOptions>({ setores: [], responsaveis: [], proximasAcoes: [] })
  const [selected, setSelected] = useState<Atendimento | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [note, setNote] = useState('')

  const statuses = useMemo(() => {
    const found = unique(items.map(item => item.status).filter(Boolean))
    return mergeOrder(columnOrder, unique([...DEFAULT_STATUS_ORDER, ...found]))
  }, [items, columnOrder])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(item => [
      item.numero_pedido,
      item.codigo_cliente,
      item.cliente,
      item.codigo_produto,
      item.descricao_produto,
      item.motivo,
      item.responsavel,
      item.setor,
    ].some(value => String(value || '').toLowerCase().includes(term)))
  }, [items, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Atendimento[]>()
    for (const status of statuses) map.set(status, [])
    for (const item of filtered) {
      const key = item.status || 'ABERTO'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [filtered, statuses])

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.kanbanAtendimentos(getToken)
      setItems(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar Kanban.')
    } finally {
      setLoading(false)
    }
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
      setItems(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      toast.success('Status atualizado.')
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
      setItems(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      toast.success('Reembolso salvo.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar reembolso.')
    }
  }

  async function saveAtendimentoChanges(id: string, form: WizardForm) {
    try {
      const { data } = await api.updateAtendimento(getToken, id, formToPayload(form))
      setSelected(prev => prev ? { ...prev, ...data } : data)
      setItems(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      toast.success('Chamado atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar chamado.')
      throw error
    }
  }

  async function addNote(produtoId?: string | null, produtoDescricao?: string | null) {
    if (!selected || !note.trim()) return
    try {
      await api.addInteracao(getToken, selected.id, { tipo: 'nota', descricao: note.trim(), produto_id: produtoId, produto_descricao: produtoDescricao })
      setNote('')
      await openDetail(selected.id)
      toast.success('Histórico atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar nota.')
    }
  }

  async function reabrirChamado(motivo: string, produtoId: string, produtoDescricao: string | null) {
    if (!selected) return
    try {
      const { data } = await api.reabrirAtendimento(getToken, selected.id, { motivo, produto_id: produtoId, produto_descricao: produtoDescricao })
      setSelected(prev => prev ? { ...prev, ...data } : data)
      setItems(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item))
      await openDetail(selected.id)
      toast.success('Chamado reaberto.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao reabrir chamado.')
      throw error
    }
  }

  async function deleteChamado() {
    if (!selected) return
    try {
      await api.deleteAtendimento(getToken, selected.id)
      setItems(prev => prev.filter(item => item.id !== selected.id))
      setSelected(null)
      toast.success('Chamado excluído.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao excluir chamado.')
    }
  }

  async function loadPedidoFromPcp() {
    if (!selected?.numero_pedido) return null
    try {
      const { data } = await api.pcpPedido(getToken, selected.numero_pedido)
      if (!data) toast.warning('Pedido não encontrado no PCP.')
      else toast.success('Pedido encontrado no PCP.')
      return data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao consultar PCP.')
      return null
    }
  }

  async function syncPedidoFromPcp() {
    if (!selected?.numero_pedido) return null
    const { data } = await api.pcpPedidoSync(getToken, selected.numero_pedido)
    if (!data) toast.warning('Pedido não encontrado no ERP.')
    return data
  }

  function persistOrder(nextOrder: string[]) {
    setColumnOrder(nextOrder)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextOrder))
  }

  function moveColumn(status: string, direction: -1 | 1) {
    const from = statuses.indexOf(status)
    const to = from + direction
    if (from < 0 || to < 0 || to >= statuses.length) return
    persistOrder(arrayMove(statuses, from, to))
  }

  function dropColumn(targetStatus: string) {
    if (!draggingStatus || draggingStatus === targetStatus) return
    const from = statuses.indexOf(draggingStatus)
    const to = statuses.indexOf(targetStatus)
    if (from < 0 || to < 0) return
    persistOrder(arrayMove(statuses, from, to))
    setDraggingStatus(null)
  }

  async function dropCard(targetStatus: string) {
    const itemId = draggingItemId
    setDraggingItemId(null)
    setDragOverStatus(null)
    if (!itemId) return
    const item = items.find(entry => entry.id === itemId)
    if (!item || item.status === targetStatus) return
    if (item.status === 'FINALIZADO') {
      toast.warning('Chamado finalizado só reabre com motivo e produto vinculado. Abra o chamado e use "Reabrir chamado".')
      return
    }
    const previousStatus = item.status
    setItems(prev => prev.map(entry => entry.id === itemId ? { ...entry, status: targetStatus } : entry))
    try {
      await api.updateAtendimento(getToken, itemId, { status: targetStatus })
    } catch (error) {
      setItems(prev => prev.map(entry => entry.id === itemId ? { ...entry, status: previousStatus } : entry))
      toast.error(error instanceof Error ? error.message : 'Falha ao mover chamado.')
    }
  }

  function handleColumnDrop(targetStatus: string) {
    stopAutoScroll()
    if (draggingItemId) dropCard(targetStatus)
    else if (draggingStatus) dropColumn(targetStatus)
  }

  function stopAutoScroll() {
    if (autoScrollRef.current != null) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }

  function startAutoScroll(speed: number) {
    if (autoScrollRef.current != null) return
    const step = () => {
      const el = boardScrollRef.current
      if (el) el.scrollLeft += speed
      autoScrollRef.current = requestAnimationFrame(step)
    }
    autoScrollRef.current = requestAnimationFrame(step)
  }

  function handleBoardDragOver(event: React.DragEvent<HTMLDivElement>) {
    const el = boardScrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const edge = 90
    const distanceFromLeft = event.clientX - rect.left
    const distanceFromRight = rect.right - event.clientX
    if (distanceFromLeft < edge) {
      startAutoScroll(-Math.max(6, (edge - distanceFromLeft) / 3))
    } else if (distanceFromRight < edge) {
      startAutoScroll(Math.max(6, (edge - distanceFromRight) / 3))
    } else {
      stopAutoScroll()
    }
  }

  useEffect(() => {
    load()
    reloadCadastros()
  }, [])

  useEffect(() => stopAutoScroll, [])

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) return
    api.syncUsuario(getToken, { email, nome: user.fullName }).catch(() => null)
  }, [user?.id])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-gray-950">Kanban CS/CX</h1>
              <p className="text-xs text-gray-400">Chamados por status</p>
            </div>
          </Link>
          <div className="flex-1" />
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={15} />
            Voltar
          </Link>
          <Link
            to="/chamados"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <List size={15} />
            Chamados
          </Link>
          <Link
            to="/?whatsapp=1"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <MessageSquareText size={15} />
            WhatsApp
          </Link>
          <button
            type="button"
            onClick={load}
            className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
            title="Atualizar"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
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

      <main className="min-h-0 flex-1 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Grid3X3 size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-950">Kanban</p>
                  <p className="text-xs text-gray-400">{filtered.length} chamado{filtered.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex-1" />
              <div className="relative min-w-[240px] flex-1 sm:max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar pedido, cliente, produto..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </section>

          {loading ? (
            <div className="grid h-80 place-items-center rounded-2xl border border-gray-200 bg-white text-gray-400">
              <LoaderCircle className="animate-spin" size={30} />
            </div>
          ) : (
            <section
              ref={boardScrollRef}
              onDragOver={handleBoardDragOver}
              onDragLeave={stopAutoScroll}
              onDrop={stopAutoScroll}
              className="min-h-[calc(100vh-214px)] overflow-x-auto pb-2"
            >
              <div className="flex min-w-max gap-4">
                {statuses.map((status, index) => {
                  const tone = getStatusTone(status)
                  const rows = grouped.get(status) ?? []
                  return (
                    <article
                      key={status}
                      onDragOver={event => {
                        event.preventDefault()
                        if (draggingItemId) setDragOverStatus(status)
                      }}
                      onDragLeave={() => setDragOverStatus(prev => prev === status ? null : prev)}
                      onDrop={() => handleColumnDrop(status)}
                      className={`flex h-[calc(100vh-226px)] w-80 shrink-0 flex-col rounded-2xl border bg-white shadow-sm transition-all ${draggingStatus === status ? 'scale-[0.99] opacity-60' : ''} ${dragOverStatus === status ? 'ring-2 ring-blue-400' : ''} ${tone.card}`}
                    >
                      <div
                        draggable
                        onDragStart={() => setDraggingStatus(status)}
                        onDragEnd={() => {
                          setDraggingStatus(null)
                          stopAutoScroll()
                        }}
                        className="shrink-0 cursor-grab border-b border-white/70 p-3 active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                          <h2 className={`min-w-0 flex-1 truncate text-sm font-bold ${tone.text}`}>{status}</h2>
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-gray-700">{rows.length}</span>
                          <button
                            type="button"
                            onClick={() => moveColumn(status, -1)}
                            disabled={index === 0}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-gray-500 hover:bg-white disabled:opacity-30"
                            title="Mover coluna para esquerda"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(status, 1)}
                            disabled={index === statuses.length - 1}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-gray-500 hover:bg-white disabled:opacity-30"
                            title="Mover coluna para direita"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                        {rows.length === 0 ? (
                          <div className="grid h-28 place-items-center rounded-xl border border-dashed border-white/80 bg-white/40 text-center text-xs font-medium text-gray-400">
                            Sem chamados
                          </div>
                        ) : (
                          rows.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openDetail(item.id)}
                              draggable
                              onDragStart={event => {
                                event.dataTransfer.effectAllowed = 'move'
                                setDraggingItemId(item.id)
                              }}
                              onDragEnd={() => {
                                setDraggingItemId(null)
                                setDragOverStatus(null)
                                stopAutoScroll()
                              }}
                              className={`block w-full cursor-grab rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 active:cursor-grabbing ${draggingItemId === item.id ? 'opacity-40' : ''}`}
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <p className="min-w-0 truncate text-sm font-bold text-gray-950">#{item.numero_pedido ?? 'sem pedido'}</p>
                                {item.prioridade && item.prioridade !== 'normal' && (
                                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">{item.prioridade}</span>
                                )}
                              </div>
                              <p className="truncate text-sm font-medium text-gray-700">{item.cliente ?? 'Cliente não informado'}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">{item.descricao_produto ?? item.motivo ?? 'Sem descrição'}</p>
                              {item.whatsapp_telefone && (
                                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <Phone size={11} />
                                  {formatPhone(item.whatsapp_telefone)}
                                </p>
                              )}
                              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-medium text-gray-400">
                                <span className="truncate">{item.responsavel ?? 'Sem responsável'}</span>
                                <span>{date(item.data_solicitacao)}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {selected && (
        <DetailDrawer
          selected={selected}
          loading={detailLoading}
          note={note}
          setNote={setNote}
          getToken={getToken}
          cadastros={cadastros}
          onCadastroChanged={reloadCadastros}
          onClose={() => setSelected(null)}
          onSaveStatus={saveStatus}
          onSaveAtendimento={saveAtendimentoChanges}
          onSaveReembolso={saveReembolso}
          onAddNote={addNote}
          onLoadPedido={loadPedidoFromPcp}
          onSyncPedido={syncPedidoFromPcp}
          onReabrir={reabrirChamado}
          onDelete={deleteChamado}
        />
      )}
    </div>
  )
}

function loadColumnOrder() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : DEFAULT_STATUS_ORDER
  } catch {
    return DEFAULT_STATUS_ORDER
  }
}

function mergeOrder(savedOrder: string[], statuses: string[]) {
  const known = savedOrder.filter(status => statuses.includes(status))
  const missing = statuses.filter(status => !known.includes(status))
  return [...known, ...missing]
}

function arrayMove(items: string[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function unique(items: string[]) {
  return Array.from(new Set(items))
}

function date(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}

function formatPhone(value?: string | null) {
  const phone = String(value || '').replace(/\D/g, '')
  if (phone.length < 10) return phone || '-'
  return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4)}`
}
