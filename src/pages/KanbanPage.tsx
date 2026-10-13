import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  LoaderCircle,
  Phone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { Layout } from '../components/Layout'
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

const CUSTOM_COLUMNS_KEY = 'cscx-kanban-custom-columns'

const NAMES_KEY = 'cscx-kanban-column-names'

const STORAGE_KEY = 'cscx-kanban-column-order'

export function KanbanPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [items, setItems] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [columnOrder, setColumnOrder] = useState<string[]>(() => loadColumnOrder())
  const [customColumns, setCustomColumns] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(CUSTOM_COLUMNS_KEY) || '[]')
      return Array.isArray(value) ? unique(value.filter(entry => typeof entry === 'string' && entry.trim())) : []
    } catch { return [] }
  })
  const [creatingColumn, setCreatingColumn] = useState(false)
  const [deletedColumns, setDeletedColumns] = useState<string[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem('cscx-kanban-deleted-columns') || '[]')
      return Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : []
    } catch { return [] }
  })
  const [columnNames, setColumnNames] = useState<Record<string, string>>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}')
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    } catch { return {} }
  })
  const [editingColumn, setEditingColumn] = useState<string | null>(null)
  const [columnName, setColumnName] = useState('')
  const [columnPosition, setColumnPosition] = useState(1)
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
    return mergeOrder(columnOrder, unique([...unique([...DEFAULT_STATUS_ORDER, ...customColumns]).filter(status => !deletedColumns.includes(status)), ...found]))
  }, [items, columnOrder, deletedColumns, customColumns])

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

  async function saveStatus(nextStatus: string, resultado?: string, detalhes?: string) {
    if (!selected) return
    try {
      const isDone = ['FINALIZADO', 'CONCLUIDO'].includes(nextStatus)
      const { data } = await api.updateAtendimento(getToken, selected.id, {
        status: nextStatus,
        ...(resultado !== undefined ? { finalizacao_resultado: resultado || null, finalizacao_detalhes: detalhes?.trim() || null } : {}),
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
      toast.success('Crédito salvo.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar crédito.')
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
    if (targetStatus === 'FINALIZADO') {
      await openDetail(itemId)
      toast.info('Selecione Finalizado e informe os detalhes da finalização.')
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
    <Layout>
      <div className="min-h-0 flex-1 px-4 py-5 sm:px-6">
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
              <button type="button" onClick={() => { setCreatingColumn(true); setEditingColumn(null); setColumnName(''); setColumnPosition(statuses.length + 1) }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} />Nova coluna</button>
              <div className="relative min-w-[240px] flex-1 sm:max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar pedido, cliente, produto..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                type="button"
                onClick={load}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
                title="Atualizar"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
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
                          <h2 className={`min-w-0 flex-1 truncate text-sm font-bold ${tone.text}`}>{columnNames[status] || status}</h2>
                          <button type="button" title="Editar nome e posição da coluna" onClick={() => { setEditingColumn(status); setColumnName(columnNames[status] || status); setColumnPosition(index + 1) }} className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-gray-500 hover:bg-white"><Pencil size={14} /></button>
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
                              {item.status === 'FINALIZADO' && (item.finalizacao_resultado || item.finalizacao_detalhes) && <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800"><p className="font-semibold">{item.finalizacao_resultado}</p><p className="line-clamp-2">{item.finalizacao_detalhes}</p></div>}
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
      </div>

      {(editingColumn || creatingColumn) && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={creatingColumn ? 'Nova coluna' : 'Editar coluna'}>
        <form className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5" onSubmit={event => {
          event.preventDefault()
          if (!columnName.trim()) return
          if (creatingColumn) {
            const status = normalizeColumnStatus(columnName)
            const duplicate = statuses.some(entry => normalizeColumnStatus(entry) === status || normalizeColumnStatus(columnNames[entry] || entry) === status)
            if (duplicate) { toast.warning('Já existe uma coluna com esse nome.'); return }
            const custom = unique([...customColumns, status])
            const deleted = deletedColumns.filter(entry => entry !== status)
            const names = { ...columnNames, [status]: columnName.trim() }
            const order = [...statuses]
            order.splice(Math.min(columnPosition - 1, order.length), 0, status)
            try {
              localStorage.setItem(CUSTOM_COLUMNS_KEY, JSON.stringify(custom))
              localStorage.setItem('cscx-kanban-deleted-columns', JSON.stringify(deleted))
              localStorage.setItem(NAMES_KEY, JSON.stringify(names))
              persistOrder(order)
              setCustomColumns(custom)
              setDeletedColumns(deleted)
              setColumnNames(names)
              setCreatingColumn(false)
              toast.success('Coluna criada.')
            } catch { toast.error('Não foi possível criar a coluna no navegador.') }
            return
          }
          if (!editingColumn) return
          const names = { ...columnNames, [editingColumn]: columnName.trim() }
          try {
            localStorage.setItem(NAMES_KEY, JSON.stringify(names))
            persistOrder(arrayMove(statuses, statuses.indexOf(editingColumn), columnPosition - 1))
            setColumnNames(names)
            setEditingColumn(null)
            toast.success('Coluna atualizada.')
          } catch { toast.error('Não foi possível salvar a coluna no navegador.') }
        }}>
          <h2 className="font-bold">{creatingColumn ? 'Nova coluna' : 'Editar coluna'}</h2>
          <label className="block text-sm">Nome<input required maxLength={80} value={columnName} onChange={event => setColumnName(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
          <label className="block text-sm">Posição<select value={columnPosition} onChange={event => setColumnPosition(Number(event.target.value))} className="mt-1 w-full rounded-lg border p-2">{Array.from({ length: statuses.length + (creatingColumn ? 1 : 0) }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
          {editingColumn && <button type="button" disabled={items.some(item => (item.status || 'ABERTO') === editingColumn)} title="Mova os chamados antes de excluir a coluna" onClick={() => {
            const next = unique([...deletedColumns, editingColumn])
            try {
              localStorage.setItem('cscx-kanban-deleted-columns', JSON.stringify(next))
              setDeletedColumns(next)
              setEditingColumn(null)
              toast.success('Coluna excluída do quadro.')
            } catch { toast.error('Não foi possível excluir a coluna no navegador.') }
          }} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 disabled:opacity-40">Excluir coluna</button>}
          {items.some(item => (item.status || 'ABERTO') === editingColumn) && <p className="text-xs text-gray-500">Mova todos os chamados desta coluna antes de excluir.</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingColumn(null); setCreatingColumn(false) }} className="rounded-lg border px-3 py-2">Cancelar</button><button className="rounded-lg bg-blue-600 px-3 py-2 text-white">Salvar</button></div>
        </form>
      </div>}
      {selected && (
        <DetailDrawer
          statusOptions={statuses}
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
    </Layout>
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

function normalizeColumnStatus(name: string) {
  const status = name.trim().toUpperCase()
  const key = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return DEFAULT_STATUS_ORDER.find(entry => entry.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === key) || status
}
