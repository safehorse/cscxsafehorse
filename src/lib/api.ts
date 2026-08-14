import type { Atendimento, CadastroOptions, DashboardData, PcpPedido, Usuario } from './types'

const API_URL = (import.meta.env.VITE_CSCX_API_URL as string || '').replace(/\/$/, '')

export class ApiError extends Error {}

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
  return data as T
}

export const api = {
  dashboard: (getToken: () => Promise<string | null>) =>
    request<DashboardData>('/api/dashboard', getToken),

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

  saveUsuario: (getToken: () => Promise<string | null>, body: { email: string; nome?: string | null; papel: 'admin' | 'cs'; ativo?: boolean }) =>
    request<{ data: Usuario }>('/api/usuarios', getToken, { method: 'POST', body: JSON.stringify(body) }),

  updateUsuario: (getToken: () => Promise<string | null>, id: string, body: Partial<Pick<Usuario, 'email' | 'nome' | 'papel' | 'ativo'>>) =>
    request<{ data: Usuario }>(`/api/usuarios/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(body) }),

  atendimentos: (getToken: () => Promise<string | null>, filters: { search?: string; status?: string; responsavel?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (filters.search) qs.set('search', filters.search)
    if (filters.status) qs.set('status', filters.status)
    if (filters.responsavel) qs.set('responsavel', filters.responsavel)
    if (filters.page) qs.set('page', String(filters.page))
    if (filters.pageSize) qs.set('pageSize', String(filters.pageSize))
    return request<{ data: Atendimento[]; total: number; page: number; pageSize: number }>(`/api/atendimentos?${qs.toString()}`, getToken)
  },

  atendimento: (getToken: () => Promise<string | null>, id: string) =>
    request<{ data: Atendimento }>(`/api/atendimentos/${id}`, getToken),

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

  pcpPedido: (getToken: () => Promise<string | null>, codigo: string) =>
    request<{ data: PcpPedido | null }>(`/api/pcp/pedidos/${encodeURIComponent(codigo)}`, getToken),
}
