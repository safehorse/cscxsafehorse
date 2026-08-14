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

  // O WhatsApp (multi-device) às vezes identifica uma conversa por um "LID"
  // (id interno opaco, termina em @lid) em vez do número de telefone real
  // (@c.us) - normalmente por privacidade. Nesse caso, o telefone de verdade
  // precisa ser resolvido via WAWebLidMigrationUtils.toPn, senão a gente
  // tenta "extrair telefone" de um número que não é telefone nenhum.
  // Importante: tem que receber o Wid "cru" (ex: chat.id, msg.id.remote),
  // não o resultado de .serialize() - esse já vira um objeto simples e perde
  // os métodos internos que o toPn precisa.
  function resolveTelefoneFromWid(wid) {
    const serialized = typeof wid === 'string' ? wid : wid?._serialized
    if (!serialized) return null
    if (!serialized.endsWith('@lid')) return serialized.split('@')[0]
    try {
      const { toPn } = window.require('WAWebLidMigrationUtils')
      const pn = toPn(wid)
      const pnSerialized = pn?._serialized || (typeof pn === 'string' ? pn : null)
      if (pnSerialized) return pnSerialized.split('@')[0]
      post('log', `toPn não resolveu telefone para lid ${serialized}`)
    } catch (error) {
      post('log', `resolveTelefoneFromWid falhou para ${serialized}: ${error?.message}`)
    }
    return null
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
        telefone: resolveTelefoneFromWid(chat.id),
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
        telefone: resolveTelefoneFromWid(msg.id?.remote || remote),
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

  function collectMessagesForChat(chatId) {
    try {
      const { Msg } = getCollections()
      return Msg.getModelsArray()
        .filter(msg => {
          const remote = msg.id?.remote
          const remoteId = typeof remote === 'string' ? remote : remote?._serialized
          return remoteId === chatId
        })
        .slice(-80)
        .map(serializeMessage)
        .filter(Boolean)
    } catch (error) {
      post('log', `collectMessagesForChat falhou: ${error?.message}`)
      return []
    }
  }

  let lastActiveChatId = undefined
  function checkActiveChat() {
    try {
      const { Chat } = getCollections()
      const active = Chat.getModelsArray().find(chat => chat.active) || null
      const serialized = active ? serializeChat(active) : null
      const id = serialized?.id || null
      if (id !== lastActiveChatId) {
        lastActiveChatId = id
        post('active-chat', serialized)
        if (id) {
          const mensagens = collectMessagesForChat(id)
          if (mensagens.length) post('mensagens', mensagens)
        }
      }
    } catch (error) {
      post('log', `checkActiveChat falhou: ${error?.message}`)
    }
  }

  function start() {
    if (started) return
    started = true
    hookNewMessages()
    syncSnapshot()
    checkActiveChat()
    setInterval(syncSnapshot, SYNC_INTERVAL_MS)
    setInterval(checkActiveChat, 2000)
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
