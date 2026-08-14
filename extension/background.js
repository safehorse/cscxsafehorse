const API_BASE = 'https://cscx.safehorse.com.br'

async function getToken() {
  const { whatsappToken } = await chrome.storage.local.get('whatsappToken')
  return whatsappToken || null
}

async function callApi(path, body) {
  const token = await getToken()
  if (!token) return
  try {
    await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-token': token },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.error('CSCX WhatsApp Bridge: falha ao chamar a API', error)
  }
}

// O painel (content-bridge.js) roda no isolated world da aba do WhatsApp Web
// e por isso as chamadas fetch() dele ficam sujeitas ao Content-Security-Policy
// da própria página - que bloqueia connect-src pra domínios fora da lista dela.
// O service worker da extensão não tem essa restrição, então todo fetch
// interativo do painel (abrir conversa, buscar cliente, salvar vínculo,
// carregar pedidos) passa por aqui em vez de rodar direto no content script.
async function apiRequest({ path, method = 'GET', body }) {
  const token = await getToken()
  if (!token) return { ok: false, error: 'Extensão não pareada.' }
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-whatsapp-token': token },
      body: body ?? undefined,
    })
    const parsed = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, error: parsed?.error || `Erro HTTP ${response.status}` }
    return { ok: true, data: parsed?.data }
  } catch (error) {
    return { ok: false, error: error?.message || 'Falha de rede.' }
  }
}

async function handleMessage(message) {
  if (!message || !message.type) return true
  if (message.type === 'api-request') {
    return apiRequest(message.payload || {})
  }
  if (message.type === 'status') {
    await callApi('/api/whatsapp/extensao/ping', { status: message.payload?.status })
  } else if (message.type === 'chats') {
    await callApi('/api/whatsapp/extensao/chats', { chats: message.payload })
  } else if (message.type === 'mensagens') {
    await callApi('/api/whatsapp/extensao/mensagens', { mensagens: message.payload })
  } else if (message.type === 'log') {
    console.warn('CSCX WhatsApp Bridge:', message.payload)
  }
  return true
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(result => sendResponse(result ?? true))
    .catch(error => sendResponse({ ok: false, error: error?.message || 'Falha inesperada.' }))
  return true
})
