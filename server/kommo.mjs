// Integração com o Kommo (mesma conta/token do InvoiceManager).
// Ao abrir um chamado, criamos um lead no funil Customer Success na etapa
// "chamado aberto". Quem manda a mensagem é o Salesbot do Kommo, disparado
// pelo gatilho "quando criado nesta etapa" - a API do Kommo não envia
// WhatsApp diretamente.

const KOMMO_BASE_URL = (process.env.KOMMO_BASE_URL || '').replace(/\/$/, '')
const KOMMO_ACCESS_TOKEN = process.env.KOMMO_ACCESS_TOKEN || ''
const KOMMO_TIMEOUT_MS = Number(process.env.KOMMO_TIMEOUT_MS || 10000)

const CS_PIPELINE_ID = Number(process.env.KOMMO_CS_PIPELINE_ID || 11619839)
export const CS_STATUS_CHAMADO_ABERTO = Number(process.env.KOMMO_CS_STATUS_ID || 89504795)
// 142 = etapa de ganho do funil ("chamado finalizado")
export const CS_STATUS_CHAMADO_FINALIZADO = 142

const FIELD_CONTACT_CLIENTE_ID = 1001391
const FIELD_LEAD_PROTOCOLO = 1005751
const FIELD_LEAD_JA_CONVERSOU = 1005753
const ENUM_JA_CONVERSOU_SIM = 855389
const ENUM_JA_CONVERSOU_NAO = 855391
// "Status chamado": o Salesbot usa nas condições para escolher a mensagem.
const FIELD_LEAD_STATUS_CHAMADO = 1005755
export const STATUS_CHAMADO = { aberto: 855393, finalizado: 855395, cancelado: 855397 }

export function kommoConfigured() {
  return Boolean(KOMMO_BASE_URL && KOMMO_ACCESS_TOKEN)
}

export function protocoloChamado(atendimento) {
  const sufixo = String(atendimento.id || '').replace(/-/g, '').slice(-4).toUpperCase()
  return atendimento.numero_pedido ? `${atendimento.numero_pedido}-${sufixo}` : sufixo
}

// Mesmo formato do InvoiceManager: +55 (18) 99751-1381
export function formatBrazilianPhone(value) {
  const raw = String(value || '').replace(/\D/g, '')
  const digits = raw.startsWith('55') && (raw.length === 12 || raw.length === 13) ? raw.slice(2) : raw
  if (digits.length !== 10 && digits.length !== 11) return null
  return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`
}

// DDD + últimos 8 dígitos: ignora +55 e o 9º dígito, que o WhatsApp às vezes
// grava sem.
function comparablePhone(value) {
  const raw = String(value || '').replace(/\D/g, '')
  const digits = raw.startsWith('55') && raw.length >= 12 ? raw.slice(2) : raw
  if (digits.length < 10) return null
  return `${digits.slice(0, 2)}${digits.slice(-8)}`
}

async function kommoRequest(method, path, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), KOMMO_TIMEOUT_MS)
  try {
    const response = await fetch(`${KOMMO_BASE_URL}/api/v4/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${KOMMO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    // 204 = busca sem resultado
    if (response.status === 204) return null
    const text = await response.text()
    const payload = text ? JSON.parse(text) : null
    if (!response.ok) {
      const error = new Error(`Kommo ${method} ${path} falhou (${response.status})`)
      error.status = response.status
      error.payload = payload
      throw error
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

function contactPhones(contact) {
  return (contact.custom_fields_values || [])
    .filter(field => field.field_code === 'PHONE')
    .flatMap(field => field.values.map(item => item.value))
}

async function searchContacts(query) {
  const data = await kommoRequest('GET', `contacts?query=${encodeURIComponent(query)}&with=leads&limit=50`)
  return data?._embedded?.contacts ?? []
}

async function findContacts({ phone, clid }) {
  const target = comparablePhone(phone)
  const [byPhone, byClid] = await Promise.all([
    target ? searchContacts(target.slice(-8)) : [],
    clid ? searchContacts(clid) : [],
  ])
  const phoneMatches = byPhone.filter(contact => contactPhones(contact).some(value => comparablePhone(value) === target))
  const clidMatches = byClid.filter(contact =>
    (contact.custom_fields_values || []).some(field =>
      field.field_id === FIELD_CONTACT_CLIENTE_ID && field.values.some(item => item.value === clid)))
  const unique = new Map([...clidMatches, ...phoneMatches].map(contact => [contact.id, contact]))
  return { all: [...unique.values()], clidMatches }
}

// Último lead com mensagem recebida do cliente (filtro por contato traz os
// eventos dos leads ligados a ele).
// O Kommo recusa (400) filtros com muitos IDs, então consulta em lotes e fica
// com o evento mais recente.
const EVENTS_ENTITY_BATCH = 10

async function lastIncomingChatLeadId(contactIds) {
  if (!contactIds.length) return null
  const batches = []
  for (let i = 0; i < contactIds.length; i += EVENTS_ENTITY_BATCH) {
    batches.push(contactIds.slice(i, i + EVENTS_ENTITY_BATCH))
  }
  const events = await Promise.all(batches.map(async ids => {
    const params = new URLSearchParams({ limit: '1', 'filter[type][]': 'incoming_chat_message', 'filter[entity]': 'contact' })
    for (const id of ids) params.append('filter[entity_id][]', String(id))
    const data = await kommoRequest('GET', `events?${params.toString()}`)
    return data?._embedded?.events?.[0]
  }))
  const event = events.filter(Boolean).sort((a, b) => b.created_at - a.created_at)[0]
  if (!event) return null
  return event.entity_type === 'lead' ? event.entity_id : -1
}

async function createContact({ nome, phone, clid }) {
  const fields = [{ field_code: 'PHONE', values: [{ value: phone, enum_code: 'WORK' }] }]
  if (clid) fields.push({ field_id: FIELD_CONTACT_CLIENTE_ID, values: [{ value: clid }] })
  const data = await kommoRequest('POST', 'contacts', [{ name: nome || phone, custom_fields_values: fields }])
  return data._embedded.contacts[0]
}

// Mover o lead dispara o Salesbot da etapa de destino (ex.: mensagem de
// chamado finalizado).
export async function moverLeadKommo(leadId, statusId, statusChamadoEnumId) {
  const fields = [{ field_id: FIELD_LEAD_STATUS_CHAMADO, values: [{ enum_id: statusChamadoEnumId }] }]
  // O Salesbot escolhe a mensagem de abertura por "Ja conversou" (Sim/Nao) e
  // cai em "Nenhuma das condições" (mensagem de finalizado) quando está vazio.
  if (statusChamadoEnumId !== STATUS_CHAMADO.aberto) fields.push({ field_id: FIELD_LEAD_JA_CONVERSOU, values: null })
  await kommoRequest('PATCH', `leads/${leadId}`, {
    pipeline_id: CS_PIPELINE_ID,
    status_id: statusId,
    custom_fields_values: fields,
  })
}

/**
 * Cria o lead do chamado no Kommo. Retorna o que foi feito para gravar no
 * chamado. Lança erro se o Kommo falhar.
 */
export async function abrirChamadoNoKommo({ atendimento, telefone, nomeCliente }) {
  const phone = formatBrazilianPhone(telefone)
  if (!phone) return { status: 'sem_telefone' }

  const clid = atendimento.codigo_cliente ? `clid_${atendimento.codigo_cliente}` : null
  const protocolo = protocoloChamado(atendimento)
  const { all, clidMatches } = await findContacts({ phone, clid })

  // Sem o histórico de conversa, segue como "não conversou" em vez de não
  // abrir o lead.
  const chatLeadId = await lastIncomingChatLeadId(all.map(contact => contact.id)).catch(error => {
    console.error('Kommo: falha ao consultar conversas do contato', error.message)
    return null
  })
  const jaConversou = chatLeadId !== null

  // Prefere o contato que tem a conversa do WhatsApp, depois o do cliente_id,
  // e só cria um novo se não existir nenhum com esse telefone.
  const contactWithChat = chatLeadId > 0
    ? all.find(contact => (contact._embedded?.leads || []).some(lead => lead.id === chatLeadId))
    : null
  const contact = contactWithChat || clidMatches[0] || all[0] || await createContact({ nome: nomeCliente, phone, clid })

  const data = await kommoRequest('POST', 'leads', [{
    name: `Chamado ${protocolo}${nomeCliente ? ` - ${nomeCliente}` : ''}`,
    pipeline_id: CS_PIPELINE_ID,
    status_id: CS_STATUS_CHAMADO_ABERTO,
    custom_fields_values: [
      { field_id: FIELD_LEAD_PROTOCOLO, values: [{ value: protocolo }] },
      { field_id: FIELD_LEAD_JA_CONVERSOU, values: [{ enum_id: jaConversou ? ENUM_JA_CONVERSOU_SIM : ENUM_JA_CONVERSOU_NAO }] },
      { field_id: FIELD_LEAD_STATUS_CHAMADO, values: [{ enum_id: STATUS_CHAMADO.aberto }] },
    ],
    _embedded: {
      contacts: [{ id: contact.id, is_main: true }],
      tags: [{ name: 'chamado_cscx' }],
    },
  }])
  const leadId = data._embedded.leads[0].id

  return {
    status: 'lead_criado',
    leadId,
    contactId: contact.id,
    protocolo,
    jaConversou,
    leadUrl: `${KOMMO_BASE_URL}/leads/detail/${leadId}`,
  }
}
