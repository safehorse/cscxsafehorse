import { useEffect, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { toast } from 'sonner'
import logoSrc from '../assets/logo.png'
import { api } from '../lib/api'
import type { Usuario } from '../lib/types'

type UsuarioForm = {
  email: string
  nome: string
  papel: 'admin' | 'cs'
  ativo: boolean
}

const emptyForm: UsuarioForm = {
  email: '',
  nome: '',
  papel: 'cs',
  ativo: true,
}

export function UsuariosPage() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<UsuarioForm>(emptyForm)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.usuarios(getToken)
      setUsuarios(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (!email) {
      load()
      return
    }

    api.syncUsuario(getToken, { email, nome: user.fullName })
      .catch(() => null)
      .finally(load)
  }, [user?.id])

  function updateForm(key: keyof UsuarioForm, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!form.email.trim()) return toast.warning('Informe o email.')
    setSaving(true)
    try {
      await api.saveUsuario(getToken, {
        email: form.email,
        nome: form.nome || null,
        papel: form.papel,
        ativo: form.ativo,
      })
      setForm(emptyForm)
      await load()
      toast.success('Usuário salvo.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar usuário.')
    } finally {
      setSaving(false)
    }
  }

  async function updateUsuario(id: string, body: Partial<Pick<Usuario, 'papel' | 'ativo'>>) {
    try {
      const { data } = await api.updateUsuario(getToken, id, body)
      setUsuarios(prev => prev.map(item => item.id === id ? data : item))
      toast.success('Usuário atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar usuário.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3">
          <img src={logoSrc} alt="Safe Horse" className="h-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold text-gray-950">Usuários CS/CX</h1>
            <p className="text-xs text-gray-400">Nomeação de admin e CS</p>
          </div>
          <div className="flex-1" />
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={15} />
            Atendimentos
          </Link>
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

      <main className="mx-auto grid max-w-[1320px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-950">Adicionar acesso</h2>
          </div>

          <div className="space-y-3">
            <label>
              <span className="mb-1 block text-xs font-medium text-gray-500">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={event => updateForm('email', event.target.value)}
                placeholder="nome@safehorse.com.br"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-gray-500">Nome</span>
              <input
                value={form.nome}
                onChange={event => updateForm('nome', event.target.value)}
                placeholder="Nome do usuário"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-medium text-gray-500">Papel</span>
              <select
                value={form.papel}
                onChange={event => updateForm('papel', event.target.value as UsuarioForm['papel'])}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="cs">CS</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={event => updateForm('ativo', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Ativo
            </label>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Salvar usuário
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 p-4">
            <UsersRound size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-950">Usuários nomeados</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{usuarios.length}</span>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16 text-gray-400">
              <LoaderCircle className="animate-spin" size={28} />
            </div>
          ) : usuarios.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">Nenhum usuário nomeado.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {usuarios.map(usuario => (
                <div key={usuario.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_140px_120px_120px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-gray-950">{usuario.nome || usuario.email}</p>
                      <RoleBadge papel={usuario.papel} />
                      {!usuario.ativo && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">Inativo</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-500">{usuario.email}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{usuario.clerk_user_id ? 'Vinculado ao Clerk' : 'Aguardando primeiro login'}</p>
                  </div>

                  <select
                    value={usuario.papel}
                    onChange={event => updateUsuario(usuario.id, { papel: event.target.value as Usuario['papel'] })}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="cs">CS</option>
                    <option value="admin">Admin</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => updateUsuario(usuario.id, { ativo: !usuario.ativo })}
                    className={`h-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${usuario.ativo ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                  >
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </button>

                  <div className="text-xs text-gray-400 md:text-right">
                    {date(usuario.updated_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function RoleBadge({ papel }: { papel: Usuario['papel'] }) {
  const admin = papel === 'admin'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${admin ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
      {admin && <ShieldCheck size={12} />}
      {admin ? 'Admin' : 'CS'}
    </span>
  )
}

function date(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR')
}
