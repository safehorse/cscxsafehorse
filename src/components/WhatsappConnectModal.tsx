import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { CheckCircle2, Copy, Download, LoaderCircle, Puzzle, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import type { WhatsappExtensaoStatus } from '../lib/types'

export function WhatsappConnectModal({ onClose }: { onClose: () => void }) {
  const { getToken } = useAuth()
  const [extensaoStatus, setExtensaoStatus] = useState<WhatsappExtensaoStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingExtensao, setLoadingExtensao] = useState(false)

  const connected = extensaoStatus?.status === 'conectado'

  async function loadStatus(silent = false) {
    if (!silent) setLoadingStatus(true)
    try {
      const { data } = await api.whatsappExtensaoStatus(getToken)
      setExtensaoStatus(data)
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Falha ao consultar a extensão.')
    } finally {
      if (!silent) setLoadingStatus(false)
    }
  }

  async function generateExtensaoToken() {
    setLoadingExtensao(true)
    try {
      const { data } = await api.whatsappExtensaoToken(getToken)
      setExtensaoStatus(data)
      toast.success('Código gerado. Cole na extensão.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar código.')
    } finally {
      setLoadingExtensao(false)
    }
  }

  async function copyExtensaoToken() {
    if (!extensaoStatus?.token) return
    try {
      await navigator.clipboard.writeText(extensaoStatus.token)
      toast.success('Código copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => loadStatus(true), connected ? 15000 : 5000)
    return () => window.clearInterval(timer)
  }, [connected])

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-gray-950/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <section
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 text-gray-950 shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Smartphone size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">WhatsApp via extensão</h2>
            <p className="text-sm text-gray-500">
              {loadingStatus ? 'Carregando...' : extensaoLabel(extensaoStatus)}
            </p>
          </div>
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
          Depois de instalar e parear, aparece um painel do lado da conversa, direto na aba do WhatsApp Web,
          mostrando o cliente, os chamados e os pedidos dele. Não precisa voltar nessa tela pra atender.
        </p>

        <div className="space-y-4">
          <a
            href="/whatsapp-extension-1.3.0.zip"
            download
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <Download size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Baixar extensão</span>
              <span className="block text-xs text-gray-500">Instale como extensão "não empacotada" no Chrome</span>
            </span>
          </a>

          <div className="rounded-xl border border-gray-200 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-500">Código de pareamento</p>
            {extensaoStatus?.token ? (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-gray-100 px-2 py-1.5 text-xs">{extensaoStatus.token}</code>
                <button
                  type="button"
                  onClick={copyExtensaoToken}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                  title="Copiar código"
                >
                  <Copy size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={generateExtensaoToken}
                disabled={loadingExtensao}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-gray-900 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingExtensao ? <LoaderCircle className="animate-spin" size={14} /> : <Puzzle size={14} />}
                Gerar código
              </button>
            )}
          </div>

          <ol className="space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
            <li>1. Baixe e descompacte a extensão, ative o "modo de desenvolvedor" em chrome://extensions e carregue a pasta.</li>
            <li>2. Clique no ícone da extensão, cole o código acima e salve.</li>
            <li>3. Abra web.whatsapp.com numa aba e escaneie o QR normalmente, se ainda não estiver logado.</li>
            <li>4. Um painel aparece do lado direito dessa aba com o cliente, os chamados e os pedidos.</li>
          </ol>

          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
            {connected ? <CheckCircle2 size={16} /> : <LoaderCircle size={16} className={extensaoStatus?.token ? 'animate-spin' : ''} />}
            {extensaoLabel(extensaoStatus)}
          </div>
        </div>
      </section>
    </div>
  )
}

function extensaoLabel(extensao: WhatsappExtensaoStatus | null) {
  if (extensao?.status === 'conectado') return 'Extensão conectada'
  if (extensao?.token) return 'Aguardando a extensão conectar...'
  return 'Gere um código para parear a extensão'
}
