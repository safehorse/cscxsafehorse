import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const { Pool } = pg

const PORT = Number(process.env.PORT || 3001)
const DATABASE_URL = process.env.DATABASE_URL
const CSCX_API_KEY = process.env.CSCX_API_KEY || ''
const CLERK_JWKS_URL = process.env.CLERK_JWKS_URL || ''
const CLERK_JWT_ISSUER = process.env.CLERK_JWT_ISSUER || ''
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || ''
const PCP_API_URL = (process.env.PCP_API_URL || '').replace(/\/$/, '')
const PCP_API_KEY = process.env.PCP_API_KEY || ''
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || CORS_ORIGIN.split(',')[0] || 'https://cscx.safehorse.com.br').replace(/\/$/, '')

if (!DATABASE_URL) {
  console.warn('DATABASE_URL não configurado. O servidor vai iniciar, mas as rotas de banco falharão.')
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
})

const app = express()
app.use(cors({ origin: CORS_ORIGIN.split(',').map(item => item.trim()), credentials: true }))
app.use(express.json({ limit: '10mb' }))

let jwks = null
if (CLERK_JWKS_URL) {
  jwks = createRemoteJWKSet(new URL(CLERK_JWKS_URL))
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function normalizaStatus(status) {
  const value = String(status || 'ABERTO').trim().toUpperCase()
  if (!value) return 'ABERTO'
  if (['AGUARDANDO DEVOLU??O', 'AGUARDANDO DEVOLUCAO', 'AGUARDANDO DEVOLUÇÃO'].includes(value)) return 'AGUARDANDO DEVOLUÇÃO'
  if (['EM PRODU??O', 'EM PRODUCAO', 'EM PRODUÇÃO'].includes(value)) return 'EM PRODUÇÃO'
  if (['EM ANALISE', 'EM ANÁLISE'].includes(value)) return 'EM ANÁLISE'
  if (['CREDITO GERADO', 'CRÉDITO GERADO'].includes(value)) return 'CRÉDITO GERADO'
  return value
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function toDateOrNull(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value)
    return excelEpoch.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  if (!text) return null
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  return null
}

function getUserId(req) {
  return req.auth?.sub || req.auth?.userId || 'service'
}

async function requireAuth(req, res, next) {
  const apiKey = req.header('x-api-key')
  if (CSCX_API_KEY && apiKey && apiKey === CSCX_API_KEY) {
    req.auth = { type: 'service', sub: 'service' }
    return next()
  }

  const auth = req.header('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Autenticação obrigatória.' })
  if (!jwks) return res.status(500).json({ error: 'CLERK_JWKS_URL não configurado no backend.' })

  try {
    const options = CLERK_JWT_ISSUER ? { issuer: CLERK_JWT_ISSUER } : undefined
    const { payload } = await jwtVerify(token, jwks, options)
    req.auth = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' })
  }
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  const db = DATABASE_URL ? await pool.query('select now() as now') : { rows: [{ now: null }] }
  res.json({ ok: true, database: Boolean(DATABASE_URL), now: db.rows[0].now })
}))

app.use('/api', requireAuth)

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [totais, proximos, statusRows] = await Promise.all([
    pool.query(`
      select
        count(*)::int as total,
        count(*) filter (where upper(status) not in ('FINALIZADO', 'CONCLUIDO', 'CANCELADO'))::int as abertos,
        count(*) filter (where agendado_para::date = current_date)::int as hoje,
        coalesce(sum(valor_total), 0)::numeric as valor_total
      from cscx_atendimentos
    `),
    pool.query(`
      select id, numero_pedido, cliente, status, responsavel, agendado_para, proxima_acao
      from cscx_atendimentos
      where agendado_para is not null
      order by agendado_para asc
      limit 8
    `),
    pool.query(`
      select status, count(*)::int as total
      from cscx_atendimentos
      group by status
      order by total desc, status asc
    `),
  ])

  res.json({
    totais: totais.rows[0],
    proximos: proximos.rows,
    status: statusRows.rows,
  })
}))

app.get('/api/cadastros', asyncRoute(async (_req, res) => {
  const [setores, responsaveis] = await Promise.all([
    pool.query(`
      select nome from cscx_setores where ativo = true
      union
      select distinct trim(setor) from cscx_atendimentos where nullif(trim(coalesce(setor, '')), '') is not null
      order by nome
    `),
    pool.query(`
      select nome from cscx_responsaveis where ativo = true
      union
      select distinct trim(responsavel) from cscx_atendimentos where nullif(trim(coalesce(responsavel, '')), '') is not null
      order by nome
    `),
  ])
  res.json({
    setores: setores.rows.map(row => row.nome),
    responsaveis: responsaveis.rows.map(row => row.nome),
  })
}))

app.get('/api/agenda', asyncRoute(async (req, res) => {
  const from = String(req.query.from || '').trim()
  const to = String(req.query.to || '').trim()
  const values = []
  const where = ['agendado_para is not null']

  if (from) {
    values.push(from)
    where.push(`agendado_para >= $${values.length}::timestamptz`)
  }

  if (to) {
    values.push(to)
    where.push(`agendado_para < $${values.length}::timestamptz`)
  }

  const { rows } = await pool.query(`
    select
      id,
      numero_pedido,
      cliente,
      status,
      responsavel,
      agendado_para,
      proxima_acao,
      prioridade,
      descricao_produto,
      motivo
    from cscx_atendimentos
    where ${where.join(' and ')}
    order by agendado_para asc, cliente asc
  `, values)

  res.json({ data: rows })
}))

app.get('/api/usuarios', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    select id, clerk_user_id, email, nome, papel, ativo, convite_id, convite_status, convite_enviado_em, created_at, updated_at
    from cscx_usuarios
    order by case papel when 'admin' then 0 else 1 end, nome nulls last, email
  `)
  res.json({ data: rows })
}))

app.post('/api/usuarios/me', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const nome = stringOrNull(req.body.nome)
  if (!email) return res.status(400).json({ error: 'Informe o email do usuário.' })

  const found = await pool.query(`
    select *
    from cscx_usuarios
    where clerk_user_id = $1 or lower(email) = $2
    order by case when lower(email) = $2 then 0 else 1 end
    limit 1
  `, [getUserId(req), email])

  if (found.rows[0]) {
    const { rows } = await pool.query(`
      update cscx_usuarios
      set clerk_user_id = coalesce(clerk_user_id, $2),
          nome = coalesce($3, nome),
          email = $4,
          ativo = true
      where id = $1
      returning *
    `, [found.rows[0].id, getUserId(req), nome, email])
    return res.json({ data: rows[0] })
  }

  const { rows } = await pool.query(`
    insert into cscx_usuarios (clerk_user_id, email, nome, papel, ativo)
    values ($1, $2, $3, 'cs', true)
    returning *
  `, [getUserId(req), email, nome])
  res.status(201).json({ data: rows[0] })
}))

app.post('/api/usuarios', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email)
  const nome = stringOrNull(req.body.nome)
  const papel = normalizePapel(req.body.papel)
  const ativo = req.body.ativo === undefined ? true : Boolean(req.body.ativo)
  if (!email) return res.status(400).json({ error: 'Informe o email do usuário.' })

  const found = await pool.query('select id from cscx_usuarios where lower(email) = $1 limit 1', [email])
  if (found.rows[0]) {
    const { rows } = await pool.query(`
      update cscx_usuarios
      set nome = $2,
          papel = $3,
          ativo = $4
      where id = $1
      returning *
    `, [found.rows[0].id, nome, papel, ativo])
    return res.json({ data: rows[0] })
  }

  const { rows } = await pool.query(`
    insert into cscx_usuarios (email, nome, papel, ativo)
    values ($1, $2, $3, $4)
    returning *
  `, [email, nome, papel, ativo])
  res.status(201).json({ data: rows[0] })
}))

app.post('/api/usuarios/:id/convite', asyncRoute(async (req, res) => {
  const usuario = await pool.query('select * from cscx_usuarios where id = $1', [req.params.id])
  if (!usuario.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' })
  if (!usuario.rows[0].ativo) return res.status(400).json({ error: 'Ative o usuário antes de enviar o convite.' })

  const invitation = await createClerkInvitation(usuario.rows[0])
  const { rows } = await pool.query(`
    update cscx_usuarios
    set convite_id = $2,
        convite_status = $3,
        convite_enviado_em = now()
    where id = $1
    returning *
  `, [usuario.rows[0].id, invitation.id ?? null, invitation.status ?? 'sent'])

  res.json({
    data: rows[0],
    convite: {
      id: invitation.id ?? null,
      status: invitation.status ?? 'sent',
      email: invitation.email_address ?? usuario.rows[0].email,
    },
  })
}))

app.patch('/api/usuarios/:id', asyncRoute(async (req, res) => {
  const fields = []
  const values = []

  if ('email' in req.body) {
    const email = normalizeEmail(req.body.email)
    if (!email) return res.status(400).json({ error: 'Informe um email válido.' })
    values.push(email)
    fields.push(`email = $${values.length}`)
  }
  if ('nome' in req.body) {
    values.push(stringOrNull(req.body.nome))
    fields.push(`nome = $${values.length}`)
  }
  if ('papel' in req.body) {
    values.push(normalizePapel(req.body.papel))
    fields.push(`papel = $${values.length}`)
  }
  if ('ativo' in req.body) {
    values.push(Boolean(req.body.ativo))
    fields.push(`ativo = $${values.length}`)
  }

  if (!fields.length) return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' })
  values.push(req.params.id)
  const { rows } = await pool.query(`
    update cscx_usuarios
    set ${fields.join(', ')}
    where id = $${values.length}
    returning *
  `, values)
  if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado.' })
  res.json({ data: rows[0] })
}))

app.post('/api/cadastros/setores', asyncRoute(async (req, res) => {
  const nome = stringOrNull(req.body.nome)
  if (!nome) return res.status(400).json({ error: 'Informe o setor.' })
  const { rows } = await pool.query(`
    insert into cscx_setores (nome)
    values ($1)
    on conflict (nome) do update set ativo = true
    returning *
  `, [nome])
  res.status(201).json({ data: rows[0] })
}))

app.post('/api/cadastros/responsaveis', asyncRoute(async (req, res) => {
  const nome = stringOrNull(req.body.nome)
  if (!nome) return res.status(400).json({ error: 'Informe o responsável.' })
  const { rows } = await pool.query(`
    insert into cscx_responsaveis (nome)
    values ($1)
    on conflict (nome) do update set ativo = true
    returning *
  `, [nome])
  res.status(201).json({ data: rows[0] })
}))

app.get('/api/atendimentos', asyncRoute(async (req, res) => {
  const search = String(req.query.search || '').trim()
  const status = String(req.query.status || '').trim()
  const responsavel = String(req.query.responsavel || '').trim()
  const page = Math.max(Number(req.query.page || 1), 1)
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 5), 100)
  const offset = (page - 1) * pageSize

  const where = []
  const values = []

  if (search) {
    values.push(`%${search}%`)
    where.push(`(numero_pedido ilike $${values.length} or cliente ilike $${values.length} or codigo_produto ilike $${values.length} or descricao_produto ilike $${values.length})`)
  }
  if (status) {
    values.push(status)
    where.push(`status = $${values.length}`)
  }
  if (responsavel) {
    values.push(`%${responsavel}%`)
    where.push(`responsavel ilike $${values.length}`)
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const countSql = `select count(*)::int as total from cscx_atendimentos ${whereSql}`
  const countValues = [...values]

  values.push(pageSize)
  values.push(offset)
  const sql = `
    select *
    from cscx_atendimentos
    ${whereSql}
    order by coalesce(agendado_para, created_at) desc
    limit $${values.length - 1}
    offset $${values.length}
  `
  const [list, total] = await Promise.all([
    pool.query(sql, values),
    pool.query(countSql, countValues),
  ])
  res.json({ data: list.rows, total: total.rows[0]?.total ?? 0, page, pageSize })
}))

app.get('/api/atendimentos/:id', asyncRoute(async (req, res) => {
  const atendimento = await pool.query('select * from cscx_atendimentos where id = $1', [req.params.id])
  if (!atendimento.rows[0]) return res.status(404).json({ error: 'Atendimento não encontrado.' })

  const [interacoes, agenda] = await Promise.all([
    pool.query('select * from cscx_interacoes where atendimento_id = $1 order by realizado_em desc', [req.params.id]),
    pool.query('select * from cscx_agendamentos where atendimento_id = $1 order by inicio asc', [req.params.id]),
  ])

  res.json({ data: { ...atendimento.rows[0], interacoes: interacoes.rows, agenda: agenda.rows } })
}))

app.post('/api/atendimentos', asyncRoute(async (req, res) => {
  const row = atendimentoFromBody(req.body)
  const inserted = await upsertAtendimento(row, getUserId(req))
  res.status(201).json({ data: inserted })
}))

app.patch('/api/atendimentos/:id', asyncRoute(async (req, res) => {
  const allowed = [
    'data_solicitacao', 'numero_pedido', 'codigo_cliente', 'cliente', 'codigo_produto', 'descricao_produto',
    'quantidade', 'valor_unitario', 'valor_total', 'motivo', 'setor', 'responsavel',
    'proxima_acao', 'status', 'novo_pedido', 'cliente_tem_desconto', 'vendedor',
    'descricao_situacao', 'prioridade', 'agendado_para', 'concluido_em',
    'pcp_pedido_id', 'pcp_item_id', 'pcp_payload',
  ]
  const sets = []
  const values = []
  for (const field of allowed) {
    if (!(field in req.body)) continue
    values.push(field === 'status' ? normalizaStatus(req.body[field]) : req.body[field] || null)
    sets.push(`${field} = $${values.length}`)
  }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' })
  values.push(getUserId(req))
  sets.push(`updated_by_clerk_user_id = $${values.length}`)
  values.push(req.params.id)
  const { rows } = await pool.query(`
    update cscx_atendimentos
    set ${sets.join(', ')}
    where id = $${values.length}
    returning *
  `, values)
  if (!rows[0]) return res.status(404).json({ error: 'Atendimento não encontrado.' })
  res.json({ data: rows[0] })
}))

app.post('/api/atendimentos/:id/interacoes', asyncRoute(async (req, res) => {
  const tipo = String(req.body.tipo || 'nota')
  const descricao = String(req.body.descricao || '').trim()
  if (!descricao) return res.status(400).json({ error: 'Informe a descrição da interação.' })
  const { rows } = await pool.query(`
    insert into cscx_interacoes (atendimento_id, tipo, descricao, criado_por_clerk_user_id)
    values ($1, $2, $3, $4)
    returning *
  `, [req.params.id, tipo, descricao, getUserId(req)])
  res.status(201).json({ data: rows[0] })
}))

app.post('/api/agendamentos', asyncRoute(async (req, res) => {
  const titulo = String(req.body.titulo || '').trim()
  const inicio = req.body.inicio
  if (!titulo || !inicio) return res.status(400).json({ error: 'Título e início são obrigatórios.' })
  const { rows } = await pool.query(`
    insert into cscx_agendamentos (atendimento_id, titulo, inicio, fim, responsavel, observacao, criado_por_clerk_user_id)
    values ($1, $2, $3, $4, $5, $6, $7)
    returning *
  `, [
    req.body.atendimento_id || null,
    titulo,
    inicio,
    req.body.fim || null,
    req.body.responsavel || null,
    req.body.observacao || null,
    getUserId(req),
  ])
  res.status(201).json({ data: rows[0] })
}))

app.get('/api/pcp/pedidos/:codigo', asyncRoute(async (req, res) => {
  if (!PCP_API_URL || !PCP_API_KEY) return res.status(500).json({ error: 'Integração PCP não configurada.' })
  const codigo = encodeURIComponent(req.params.codigo)
  const select = encodeURIComponent('id,codigo_venda,codigo_cliente,nome_cliente,data_pedido,data_entrega,data_faturamento,situacao_erp,financeiro_bloqueado,observacoes,vendedor_id,last_webhook_payload,pedido_itens(id,produto_id,quantidade,obs,produto:produto_id(nome,id_erp))')
  const response = await fetch(`${PCP_API_URL}/rest/v1/pedidos?codigo_venda=eq.${codigo}&select=${select}`, {
    headers: { apikey: PCP_API_KEY, Authorization: `Bearer ${PCP_API_KEY}` },
  })
  const data = await response.json().catch(() => [])
  if (!response.ok) return res.status(response.status).json({ error: data?.message || 'Falha ao consultar PCP.' })
  const pedido = Array.isArray(data) ? data[0] || null : data
  if (!pedido) return res.json({ data: null })
  const normalized = normalizePcpPedido(pedido)
  await hydrateItemValuesFromHistory(normalized)
  res.json({ data: normalized })
}))

app.post('/api/import/planilha', asyncRoute(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : []
  if (!rows.length) return res.status(400).json({ error: 'Nenhuma linha recebida.' })
  const imported = []
  for (const item of rows) {
    const normalized = atendimentoFromBody(item)
    imported.push(await upsertAtendimento(normalized, getUserId(req)))
  }
  res.json({ imported: imported.length })
}))

function atendimentoFromBody(body) {
  return {
    data_solicitacao: toDateOrNull(body.data_solicitacao ?? body.dataSolicitacao ?? body['DATA DA SOLI']),
    numero_pedido: stringOrNull(body.numero_pedido ?? body.numeroPedido ?? body['Nº DO PEDIDO'] ?? body['N DO PEDIDO']),
    codigo_cliente: stringOrNull(body.codigo_cliente ?? body.codigoCliente),
    cliente: stringOrNull(body.cliente ?? body['CLIENTE']),
    codigo_produto: stringOrNull(body.codigo_produto ?? body.codigoProduto ?? body['COD. PRODUTO']),
    descricao_produto: stringOrNull(body.descricao_produto ?? body.descricaoProduto ?? body['DESCRICAO DO PRODUTO']),
    quantidade: toNumberOrNull(body.quantidade ?? body['QUANTIDADE']),
    valor_unitario: toNumberOrNull(body.valor_unitario ?? body.valorUnitario ?? body['VALOR UNITARIO']),
    valor_total: toNumberOrNull(body.valor_total ?? body.valorTotal ?? body['VALOR TOTAL']),
    motivo: stringOrNull(body.motivo ?? body['SOLICITACAO/ MOTIVO'] ?? body['QUAL A SOLICITACAO']),
    setor: stringOrNull(body.setor ?? body['SETOR'] ?? body['SETOR RESPONSAVEL']),
    responsavel: stringOrNull(body.responsavel ?? body['RESPONSAVEL']),
    proxima_acao: stringOrNull(body.proxima_acao ?? body.proximaAcao ?? body['PROXIMA ACAO'] ?? body['RESOLUCAO COM CLIENTE']),
    status: normalizaStatus(body.status ?? body['STATUS'] ?? body['STATUS ACOMPANHAMENTO']),
    novo_pedido: stringOrNull(body.novo_pedido ?? body.novoPedido ?? body['NOVO PEDIDO']),
    cliente_tem_desconto: stringOrNull(body.cliente_tem_desconto ?? body.clienteTemDesconto ?? body['CLIENTE TEM DESCONTO']),
    vendedor: stringOrNull(body.vendedor ?? body['VENDEDOR']),
    descricao_situacao: stringOrNull(body.descricao_situacao ?? body.descricaoSituacao ?? body['DESCRICAO DA SITUACAO:'] ?? body['INFORMACOES GERAIS']),
    origem_planilha_aba: stringOrNull(body.origem_planilha_aba ?? body.origemAba),
    origem_linha: Number.isFinite(Number(body.origem_linha ?? body.origemLinha)) ? Number(body.origem_linha ?? body.origemLinha) : null,
    prioridade: body.prioridade || 'normal',
    agendado_para: body.agendado_para || body.agendadoPara || null,
    pcp_pedido_id: stringOrNull(body.pcp_pedido_id ?? body.pcpPedidoId),
    pcp_item_id: stringOrNull(body.pcp_item_id ?? body.pcpItemId),
    pcp_payload: body.pcp_payload ?? body.pcpPayload ?? null,
  }
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function normalizeEmail(value) {
  const email = stringOrNull(value)?.toLowerCase()
  return email && email.includes('@') ? email : null
}

function normalizePapel(value) {
  return value === 'admin' ? 'admin' : 'cs'
}

async function createClerkInvitation(usuario) {
  if (!CLERK_SECRET_KEY) {
    const error = new Error('CLERK_SECRET_KEY não configurado no backend.')
    error.status = 500
    throw error
  }

  const response = await fetch('https://api.clerk.com/v1/invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: usuario.email,
      redirect_url: `${PUBLIC_APP_URL}/login`,
      notify: true,
      ignore_existing: true,
      public_metadata: {
        app: 'cscx',
        role: usuario.papel,
        name: usuario.nome,
      },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const clerkMessage = data?.errors?.[0]?.long_message || data?.errors?.[0]?.message || data?.message
    const error = new Error(clerkMessage || 'Falha ao enviar convite pelo Clerk.')
    error.status = response.status
    throw error
  }
  return data
}

async function upsertAtendimento(row, userId) {
  const fields = [
    'data_solicitacao', 'numero_pedido', 'codigo_cliente', 'cliente', 'codigo_produto', 'descricao_produto',
    'quantidade', 'valor_unitario', 'valor_total', 'motivo', 'setor', 'responsavel',
    'proxima_acao', 'status', 'novo_pedido', 'cliente_tem_desconto', 'vendedor',
    'descricao_situacao', 'origem_planilha_aba', 'origem_linha', 'prioridade', 'agendado_para',
    'pcp_pedido_id', 'pcp_item_id', 'pcp_payload',
  ]
  const values = fields.map(field => row[field] ?? null)
  values.push(userId, userId)
  const placeholders = fields.map((_, index) => `$${index + 1}`)
  const userCreatedIndex = values.length - 1
  const userUpdatedIndex = values.length
  const updates = fields
    .filter(field => !['origem_planilha_aba', 'origem_linha'].includes(field))
    .map(field => `${field} = excluded.${field}`)
    .concat(`updated_by_clerk_user_id = $${userUpdatedIndex}`)
    .join(', ')

  const { rows } = await pool.query(`
    insert into cscx_atendimentos (${fields.join(', ')}, created_by_clerk_user_id, updated_by_clerk_user_id)
    values (${placeholders.join(', ')}, $${userCreatedIndex}, $${userUpdatedIndex})
    on conflict (origem_planilha_aba, origem_linha)
    where origem_planilha_aba is not null and origem_linha is not null
    do update set ${updates}
    returning *
  `, values)
  return rows[0]
}

function normalizePcpPedido(row) {
  const payload = row.last_webhook_payload ?? null
  const body = payload?.body ?? payload ?? {}
  const pedidoPayload = body.pedido ?? {}
  const clientePayload = body.cliente ?? {}
  const vendedorPayload = body.vendedor ?? {}
  const itens = Array.isArray(row.pedido_itens) ? row.pedido_itens : []
  const pedidoValorTotal = toNumberOrNull(pedidoPayload.valor_total)

  return {
    id: row.id,
    codigo_venda: String(row.codigo_venda ?? ''),
    codigo_cliente: stringOrNull(row.codigo_cliente ?? clientePayload.codigo),
    nome_cliente: stringOrNull(row.nome_cliente ?? clientePayload.nome),
    vendedor: stringOrNull(vendedorPayload.nome),
    data_pedido: row.data_pedido ?? null,
    data_entrega: row.data_entrega ?? null,
    data_faturamento: row.data_faturamento ?? null,
    situacao_erp: row.situacao_erp ?? null,
    financeiro_bloqueado: Boolean(row.financeiro_bloqueado),
    observacoes: row.observacoes ?? null,
    valor_total: pedidoValorTotal,
    itens: itens.map(item => normalizePcpItem(item, itens.length, pedidoValorTotal)),
  }
}

function normalizePcpItem(item, itemCount, pedidoValorTotal) {
  const produto = Array.isArray(item.produto) ? item.produto[0] : item.produto
  const quantidade = toNumberOrNull(item.quantidade)
  const valorTotal = itemCount === 1 ? pedidoValorTotal : null
  const valorUnitario = valorTotal != null && quantidade ? valorTotal / quantidade : null
  return {
    id: item.id,
    produto_id: item.produto_id ?? null,
    codigo_produto: stringOrNull(produto?.id_erp),
    descricao_produto: stringOrNull(produto?.nome),
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    obs: item.obs ?? null,
  }
}

async function hydrateItemValuesFromHistory(pedido) {
  if (!pedido?.codigo_venda || !pedido.itens?.length) return
  const { rows } = await pool.query(`
    select codigo_produto, descricao_produto, quantidade, valor_unitario, valor_total
    from cscx_atendimentos
    where numero_pedido = $1
  `, [pedido.codigo_venda])
  if (!rows.length) return

  for (const item of pedido.itens) {
    const codigo = String(item.codigo_produto ?? '').trim().toLowerCase()
    const descricao = String(item.descricao_produto ?? '').trim().toLowerCase()
    const match = rows.find(row => {
      const rowCodigo = String(row.codigo_produto ?? '').trim().toLowerCase()
      const rowDescricao = String(row.descricao_produto ?? '').trim().toLowerCase()
      return (codigo && rowCodigo === codigo) || (descricao && rowDescricao === descricao)
    })
    if (!match) continue
    item.quantidade = item.quantidade ?? toNumberOrNull(match.quantidade)
    item.valor_unitario = item.valor_unitario ?? toNumberOrNull(match.valor_unitario)
    item.valor_total = item.valor_total ?? toNumberOrNull(match.valor_total)
  }
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' })
})

app.listen(PORT, () => {
  console.log(`CS/CX API rodando na porta ${PORT}`)
})
