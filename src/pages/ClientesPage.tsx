import { useEffect, useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  LoaderCircle,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Package,
  Phone,
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
import type { Atendimento, Cliente, PcpPedido } from '../lib/types'
import { PedidoResumo } from './DashboardPage'

const PAGE_SIZE = 30

export function ClientesPage() {
  const { getToken } = useAuth()
  const { signOut } = useClerk()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [detailChamados, setDetailChamados] = useState<Atendimento[]>([])
  const [detailPedidos, setDetailPedidos] = useState<PcpPedido[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedPedidoId, setExpandedPedidoId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data, total: totalCount } = await api.clientes(getToken, { search, page, pageSize: PAGE_SIZE })
      setClientes(data)
      setTotal(totalCount)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar clientes.')
    } finally {
      setLoading(false)
    }
  }

  async function openCliente(cliente: Cliente) {
    setSelectedCliente(cliente)
    setDetailChamados([])
    setDetailPedidos([])
    setExpandedPedidoId(null)
    setDetailLoading(true)
    try {
      const [chamadosResult, pedidosResult] = await Promise.all([
        api.clienteChamados(getToken, cliente.codigo_cliente),
        api.pcpPedidosCliente(getToken, cliente.codigo_cliente),
      ])
      setDetailChamados(chamadosResult.data)
      setDetailPedidos(pedidosResult.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar detalhes do cliente.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function sincronizar() {
    setSyncing(true)
    try {
      const { data } = await api.sincronizarClientes(getToken)
      toast.success(`${data.total} clientes sincronizados do PCP.`)
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar.')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    load()
  }, [page])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (page !== 1) setPage(1)
      else load()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3">
          <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-gray-950">Clientes</h1>
            <p className="text-xs text-gray-400">{total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
          </div>
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
          <Link
            to="/kanban"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
          >
            <Grid3X3 size={15} />
            Kanban
          </Link>
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

      <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6">
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nome, código ou telefone..."
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={sincronizar}
            disabled={syncing}
            title="Traz clientes novos do PCP (código e nome). Não sobrescreve dados já preenchidos."
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            Sincronizar do ERP
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {loading ? (
            <div className="grid h-60 place-items-center text-gray-400">
              <LoaderCircle className="animate-spin" size={28} />
            </div>
          ) : clientes.length === 0 ? (
            <div className="grid h-60 place-items-center text-sm text-gray-400">Nenhum cliente encontrado.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {clientes.map(cliente => (
                <button
                  key={cliente.codigo_cliente}
                  type="button"
                  onClick={() => openCliente(cliente)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-xs font-bold text-gray-500">
                    {cliente.codigo_cliente}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{cliente.nome ?? 'Sem nome'}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {cliente.telefone ? (
                        <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <Phone size={11} />
                          {formatPhone(cliente.telefone)}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">Sem telefone</p>
                      )}
                      {cliente.vendedor && <p className="text-xs text-gray-400">Vendedor: {cliente.vendedor}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {cliente.chamados} chamado{cliente.chamados !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <p className="text-xs font-medium text-gray-500">Página {page} de {totalPages}</p>
            <button
              type="button"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </main>

      {selectedCliente && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-gray-950/30 p-4 backdrop-blur-sm"
          onMouseDown={() => setSelectedCliente(null)}
        >
          <div
            className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-950">{selectedCliente.nome ?? 'Cliente sem nome'}</h2>
                <p className="text-xs text-gray-400">
                  Código {selectedCliente.codigo_cliente}
                  {selectedCliente.cpf_cnpj ? ` · CPF/CNPJ ${selectedCliente.cpf_cnpj}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-600">
                  {[selectedCliente.telefone1, selectedCliente.telefone2, selectedCliente.telefone3]
                    .filter((value, index, arr) => value && arr.indexOf(value) === index)
                    .map(value => (
                      <span key={value} className="flex items-center gap-1 text-emerald-700">
                        <Phone size={11} />
                        {value}
                      </span>
                    ))}
                  {!selectedCliente.telefone1 && !selectedCliente.telefone2 && !selectedCliente.telefone3 && selectedCliente.telefone && (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Phone size={11} />
                      {formatPhone(selectedCliente.telefone)}
                    </span>
                  )}
                  {(selectedCliente.email1 || selectedCliente.email2) && (
                    <span>{[selectedCliente.email1, selectedCliente.email2].filter(Boolean).join(' · ')}</span>
                  )}
                  {selectedCliente.contato && <span>Contato: {selectedCliente.contato}</span>}
                  {selectedCliente.vendedor && <span>Vendedor: {selectedCliente.vendedor}</span>}
                </div>
                {(selectedCliente.endereco || selectedCliente.cidade) && (
                  <p className="mt-1 text-xs text-gray-500">
                    {[
                      [selectedCliente.endereco, selectedCliente.numero].filter(Boolean).join(', '),
                      selectedCliente.bairro,
                      [selectedCliente.cidade, selectedCliente.uf].filter(Boolean).join('/'),
                      selectedCliente.cep,
                    ]
                      .filter(Boolean)
                      .join(' — ')}
                  </p>
                )}
              </div>
              <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={() => setSelectedCliente(null)}>
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="grid h-40 place-items-center text-gray-400">
                <LoaderCircle className="animate-spin" size={26} />
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <MessageCircle size={16} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-950">Chamados</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{detailChamados.length}</span>
                  </div>
                  {detailChamados.length === 0 ? (
                    <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">Nenhum chamado para este cliente.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailChamados.map(item => {
                        const tone = getStatusTone(item.status)
                        return (
                          <Link
                            key={item.id}
                            to={`/chamados?abrir=${item.id}`}
                            className="block rounded-xl border border-gray-200 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-bold">#{item.numero_pedido || 'sem pedido'}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone.badge}`}>{item.status}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-500">{item.descricao_produto || item.motivo || 'Sem descrição'}</p>
                            <p className="mt-2 text-[11px] font-medium text-gray-400">{date(item.data_solicitacao)}</p>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <Package size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-950">Pedidos</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{detailPedidos.length}</span>
                  </div>
                  {detailPedidos.length === 0 ? (
                    <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">Nenhum pedido para este cliente.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailPedidos.map(pedido => (
                        <div key={pedido.id} className="overflow-hidden rounded-xl border border-gray-200">
                          <button
                            type="button"
                            onClick={() => setExpandedPedidoId(prev => (prev === pedido.id ? null : pedido.id))}
                            className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-gray-50"
                          >
                            <p className="min-w-0 flex-1 truncate text-sm font-bold">#{pedido.codigo_venda}</p>
                            {pedido.situacao_erp && (
                              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{pedido.situacao_erp}</span>
                            )}
                            <p className="shrink-0 text-[11px] font-medium text-gray-400">{date(pedido.data_pedido)}</p>
                            <ChevronRight size={15} className={`shrink-0 text-gray-400 transition-transform duration-300 ${expandedPedidoId === pedido.id ? 'rotate-90' : ''}`} />
                          </button>
                          <div
                            className={`grid transition-all duration-300 ease-in-out ${expandedPedidoId === pedido.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                          >
                            <div className="overflow-hidden">
                              <div className="border-t border-gray-100 p-3 pt-3">
                                <PedidoResumo pedido={pedido} compact />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatPhone(value?: string | null) {
  const phone = String(value || '').replace(/\D/g, '')
  if (phone.length < 10) return phone || '-'
  return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4)}`
}

function date(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}
