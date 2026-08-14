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
import type { Cliente } from '../lib/types'

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
            to="/whatsapp"
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
                <div key={cliente.codigo_cliente} className="flex items-center gap-4 px-4 py-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gray-100 text-xs font-bold text-gray-500">
                    {cliente.codigo_cliente}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{cliente.nome ?? 'Sem nome'}</p>
                    {cliente.telefone ? (
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <Phone size={11} />
                        {formatPhone(cliente.telefone)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-400">Sem telefone</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {cliente.chamados} chamado{cliente.chamados !== 1 ? 's' : ''}
                  </span>
                </div>
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
    </div>
  )
}

function formatPhone(value?: string | null) {
  const phone = String(value || '').replace(/\D/g, '')
  if (phone.length < 10) return phone || '-'
  return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4)}`
}
