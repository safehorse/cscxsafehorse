import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { Check, Pencil, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

export function UserNameButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Usuário'
  const email = user?.primaryEmailAddress?.emailAddress || null
  const isDark = tone === 'dark'

  useEffect(() => {
    if (!editing) setName(user?.fullName || '')
  }, [editing, user?.fullName])

  async function save() {
    const nextName = name.trim()
    if (!nextName) return toast.warning('Informe seu nome.')
    setSaving(true)
    try {
      const [firstName, ...rest] = nextName.split(/\s+/)
      await user?.update({ firstName, lastName: rest.join(' ') || undefined })
      await user?.reload()
      await api.updateMeuUsuario(getToken, { nome: nextName, email })
      setEditing(false)
      toast.success('Nome atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar nome.')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className={`hidden items-center gap-1.5 rounded-xl border px-2 py-1.5 text-sm sm:flex ${isDark ? 'border-white/10 bg-white/10 text-gray-100' : 'border-blue-200 bg-blue-50 text-gray-700'}`}>
        <User size={15} className="text-blue-500" />
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') setEditing(false)
          }}
          autoFocus
          className="h-7 w-44 rounded-lg border border-blue-200 bg-white px-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          title="Salvar nome"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="grid h-7 w-7 place-items-center rounded-lg text-gray-500 hover:bg-white"
          title="Cancelar"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors sm:flex ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
      title="Alterar meu nome"
    >
      <User size={15} className="text-gray-400" />
      <span className="max-w-48 truncate">{displayName}</span>
      <Pencil size={13} className="text-gray-400" />
    </button>
  )
}
