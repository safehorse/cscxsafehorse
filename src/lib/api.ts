import type {
  Atendimento,
  CadastroOptions,
  Cliente,
  ClienteSugestao,
  DashboardData,
  PcpPedido,
  PcpPedidoResumo,
  ProdutoSugestao,
  Usuario,
  WhatsappExtensaoStatus,
} from './types'

const API_URL = (import.meta.env.VITE_CSCX_API_URL as string || '').replace(/\/$/, '')

export class ApiError extends Error {}

export interface AtendimentoFilters {
  search?: string
  status?: string
  responsavel?: string
  dateFrom?: string
  dateTo?: string
  year?: string
  page?: number
  pageSize?: number
}

async function request<T>(path: string, getToken: () => Promise<string | null>, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || `Erro HTTP ${response.status}`)
  return sanitizeResponse(data) as T
}

export const api = {
  dashboard: (getToken: () => Promise<string | null>, filters: AtendimentoFilters = {}) => {
    const qs = buildAtendimentoQuery(filters)
    return request<DashboardData>(`/api/dashboard?${qs.toString()}`, getToken)
  },

  agenda: (getToken: () => Promise<string | null>, filters: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (filters.from) qs.set('from', filters.from)
    if (filters.to) qs.set('to', filters.to)
    return request<{ data: Atendimento[] }>(`/api/agenda?${qs.toString()}`, getToken)
  },

  usuarios: (getToken: () => Promise<string | null>) =>
    request<{ data: Usuario[] }>('/api/usuarios', getToken),

  syncUsuario: (getToken: () => Promise<string | null>, body: { email: string; nome?: string | null }) =>
    request<{ data: Usuario }>('/api/usuarios/me', getToken, { method: 'POST', body: JSON.stringify(body) }),

  updateMeuUsuario: (getToken: () => Promise<string | null>, body: { nome: string; email?: string | null }) =>
    request<{ data: Usuario }>('/api/usuarios/me', getToken, { method: 'PATCH', body: JSON.stringify(body) }),

  saveUsuario: (getToken: () => Promise<string | null>, body: { email: string; nome?: string | null; papel: 'admin' | 'cs'; ativo?: boolean }) =>
    request<{ data: Usuario }>('/api/usuarios', getToken, { method: 'POST', body: JSON.stringify(body) }),

  updateUsuario: (getToken: () => Promise<string | null>, id: string, body: Partial<Pick<Usuario, 'email' | 'nome' | 'papel' | 'ativo'>>) =>
    request<{ data: Usuario }>(`/api/usuarios/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(body) }),

  inviteUsuario: (getToken: () => Promise<string | null>, id: string) =>
    request<{ data: Usuario; convite: { id: string | null; status: string; email: string } }>(`/api/usuarios/${id}/convite`, getToken, { method: 'POST' }),

  atendimentos: (getToken: () => Promise<string | null>, filters: AtendimentoFilters) => {
    const qs = buildAtendimentoQuery(filters)
    return request<{ data: Atendimento[]; total: number; page: number; pageSize: number }>(`/api/atendimentos?${qs.toString()}`, getToken)
  },

  atendimento: (getToken: () => Promise<string | null>, id: string) =>
    request<{ data: Atendimento }>(`/api/atendimentos/${id}`, getToken),

  kanbanAtendimentos: (getToken: () => Promise<string | null>, filters: AtendimentoFilters = {}) => {
    const qs = buildAtendimentoQuery(filters)
    return request<{ data: Atendimento[] }>(`/api/kanban/atendimentos?${qs.toString()}`, getToken)
  },

  createAtendimento: (getToken: () => Promise<string | null>, body: Partial<Atendimento>) =>
    request<{ data: Atendimento }>('/api/atendimentos', getToken, { method: 'POST', body: JSON.stringify(body) }),

  updateAtendimento: (getToken: () => Promise<string | null>, id: string, body: Partial<Atendimento>) =>
    request<{ data: Atendimento }>(`/api/atendimentos/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(body) }),

  addInteracao: (getToken: () => Promise<string | null>, id: string, body: { tipo: string; descricao: string }) =>
    request(`/api/atendimentos/${id}/interacoes`, getToken, { method: 'POST', body: JSON.stringify(body) }),

  cadastros: (getToken: () => Promise<string | null>) =>
    request<CadastroOptions>('/api/cadastros', getToken),

  createSetor: (getToken: () => Promise<string | null>, nome: string) =>
    request('/api/cadastros/setores', getToken, { method: 'POST', body: JSON.stringify({ nome }) }),

  createResponsavel: (getToken: () => Promise<string | null>, nome: string) =>
    request('/api/cadastros/responsaveis', getToken, { method: 'POST', body: JSON.stringify({ nome }) }),

  createProximaAcao: (getToken: () => Promise<string | null>, nome: string) =>
    request('/api/cadastros/proximas-acoes', getToken, { method: 'POST', body: JSON.stringify({ nome }) }),

  pcpPedido: (getToken: () => Promise<string | null>, codigo: string) =>
    request<{ data: PcpPedido | null }>(`/api/pcp/pedidos/${encodeURIComponent(codigo)}`, getToken),

  clientes: (getToken: () => Promise<string | null>, filters: { search?: string; page?: number; pageSize?: number } = {}) => {
    const qs = new URLSearchParams()
    if (filters.search) qs.set('search', filters.search)
    if (filters.page) qs.set('page', String(filters.page))
    if (filters.pageSize) qs.set('pageSize', String(filters.pageSize))
    return request<{ data: Cliente[]; total: number; page: number; pageSize: number }>(`/api/clientes?${qs.toString()}`, getToken)
  },

  sincronizarClientes: (getToken: () => Promise<string | null>) =>
    request<{ data: { total: number } }>('/api/clientes/sync', getToken, { method: 'POST' }),

  clienteChamados: (getToken: () => Promise<string | null>, codigo: string) =>
    request<{ data: Atendimento[] }>(`/api/clientes/${encodeURIComponent(codigo)}/chamados`, getToken),

  pcpPedidosCliente: (getToken: () => Promise<string | null>, codigoCliente: string) =>
    request<{ data: PcpPedido[] }>(`/api/pcp/clientes/${encodeURIComponent(codigoCliente)}/pedidos`, getToken),

  pcpBuscarPedidos: (getToken: () => Promise<string | null>, filters: { clientes?: string[]; produtoId?: string }) => {
    const qs = new URLSearchParams()
    if (filters.clientes?.length) qs.set('clientes', filters.clientes.join(','))
    if (filters.produtoId) qs.set('produtoId', filters.produtoId)
    return request<{ data: PcpPedidoResumo[] }>(`/api/pcp/pedidos?${qs.toString()}`, getToken)
  },

  buscarClientesSugestao: (getToken: () => Promise<string | null>, search: string) =>
    request<{ data: ClienteSugestao[] }>(`/api/whatsapp/clientes?search=${encodeURIComponent(search)}`, getToken),

  buscarProdutosSugestao: (getToken: () => Promise<string | null>, search: string) =>
    request<{ data: ProdutoSugestao[] }>(`/api/pcp/produtos?search=${encodeURIComponent(search)}`, getToken),

  whatsappExtensaoStatus: (getToken: () => Promise<string | null>) =>
    request<{ data: WhatsappExtensaoStatus | null }>('/api/whatsapp/extensao', getToken),

  whatsappExtensaoToken: (getToken: () => Promise<string | null>) =>
    request<{ data: WhatsappExtensaoStatus }>('/api/whatsapp/extensao/token', getToken, { method: 'POST' }),
}

function buildAtendimentoQuery(filters: AtendimentoFilters) {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.status) qs.set('status', filters.status)
  if (filters.responsavel) qs.set('responsavel', filters.responsavel)
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) qs.set('dateTo', filters.dateTo)
  if (filters.year) qs.set('year', filters.year)
  if (filters.page) qs.set('page', String(filters.page))
  if (filters.pageSize) qs.set('pageSize', String(filters.pageSize))
  return qs
}

function sanitizeResponse(value: unknown): unknown {
  if (typeof value === 'string') return fixImportedText(value)
  if (Array.isArray(value)) return value.map(sanitizeResponse)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeResponse(item)]))
  }
  return value
}

function fixImportedText(value: string) {
  return value
    .replace(/\?\?ES/g, 'ÇÕES')
    .replace(/\?\?es/g, 'ções')
    .replace(/\?\?O/g, 'ÇÃO')
    .replace(/\?\?o/g, 'ção')
    .replace(/SOLICITA\?AO/g, 'SOLICITAÇÃO')
    .replace(/PRODU\?AO/g, 'PRODUÇÃO')
    .replace(/SEPARA\?AO/g, 'SEPARAÇÃO')
    .replace(/PROTE\?AO/g, 'PROTEÇÃO')
    .replace(/DEVOLU\?AO/g, 'DEVOLUÇÃO')
    .replace(/INFORMA\?OES/g, 'INFORMAÇÕES')
    .replace(/CORRE\?AO/g, 'CORREÇÃO')
    .replace(/AVALIA\?AO/g, 'AVALIAÇÃO')
    .replace(/CONFIRMA\?AO/g, 'CONFIRMAÇÃO')
    .replace(/ACEITA\?AO/g, 'ACEITAÇÃO')
    .replace(/OP\?AO/g, 'OPÇÃO')
    .replace(/solicita\?ao/g, 'solicitação')
    .replace(/produ\?ao/g, 'produção')
    .replace(/corre\?ao/g, 'correção')
    .replace(/avalia\?ao/g, 'avaliação')
    .replace(/confirma\?ao/g, 'confirmação')
    .replace(/aceita\?ao/g, 'aceitação')
    .replace(/op\?ao/g, 'opção')
    .replace(/CAL\?A/g, 'CALÇA')
    .replace(/cal\?a/g, 'calça')
    .replace(/CABE\?ADA/g, 'CABEÇADA')
    .replace(/cabe\?ada/g, 'cabeçada')
    .replace(/CABE\?A/g, 'CABEÇA')
    .replace(/PE\?AS/g, 'PEÇAS')
    .replace(/pe\?as/g, 'peças')
    .replace(/PE\?A/g, 'PEÇA')
    .replace(/pe\?a/g, 'peça')
    .replace(/LA\?O/g, 'LAÇO')
    .replace(/la\?o/g, 'laço')
    .replace(/CR\?DITO/g, 'CRÉDITO')
    .replace(/C\?REDITO/g, 'CRÉDITO')
    .replace(/cr\?dito/g, 'crédito')
    .replace(/N\?O/g, 'NÃO')
    .replace(/n\?o/g, 'não')
    .replace(/ALGOD\?O/g, 'ALGODÃO')
    .replace(/FERR\?O/g, 'FERRÃO')
    .replace(/ferr\?o/g, 'ferrão')
    .replace(/CAF\?/g, 'CAFÉ')
    .replace(/CAMUR\?A/g, 'CAMURÇA')
    .replace(/CHAP\?U/g, 'CHAPÉU')
    .replace(/chap\?u/g, 'chapéu')
    .replace(/chap\?us/g, 'chapéus')
    .replace(/DIFEREN\?A/g, 'DIFERENÇA')
    .replace(/realizar\?/g, 'realizará')
    .replace(/ser\?/g, 'será')
    .replace(/respons\?vel/g, 'responsável')
    .replace(/equ\?voco/g, 'equívoco')
    .replace(/ap\?s/g, 'após')
    .replace(/Ap\?s/g, 'Após')
    .replace(/j\?/g, 'já')
    .replace(/\?poca/g, 'época')
    .replace(/necess\?rio/g, 'necessário')
    .replace(/NECESS\?RIO/g, 'NECESSÁRIO')
    .replace(/necess\?ria/g, 'necessária')
    .replace(/an\?lise/g, 'análise')
    .replace(/aus\?ncia/g, 'ausência')
    .replace(/at\?/g, 'até')
    .replace(/AT\?/g, 'ATÉ')
    .replace(/confer\?ncia/g, 'conferência')
    .replace(/ocorr\?ncia/g, 'ocorrência')
    .replace(/espec\?ficas/g, 'específicas')
    .replace(/v\?rios/g, 'vários')
    .replace(/inclu\?das/g, 'incluídas')
    .replace(/tamb\?m/g, 'também')
    .replace(/por\?m/g, 'porém')
    .replace(/POR\?M/g, 'PORÉM')
    .replace(/est\?o/g, 'estão')
    .replace(/EST\?O/g, 'ESTÃO')
    .replace(/estav\?o/g, 'estavam')
    .replace(/OT\?VIO/g, 'OTÁVIO')
    .replace(/ENT\?O/g, 'ENTÃO')
    .replace(/LAN\?OU/g, 'LANÇOU')
    .replace(/lan\?ou/g, 'lançou')
    .replace(/LAN\?ADA/g, 'LANÇADA')
    .replace(/LAN\?ADO/g, 'LANÇADO')
    .replace(/QUAL \? EXATAMENTE/g, 'QUAL É EXATAMENTE')
    .replace(/ agora \? necessário/g, ' agora é necessário')
    .replace(/ não \? indicado/g, ' não é indicado')
    .replace(/O CLIENTE \? DE/g, 'O CLIENTE É DE')
    .replace(/ENTREI \?PARA/g, 'ENTREI PARA')
    .replace(/referentes \? /g, 'referentes à ')
    .replace(/quanto \? /g, 'quanto à ')
}
