import type { Atendimento, DashboardData } from './types'

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

  atendimentos: (getToken: () => Promise<string | null>, filters: { search?: string; status?: string; responsavel?: string }) => {
    const qs = new URLSearchParams()
    if (filters.search) qs.set('search', filters.search)
    if (filters.status) qs.set('status', filters.status)
    if (filters.responsavel) qs.set('responsavel', filters.responsavel)
    return request<{ data: Atendimento[] }>(`/api/atendimentos?${qs.toString()}`, getToken)
  },

  atendimento: (getToken: () => Promise<string | null>, id: string) =>
    request<{ data: Atendimento }>(`/api/atendimentos/${id}`, getToken),

  createAtendimento: (getToken: () => Promise<string | null>, body: Partial<Atendimento>) =>
    request<{ data: Atendimento }>('/api/atendimentos', getToken, { method: 'POST', body: JSON.stringify(body) }),

  updateAtendimento: (getToken: () => Promise<string | null>, id: string, body: Partial<Atendimento>) =>
    request<{ data: Atendimento }>(`/api/atendimentos/${id}`, getToken, { method: 'PATCH', body: JSON.stringify(body) }),

  addInteracao: (getToken: () => Promise<string | null>, id: string, body: { tipo: string; descricao: string }) =>
    request(`/api/atendimentos/${id}/interacoes`, getToken, { method: 'POST', body: JSON.stringify(body) }),

  pcpPedido: (getToken: () => Promise<string | null>, codigo: string) =>
    request<{ data: unknown }>(`/api/pcp/pedidos/${encodeURIComponent(codigo)}`, getToken),
}
