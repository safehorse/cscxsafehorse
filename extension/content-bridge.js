// Roda no "isolated world" (contexto normal de content script da extensão).
// Duas responsabilidades:
// 1) Recebe os dados que o content-main.js (que roda dentro da página de
//    verdade) manda via postMessage, e repassa pro service worker, que é
//    quem tem permissão de chamar a API do CSCX.
// 2) Desenha o painel flutuante (Cliente ERP + Chamados + Pedidos) por cima
//    da própria página do WhatsApp Web, pra não precisar trocar de aba.
const API_BASE = 'https://cscx.safehorse.com.br'

window.addEventListener('message', event => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.source !== 'cscx-wa-main') return
  chrome.runtime.sendMessage({ type: data.type, payload: data.payload }).catch(() => {})
  if (data.type === 'active-chat') onActiveChat(data.payload)
})

// Mostra o painel (e o botão de abrir/fechar) assim que a página carrega,
// sem depender de detectar uma conversa ativa primeiro - assim o botão
// sempre aparece, mesmo se a detecção de conversa ativa falhar.
function boot() {
  try {
    ensurePanel()
    console.log('CSCX WhatsApp Bridge: painel carregado.')
  } catch (error) {
    console.error('CSCX WhatsApp Bridge: falha ao criar o painel', error)
  }
}
if (document.body) boot()
else document.addEventListener('DOMContentLoaded', boot)

async function getToken() {
  const { whatsappToken } = await chrome.storage.local.get('whatsappToken')
  return whatsappToken || null
}

async function apiFetch(path, init) {
  const token = await getToken()
  if (!token) return null
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-whatsapp-token': token, ...init?.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || `Erro HTTP ${response.status}`)
  return body?.data
}

const STYLE = `
#cscx-panel {
  --cscx-bg: #fff; --cscx-bg-soft: #f9fafb; --cscx-bg-hover: #eff6ff; --cscx-text: #111827;
  --cscx-text-soft: #6b7280; --cscx-text-faint: #9ca3af; --cscx-border: #e5e7eb; --cscx-border-soft: #f5f5f5;
  --cscx-accent: #2563eb; --cscx-accent-bg: #eff6ff; --cscx-accent-border: #93c5fd; --cscx-shadow: rgba(0,0,0,.08);
}
#cscx-panel.cscx-dark {
  --cscx-bg: #202c33; --cscx-bg-soft: #182229; --cscx-bg-hover: #2a3942; --cscx-text: #e9edef;
  --cscx-text-soft: #8696a0; --cscx-text-faint: #667781; --cscx-border: #2f3b43; --cscx-border-soft: #2a3439;
  --cscx-accent: #53bdeb; --cscx-accent-bg: #0b2b3c; --cscx-accent-border: #2a4a5c; --cscx-shadow: rgba(0,0,0,.35);
}
#cscx-panel { position: fixed; top: 0; right: 0; height: 100vh; width: 320px; background: var(--cscx-bg);
  border-left: 1px solid var(--cscx-border); box-shadow: -4px 0 16px var(--cscx-shadow); z-index: 999999;
  font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: var(--cscx-text);
  display: flex; flex-direction: column; transition: transform .2s ease, background-color .15s ease; }
#cscx-panel.cscx-collapsed { transform: translateX(300px); }
#cscx-panel * { box-sizing: border-box; }
#cscx-toggle { position: fixed; top: 12px; right: 328px; z-index: 1000000; width: 34px; height: 34px;
  border-radius: 10px; background: #059669; color: #fff; border: none; cursor: pointer; font-size: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); transition: right .2s ease; }
#cscx-panel.cscx-collapsed ~ #cscx-toggle { right: 8px; }
.cscx-header { padding: 12px 14px; border-bottom: 1px solid var(--cscx-border-soft); font-weight: 700; font-size: 13px;
  display: flex; align-items: center; gap: 8px; }
.cscx-body { flex: 1; overflow-y: auto; }
.cscx-section { padding: 12px 14px; border-bottom: 1px solid var(--cscx-border-soft); }
.cscx-section h3 { margin: 0 0 8px; font-size: 12px; font-weight: 700; color: var(--cscx-text-soft);
  display: flex; align-items: center; gap: 6px; }
.cscx-badge { background: var(--cscx-bg-soft); color: var(--cscx-text-soft); border-radius: 999px; padding: 1px 7px; font-size: 11px; font-weight: 700; }
.cscx-empty { color: var(--cscx-text-faint); font-size: 12px; background: var(--cscx-bg-soft); border-radius: 10px; padding: 14px; text-align: center; }
.cscx-input { width: 100%; padding: 7px 9px; border: 1px solid var(--cscx-border); border-radius: 8px; font-size: 12px;
  margin-bottom: 6px; background: var(--cscx-bg); color: var(--cscx-text); }
.cscx-btn { width: 100%; padding: 7px; border: none; border-radius: 8px; background: var(--cscx-accent); color: #fff;
  font-weight: 700; font-size: 12px; cursor: pointer; }
.cscx-btn:disabled { opacity: .5; cursor: default; }
.cscx-sugg { border: 1px solid var(--cscx-border); border-radius: 8px; overflow: hidden; margin-bottom: 6px; }
.cscx-sugg-item { padding: 6px 9px; cursor: pointer; border-bottom: 1px solid var(--cscx-border-soft); }
.cscx-sugg-item:last-child { border-bottom: none; }
.cscx-sugg-item:hover { background: var(--cscx-bg-hover); }
.cscx-card { border: 1px solid var(--cscx-border); border-radius: 10px; padding: 9px; margin-bottom: 6px; text-decoration: none;
  color: inherit; display: block; }
.cscx-card:hover { border-color: var(--cscx-accent-border); background: var(--cscx-bg-hover); }
.cscx-card-top { display: flex; justify-content: space-between; gap: 6px; align-items: start; }
.cscx-card-title { font-weight: 700; font-size: 12px; }
.cscx-tag { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: var(--cscx-accent-bg); color: var(--cscx-accent); white-space: nowrap; }
.cscx-card-sub { color: var(--cscx-text-soft); font-size: 11px; margin-top: 3px; }
`

let panelEl = null
let toggleEl = null
let state = { chatId: null, nome: null, contato: null, chamados: [], pedidos: [], codigoCliente: '', clienteNome: '', sugestoes: [], saving: false }

function ensurePanel() {
  if (panelEl) return
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  panelEl = document.createElement('div')
  panelEl.id = 'cscx-panel'
  document.body.appendChild(panelEl)

  toggleEl = document.createElement('button')
  toggleEl.id = 'cscx-toggle'
  toggleEl.textContent = '☰'
  toggleEl.title = 'Mostrar/ocultar painel CSCX'
  toggleEl.addEventListener('click', () => panelEl.classList.toggle('cscx-collapsed'))
  document.body.appendChild(toggleEl)

  syncTheme()
  setInterval(syncTheme, 3000)

  render()
}

// O WhatsApp Web deixa trocar entre claro/escuro sem recarregar a página,
// e não há um jeito documentado/estável de ler isso, então detectamos pela
// cor de fundo real que o WhatsApp está pintando por trás do painel.
function syncTheme() {
  try {
    const probe = document.querySelector('#app') || document.body
    const bg = getComputedStyle(probe).backgroundColor
    const channels = bg.match(/[\d.]+/g)
    if (!channels || channels.length < 3) return
    const [r, g, b] = channels.map(Number)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    const dark = luminance < 0.5
    panelEl.classList.toggle('cscx-dark', dark)
  } catch {
    // Se não der pra ler, fica no tema claro (padrão).
  }
}

async function onActiveChat(chat) {
  ensurePanel()
  state = { ...state, chatId: chat?.id || null, nome: chat?.nome || chat?.id || null, contato: null, chamados: [], pedidos: [], codigoCliente: '', clienteNome: '', sugestoes: [] }
  render()
  if (!chat?.id) return
  try {
    const nomeQs = chat?.nome ? `?nome=${encodeURIComponent(chat.nome)}` : ''
    const data = await apiFetch(`/api/whatsapp/chats/${encodeURIComponent(chat.id)}/messages${nomeQs}`)
    state.contato = data?.contato || null
    state.chamados = data?.chamados || []
    state.codigoCliente = data?.contato?.codigo_cliente || ''
    state.clienteNome = data?.contato?.cliente_nome || ''
    render()
    if (state.codigoCliente) loadPedidos(state.codigoCliente)
  } catch (error) {
    console.warn('CSCX WhatsApp Bridge: falha ao carregar conversa', error)
  }
}

async function loadPedidos(codigoCliente) {
  try {
    state.pedidos = await apiFetch(`/api/pcp/clientes/${encodeURIComponent(codigoCliente)}/pedidos`) || []
  } catch {
    state.pedidos = []
  }
  render()
}

async function searchClientes(term) {
  state.codigoCliente = term
  render()
  if (term.trim().length < 2) {
    state.sugestoes = []
    render()
    return
  }
  try {
    state.sugestoes = await apiFetch(`/api/whatsapp/clientes?search=${encodeURIComponent(term)}`) || []
  } catch {
    state.sugestoes = []
  }
  render()
}

async function saveLink() {
  if (!state.contato || !state.codigoCliente.trim()) return
  state.saving = true
  render()
  try {
    const data = await apiFetch(`/api/whatsapp/contatos/${state.contato.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ codigo_cliente: state.codigoCliente.trim(), cliente_nome: state.clienteNome.trim() || null }),
    })
    state.contato = data?.contato || state.contato
    state.chamados = data?.chamados || []
    if (state.contato?.codigo_cliente) loadPedidos(state.contato.codigo_cliente)
  } catch (error) {
    console.warn('CSCX WhatsApp Bridge: falha ao salvar vínculo', error)
  } finally {
    state.saving = false
    render()
  }
}

function el(html) {
  const div = document.createElement('div')
  div.innerHTML = html.trim()
  return div.firstElementChild
}

function moneyBRL(value) {
  if (value === null || value === undefined) return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateBR(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}

function render() {
  if (!panelEl) return
  const focused = panelEl.contains(document.activeElement) ? document.activeElement : null
  const focusId = focused?.id || null
  const selectionStart = focused && 'selectionStart' in focused ? focused.selectionStart : null
  panelEl.innerHTML = ''

  panelEl.appendChild(el(`<div class="cscx-header">🐴 CSCX Safe Horse</div>`))

  const body = el(`<div class="cscx-body"></div>`)
  panelEl.appendChild(body)

  if (!state.chatId) {
    body.appendChild(el(`<div class="cscx-section"><div class="cscx-empty">Abra uma conversa no WhatsApp Web.</div></div>`))
    return
  }

  // Cliente ERP
  const clienteSection = el(`
    <div class="cscx-section">
      <h3>🛡️ Cliente ERP</h3>
      <input class="cscx-input" id="cscx-codigo" placeholder="ID do cliente ERP" value="${escapeAttr(state.codigoCliente)}" />
    </div>
  `)
  const codigoInput = clienteSection.querySelector('#cscx-codigo')
  codigoInput.addEventListener('input', event => searchClientes(event.target.value))

  if (state.sugestoes.length) {
    const sugg = el(`<div class="cscx-sugg"></div>`)
    for (const item of state.sugestoes) {
      const row = el(`<div class="cscx-sugg-item"><b>${escapeHtml(item.codigo_cliente)}</b> — ${escapeHtml(item.cliente || 'Sem nome')}</div>`)
      row.addEventListener('click', () => {
        state.codigoCliente = item.codigo_cliente
        state.clienteNome = item.cliente || ''
        state.sugestoes = []
        render()
      })
      sugg.appendChild(row)
    }
    clienteSection.appendChild(sugg)
  }

  const nomeInput = el(`<input class="cscx-input" id="cscx-nome" placeholder="Nome do cliente" value="${escapeAttr(state.clienteNome)}" />`)
  nomeInput.addEventListener('input', event => { state.clienteNome = event.target.value })
  clienteSection.appendChild(nomeInput)

  const saveBtn = el(`<button class="cscx-btn">${state.saving ? 'Salvando...' : 'Salvar vínculo'}</button>`)
  saveBtn.disabled = state.saving || !state.contato
  saveBtn.addEventListener('click', saveLink)
  clienteSection.appendChild(saveBtn)
  body.appendChild(clienteSection)

  // Chamados
  const chamadosSection = el(`
    <div class="cscx-section">
      <h3>💬 Chamados do cliente <span class="cscx-badge">${state.chamados.length}</span></h3>
    </div>
  `)
  if (!state.chamados.length) {
    chamadosSection.appendChild(el(`<div class="cscx-empty">Nenhum chamado para este cliente.</div>`))
  } else {
    for (const item of state.chamados) {
      const card = el(`
        <a class="cscx-card" href="${API_BASE}/chamados?abrir=${item.id}" target="_blank" rel="noopener">
          <div class="cscx-card-top">
            <span class="cscx-card-title">#${escapeHtml(item.numero_pedido || 'sem pedido')}</span>
            <span class="cscx-tag">${escapeHtml(item.status || '')}</span>
          </div>
          <div class="cscx-card-sub">${escapeHtml(item.descricao_produto || item.motivo || 'Sem descrição')}</div>
          <div class="cscx-card-sub">${dateBR(item.data_solicitacao)}</div>
        </a>
      `)
      chamadosSection.appendChild(card)
    }
  }
  body.appendChild(chamadosSection)

  // Pedidos
  const pedidosSection = el(`
    <div class="cscx-section">
      <h3>📦 Pedidos do cliente <span class="cscx-badge">${state.pedidos.length}</span></h3>
    </div>
  `)
  if (!state.contato?.codigo_cliente) {
    pedidosSection.appendChild(el(`<div class="cscx-empty">Vincule o cliente para ver os pedidos.</div>`))
  } else if (!state.pedidos.length) {
    pedidosSection.appendChild(el(`<div class="cscx-empty">Nenhum pedido para este cliente.</div>`))
  } else {
    for (const pedido of state.pedidos) {
      const card = el(`
        <div class="cscx-card">
          <div class="cscx-card-top">
            <span class="cscx-card-title">#${escapeHtml(pedido.codigo_venda)}</span>
            <span class="cscx-tag">${escapeHtml(pedido.situacao_erp || '')}</span>
          </div>
          <div class="cscx-card-sub">${moneyBRL(pedido.valor_total)}</div>
          <div class="cscx-card-sub">${dateBR(pedido.data_pedido)}</div>
        </div>
      `)
      pedidosSection.appendChild(card)
    }
  }
  body.appendChild(pedidosSection)

  if (focusId) {
    const toFocus = panelEl.querySelector(`#${focusId}`)
    if (toFocus) {
      toFocus.focus()
      if (selectionStart != null && 'setSelectionRange' in toFocus) {
        try { toFocus.setSelectionRange(selectionStart, selectionStart) } catch { /* input não suporta seleção */ }
      }
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function escapeAttr(value) {
  return escapeHtml(value)
}
