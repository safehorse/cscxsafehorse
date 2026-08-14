// Roda no "MAIN world" da página web.whatsapp.com - mesmo contexto que o
// próprio app do WhatsApp Web usa, então tem acesso ao "window.require"
// interno dele (o carregador de módulos webpack que o WhatsApp expõe).
// A técnica é a mesma que a lib whatsapp-web.js usa (via Puppeteer), só que
// aqui quem injeta é a extensão, rodando no navegador do próprio atendente.
(() => {
  const SYNC_INTERVAL_MS = 20000
  let started = false

  function post(type, payload) {
    window.postMessage({ source: 'cscx-wa-main', type, payload }, '*')
  }

  function getCollections() {
    return window.require('WAWebCollections')
  }

  function getSocketState() {
    try {
      return window.require('WAWebSocketModel').Socket.state
    } catch {
      return null
    }
  }

  function isReady() {
    return getSocketState() === 'CONNECTED'
  }

  function serializeChat(chat) {
    try {
      const data = chat.serialize ? chat.serialize() : chat
      const id = data.id?._serialized || (typeof data.id === 'string' ? data.id : null)
      if (!id) return null
      return {
        id,
        nome: data.formattedTitle || data.name || null,
        unreadCount: Number(data.unreadCount) || 0,
      }
    } catch {
      return null
    }
  }

  function serializeMessage(msg) {
    try {
      const data = msg.serialize ? msg.serialize() : msg
      const remote = data.id?.remote
      const chatId = typeof remote === 'string' ? remote : remote?._serialized
      if (!chatId || !data.id?._serialized) return null
      return {
        id: data.id._serialized,
        chatId,
        chatNome: null,
        fromMe: Boolean(data.id?.fromMe),
        body: data.body || '',
        type: data.type || 'chat',
        timestamp: data.t ? new Date(data.t * 1000).toISOString() : null,
      }
    } catch {
      return null
    }
  }

  function collectChats() {
    try {
      const { Chat } = getCollections()
      return Chat.getModelsArray()
        .filter(chat => !chat.groupMetadata)
        .map(serializeChat)
        .filter(Boolean)
        .slice(0, 150)
    } catch (error) {
      post('log', `collectChats falhou: ${error?.message}`)
      return []
    }
  }

  function collectRecentMessages() {
    try {
      const { Msg } = getCollections()
      return Msg.getModelsArray()
        .slice(-400)
        .map(serializeMessage)
        .filter(Boolean)
    } catch (error) {
      post('log', `collectRecentMessages falhou: ${error?.message}`)
      return []
    }
  }

  function syncSnapshot() {
    if (!isReady()) {
      post('status', { status: 'desconectado' })
      return
    }
    post('status', { status: 'conectado' })
    const chats = collectChats()
    if (chats.length) post('chats', chats)
    const mensagens = collectRecentMessages()
    if (mensagens.length) post('mensagens', mensagens)
  }

  function hookNewMessages() {
    try {
      const { Msg } = getCollections()
      Msg.on('add', msg => {
        const serialized = serializeMessage(msg)
        if (serialized) post('mensagens', [serialized])
      })
    } catch (error) {
      post('log', `hookNewMessages falhou: ${error?.message}`)
    }
  }

  function start() {
    if (started) return
    started = true
    hookNewMessages()
    syncSnapshot()
    setInterval(syncSnapshot, SYNC_INTERVAL_MS)
  }

  function waitUntilReady() {
    const timer = setInterval(() => {
      try {
        if (window.require && getCollections()?.Msg) {
          clearInterval(timer)
          start()
        }
      } catch {
        // WhatsApp Web ainda está carregando os módulos internos, tenta de novo.
      }
    }, 1500)
  }

  waitUntilReady()
})()
