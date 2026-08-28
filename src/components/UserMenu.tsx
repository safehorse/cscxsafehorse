import { useEffect, useRef, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/clerk-react'
import { Check, ChevronDown, LogOut, Pencil, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

export function UserMenu() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Usuário'
  const email = user?.primaryEmailAddress?.emailAddress || null

  useEffect(() => {
    if (!editing) setName(user?.fullName || '')
  }, [editing, user?.fullName])

  useEffect(() => {
    if (!open) return
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

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
      <div className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-sm">
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
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
      >
        <User size={15} className="text-gray-400" />
        <span className="max-w-48 truncate">{displayName}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => { setOpen(false); setEditing(true) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
          >
            <Pencil size={14} className="text-gray-400" />
            Editar nome
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}
