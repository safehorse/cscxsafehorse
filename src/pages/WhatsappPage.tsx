import { useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Unlink,
} from 'lucide-react'
import { toast } from 'sonner'
import logoSrc from '../assets/logo.png'
import { UserNameButton } from '../components/UserNameButton'
import { api } from '../lib/api'
import { getStatusTone } from '../lib/statusStyles'
import type { Atendimento, WhatsappChat, WhatsappClienteSugestao, WhatsappContato, WhatsappMensagem, WhatsappStatus } from '../lib/types'

type Selection = {
  contato: WhatsappContato | null
  mensagens: WhatsappMensagem[]
  chamados: Atendimento[]
}

const initialStatus: WhatsappStatus = {
  status: 'desconectado',
  qr: null,
  erro: null,
  connected_at: null,
  updated_at: new Date().toISOString(),
}

export function WhatsappPage() {
  const { getToken } = useAuth()
  const { signOut } = useClerk()
  const [status, setStatus] = useState<WhatsappStatus>(initialStatus)
  const [chats, setChats] = useState<WhatsappChat[]>([])
  const [selectedChat, setSelectedChat] = useState<WhatsappChat | null>(null)
  const [selection, setSelection] = useState<Selection>({ contato: null, mensagens: [], chamados: [] })
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingChats, setLoadingChats] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [codigoCliente, setCodigoCliente] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [sugestoes, setSugestoes] = useState<WhatsappClienteSugestao[]>([])

  const connected = status.status === 'conectado'
  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return chats
    return chats.filter(chat => [
      chat.nome,
      chat.telefone,
      chat.codigo_cliente,
      chat.cliente_nome,
      chat.last_message,
    ].some(value => String(value || '').toLowerCase().includes(term)))
  }, [chats, search])

  async function loadStatus(silent = false) {
    if (!silent) setLoadingStatus(true)
    try {
      const { data } = await api.whatsappStatus(getToken)
      setStatus(data)
      if (data.status === 'conectado') await loadChats(true, true)
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Falha ao consultar WhatsApp.')
    } finally {
      if (!silent) setLoadingStatus(false)
    }
  }

  async function connect() {
    setLoadingStatus(true)
    try {
      const { data } = await api.whatsappConnect(getToken)
      setStatus(data)
      toast.success('Conexão iniciada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao iniciar WhatsApp.')
    } finally {
      setLoadingStatus(false)
    }
  }

  async function disconnect() {
    setLoadingStatus(true)
    try {
      const { data } = await api.whatsappDisconnect(getToken)
      setStatus(data)
      setChats([])
      setSelectedChat(null)
      setSelection({ contato: null, mensagens: [], chamados: [] })
      toast.success('WhatsApp desconectado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao desconectar.')
    } finally {
      setLoadingStatus(false)
    }
  }

  async function loadChats(silent = false, force = false) {
    if (!force && status.status !== 'conectado') return
    if (!silent) setLoadingChats(true)
    try {
      const { data } = await api.whatsappChats(getToken)
      setChats(data)
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Falha ao carregar conversas.')
    } finally {
      if (!silent) setLoadingChats(false)
    }
  }

  async function openChat(chat: WhatsappChat) {
    setSelectedChat(chat)
    setLoadingMessages(true)
    try {
      const { data } = await api.whatsappMessages(getToken, chat.id)
      setSelection(data)
      setCodigoCliente(data.contato.codigo_cliente || '')
      setClienteNome(data.contato.cliente_nome || chat.cliente_nome || chat.nome || '')
      setObservacao(data.contato.observacao || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao abrir conversa.')
    } finally {
      setLoadingMessages(false)
    }
  }

  async function saveLink() {
    if (!selection.contato) return
    if (!codigoCliente.trim()) return toast.warning('Informe o ID do cliente no ERP.')
    setSaving(true)
    try {
      const { data } = await api.whatsappUpdateContato(getToken, selection.contato.id, {
        codigo_cliente: codigoCliente.trim(),
        cliente_nome: clienteNome.trim() || null,
        observacao: observacao.trim() || null,
      })
      setSelection(prev => ({ ...prev, contato: data.contato, chamados: data.chamados }))
      setChats(prev => prev.map(chat => chat.id === selectedChat?.id ? {
        ...chat,
        codigo_cliente: data.contato.codigo_cliente,
        cliente_nome: data.contato.cliente_nome,
      } : chat))
      toast.success('Cliente ERP vinculado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar vínculo.')
    } finally {
      setSaving(false)
    }
  }

  async function searchClientes(term: string) {
    setCodigoCliente(term)
    if (term.trim().length < 2) {
      setSugestoes([])
      return
    }
    try {
      const { data } = await api.whatsappClientes(getToken, term)
      setSugestoes(data)
    } catch {
      setSugestoes([])
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => loadStatus(true), status.status === 'conectado' ? 15000 : 4000)
    return () => window.clearInterval(timer)
  }, [status.status])

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <header className="shrink-0 border-b border-white/10 bg-gray-950 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold">WhatsApp CS/CX</h1>
            <p className="truncate text-xs text-gray-400">{statusLabel(status)}</p>
          </div>
          <div className="flex-1" />
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10"
          >
            <ArrowLeft size={15} />
            Voltar
          </Link>
          <button
            type="button"
            onClick={() => connected ? loadChats() : loadStatus()}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300 transition-colors hover:bg-white/10"
            title="Atualizar"
          >
            <RefreshCw size={15} className={loadingChats || loadingStatus ? 'animate-spin' : ''} />
          </button>
          <UserNameButton tone="dark" />
          <button
            type="button"
            onClick={() => signOut()}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-red-300 transition-colors hover:bg-red-500/10"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {!connected ? (
        <main className="grid min-h-0 flex-1 place-items-center p-4">
          <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 text-gray-950 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Smartphone size={24} />
              </div>
              <div>
                <h2 className="font-bold">Conectar WhatsApp</h2>
                <p className="text-sm text-gray-500">{statusLabel(status)}</p>
              </div>
            </div>

            {status.qr ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <img src={status.qr} alt="QR Code do WhatsApp" className="mx-auto h-72 w-72 rounded-xl bg-white p-2" />
              </div>
            ) : (
              <div className="grid h-72 place-items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
                {loadingStatus || status.status === 'iniciando' || status.status === 'autenticado' ? (
                  <LoaderCircle className="animate-spin text-emerald-600" size={30} />
                ) : (
                  <MessageCircle className="text-gray-300" size={42} />
                )}
              </div>
            )}

            {status.erro && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {status.erro}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={connect}
                disabled={loadingStatus || status.status === 'iniciando'}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {loadingStatus ? <LoaderCircle className="animate-spin" size={16} /> : <MessageCircle size={16} />}
                Conectar
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                <Unlink size={16} />
                Limpar
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 bg-gray-100 text-gray-950 lg:grid-cols-[360px_1fr_380px]">
          <aside className="min-h-0 border-r border-gray-200 bg-white">
            <div className="border-b border-gray-100 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <h2 className="text-sm font-bold">Conversas</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{chats.length}</span>
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar conversa..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="h-[calc(100vh-139px)] overflow-y-auto">
              {loadingChats ? (
                <div className="grid h-48 place-items-center text-gray-400">
                  <LoaderCircle className="animate-spin" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">Nenhuma conversa encontrada.</div>
              ) : (
                filteredChats.map(chat => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => openChat(chat)}
                    className={`flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-emerald-50 ${selectedChat?.id === chat.id ? 'bg-emerald-50' : 'bg-white'}`}
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Phone size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{chat.nome || chat.telefone}</p>
                        {chat.unread_count > 0 && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{chat.unread_count}</span>}
                      </div>
                      <p className="truncate text-xs text-gray-500">{chat.cliente_nome || chat.codigo_cliente || chat.telefone}</p>
                      <p className="mt-1 truncate text-xs text-gray-400">{chat.last_message || 'Sem prévia'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[#f3f0ea]">
            {selectedChat ? (
              <>
                <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
                  <p className="font-bold">{selectedChat.nome || selectedChat.telefone}</p>
                  <p className="text-xs text-gray-500">{formatPhone(selectedChat.telefone)}</p>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
                  {loadingMessages ? (
                    <div className="grid h-full place-items-center text-gray-500">
                      <LoaderCircle className="animate-spin" />
                    </div>
                  ) : selection.mensagens.length === 0 ? (
                    <div className="grid h-full place-items-center text-sm text-gray-500">Sem mensagens carregadas.</div>
                  ) : (
                    selection.mensagens.map(message => (
                      <div key={message.id} className={`flex ${message.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.direcao === 'saida' ? 'rounded-tr-sm bg-emerald-100' : 'rounded-tl-sm bg-white'}`}>
                          <p className="whitespace-pre-wrap break-words">{message.conteudo || `[${message.tipo || 'mensagem'}]`}</p>
                          <p className="mt-1 text-right text-[10px] font-medium text-gray-400">{time(message.enviado_em)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center p-5 text-center text-gray-500">
                <div>
                  <MessageCircle className="mx-auto mb-3 text-gray-300" size={44} />
                  <p className="text-sm font-semibold">Selecione uma conversa</p>
                </div>
              </div>
            )}
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-gray-200 bg-white">
            <div className="border-b border-gray-100 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-600" />
                <h2 className="text-sm font-bold">Cliente ERP</h2>
              </div>

              {selection.contato ? (
                <div className="space-y-3">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-500">ID do cliente ERP</span>
                    <input
                      value={codigoCliente}
                      onChange={event => searchClientes(event.target.value)}
                      placeholder="Ex.: 12345"
                      className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  {sugestoes.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      {sugestoes.map(item => (
                        <button
                          key={item.codigo_cliente}
                          type="button"
                          onClick={() => {
                            setCodigoCliente(item.codigo_cliente)
                            setClienteNome(item.cliente || '')
                            setSugestoes([])
                          }}
                          className="flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-blue-50"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900">{item.codigo_cliente}</span>
                            <span className="block truncate text-xs text-gray-500">{item.cliente || 'Cliente sem nome'}</span>
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{item.chamados}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-500">Nome do cliente</span>
                    <input
                      value={clienteNome}
                      onChange={event => setClienteNome(event.target.value)}
                      className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-gray-500">Observação</span>
                    <textarea
                      value={observacao}
                      onChange={event => setObservacao(event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={saveLink}
                    disabled={saving}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
                    Salvar vínculo
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 px-3 py-8 text-center text-sm text-gray-400">Abra uma conversa para vincular.</div>
              )}
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle size={16} className="text-emerald-600" />
                <h2 className="text-sm font-bold">Chamados do cliente</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{selection.chamados.length}</span>
              </div>
              {!selection.contato ? (
                <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">Nenhum cliente selecionado.</p>
              ) : !selection.contato.codigo_cliente ? (
                <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-medium text-amber-800">Vincule o ID do cliente ERP para carregar os chamados.</p>
              ) : selection.chamados.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">Nenhum chamado para este cliente.</p>
              ) : (
                <div className="space-y-2">
                  {selection.chamados.map(item => {
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
            </div>
          </aside>
        </main>
      )}
    </div>
  )
}

function statusLabel(status: WhatsappStatus) {
  if (status.status === 'conectado') return 'Conectado ao WhatsApp Web'
  if (status.status === 'aguardando_qr') return 'Aguardando leitura do QR Code'
  if (status.status === 'autenticado') return 'Autenticado, abrindo conversas'
  if (status.status === 'iniciando') return 'Iniciando WhatsApp Web'
  if (status.status === 'erro') return 'Erro na conexão'
  return 'Desconectado'
}

function formatPhone(value?: string | null) {
  const phone = String(value || '').replace(/\D/g, '')
  if (phone.length < 10) return phone || '-'
  return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4)}`
}

function time(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function date(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}
