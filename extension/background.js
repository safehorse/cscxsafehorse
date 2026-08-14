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

async function handleMessage(message) {
  if (!message || !message.type) return
  if (message.type === 'status') {
    await callApi('/api/whatsapp/extensao/ping', { status: message.payload?.status })
  } else if (message.type === 'chats') {
    await callApi('/api/whatsapp/extensao/chats', { chats: message.payload })
  } else if (message.type === 'mensagens') {
    await callApi('/api/whatsapp/extensao/mensagens', { mensagens: message.payload })
  } else if (message.type === 'log') {
    console.warn('CSCX WhatsApp Bridge:', message.payload)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).finally(() => sendResponse(true))
  return true
})
