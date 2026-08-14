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
  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value)
    return excelEpoch.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  if (!text) return null
  if (/^\d+([,.]\d+)?$/.test(text)) return toDateOrNull(Number(text.replace(',', '.')))
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function buildAtendimentoFilters(query) {
  const search = String(query.search || '').trim()
  const status = String(query.status || '').trim()
  const responsavel = String(query.responsavel || '').trim()
  const dateFrom = toDateOrNull(query.dateFrom || query.dataInicio)
  const dateTo = toDateOrNull(query.dateTo || query.dataFim)
  const year = Number(query.year || query.ano)
  const values = []
  const where = []

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

  if (dateFrom) {
    values.push(dateFrom)
    where.push(`data_solicitacao >= $${values.length}::date`)
  }

  if (dateTo) {
    values.push(dateTo)
    where.push(`data_solicitacao < ($${values.length}::date + interval '1 day')`)
  }

  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    values.push(year)
    where.push(`extract(year from data_solicitacao)::int = $${values.length}`)
  }

  return { values, where }
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

  const extToken = req.header('x-whatsapp-token')
  if (extToken) {
    const { rows } = await pool.query('select clerk_user_id from cscx_whatsapp_extensao where token = $1', [extToken])
    if (!rows[0]) return res.status(401).json({ error: 'Token da extensão inválido.' })
    req.auth = { type: 'extensao', sub: rows[0].clerk_user_id }
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

app.get('/api/dashboard', asyncRoute(async (req, res) => {
  const filters = buildAtendimentoFilters(req.query)
  const whereSql = filters.where.length ? `where ${filters.where.join(' and ')}` : ''

  const [totais, proximos, statusRows, porDataRows] = await Promise.all([
    pool.query(`
      select
        count(*)::int as total,
        count(*) filter (where upper(status) not in ('FINALIZADO', 'CONCLUIDO', 'CANCELADO'))::int as abertos,
        count(*) filter (where agendado_para::date = current_date)::int as hoje,
        count(*) filter (where created_at::date = current_date)::int as atendimentos_hoje,
        count(*) filter (where upper(status) in ('FINALIZADO', 'CONCLUIDO'))::int as solucionados,
        count(*) filter (where reembolso_valor is not null or nullif(trim(coalesce(reembolso_motivo, '')), '') is not null)::int as reembolsados,
        coalesce(sum(reembolso_valor), 0)::numeric as valor_reembolso,
        coalesce(sum(valor_total), 0)::numeric as valor_total
      from cscx_atendimentos
      ${whereSql}
    `, filters.values),
    pool.query(`
      select id, numero_pedido, cliente, status, responsavel, agendado_para, proxima_acao
      from cscx_atendimentos
      where agendado_para is not null${filters.where.length ? ` and ${filters.where.join(' and ')}` : ''}
      order by agendado_para asc
      limit 8
    `, filters.values),
    pool.query(`
      select status, count(*)::int as total
      from cscx_atendimentos
      ${whereSql}
      group by status
      order by total desc, status asc
    `, filters.values),
    pool.query(`
      select
        data_solicitacao::date as data,
        count(*)::int as total,
        count(*) filter (where upper(status) in ('FINALIZADO', 'CONCLUIDO'))::int as solucionados,
        count(*) filter (where reembolso_valor is not null or nullif(trim(coalesce(reembolso_motivo, '')), '') is not null)::int as reembolsados
      from cscx_atendimentos
      ${whereSql ? `${whereSql} and data_solicitacao is not null` : 'where data_solicitacao is not null'}
      group by data_solicitacao::date
      order by data_solicitacao::date asc
    `, filters.values),
  ])

  res.json({
    totais: totais.rows[0],
    proximos: proximos.rows,
    status: statusRows.rows,
    por_data: porDataRows.rows,
  })
}))

app.get('/api/cadastros', asyncRoute(async (_req, res) => {
  const [setores, responsaveis, proximasAcoes] = await Promise.all([
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
    pool.query(`
      select nome from cscx_proximas_acoes where ativo = true
      union
      select distinct trim(proxima_acao) from cscx_atendimentos where nullif(trim(coalesce(proxima_acao, '')), '') is not null
      order by nome
    `),
  ])
  res.json({
    setores: setores.rows.map(row => row.nome),
    responsaveis: responsaveis.rows.map(row => row.nome),
    proximasAcoes: proximasAcoes.rows.map(row => row.nome),
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

app.patch('/api/usuarios/me', asyncRoute(async (req, res) => {
  const nome = stringOrNull(req.body.nome)
  if (!nome) return res.status(400).json({ error: 'Informe o nome.' })

  const { rows } = await pool.query(`
    update cscx_usuarios
    set nome = $2
    where clerk_user_id = $1
    returning *
  `, [getUserId(req), nome])

  if (rows[0]) return res.json({ data: rows[0] })

  const email = normalizeEmail(req.body.email)
  if (!email) return res.status(404).json({ error: 'UsuÃ¡rio nÃ£o encontrado.' })

  const inserted = await pool.query(`
    insert into cscx_usuarios (clerk_user_id, email, nome, papel, ativo)
    values ($1, $2, $3, 'cs', true)
    returning *
  `, [getUserId(req), email, nome])

  res.status(201).json({ data: inserted.rows[0] })
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

app.post('/api/cadastros/proximas-acoes', asyncRoute(async (req, res) => {
  const nome = stringOrNull(req.body.nome)
  if (!nome) return res.status(400).json({ error: 'Informe a próxima ação.' })
  const { rows } = await pool.query(`
    insert into cscx_proximas_acoes (nome)
    values ($1)
    on conflict (nome) do update set ativo = true
    returning *
  `, [nome])
  res.status(201).json({ data: rows[0] })
}))

app.get('/api/atendimentos', asyncRoute(async (req, res) => {
  const requestedPage = Number(req.query.page || 1)
  const requestedPageSize = Number(req.query.pageSize || 20)
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 5), 100) : 20
  const offset = (page - 1) * pageSize
  const filters = buildAtendimentoFilters(req.query)
  const values = [...filters.values]

  const whereSql = filters.where.length ? `where ${filters.where.join(' and ')}` : ''
  const countSql = `select count(*)::int as total from cscx_atendimentos ${whereSql}`
  const countValues = [...filters.values]

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

app.get('/api/kanban/atendimentos', asyncRoute(async (req, res) => {
  const filters = buildAtendimentoFilters(req.query)
  const whereSql = filters.where.length ? `where ${filters.where.join(' and ')}` : ''
  const { rows } = await pool.query(`
    select *
    from cscx_atendimentos
    ${whereSql}
    order by coalesce(agendado_para, updated_at, created_at) desc
    limit 500
  `, filters.values)
  res.json({ data: rows })
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
    'reembolso_valor', 'reembolso_motivo', 'reembolso_em',
    'pcp_pedido_id', 'pcp_item_id', 'pcp_payload',
  ]
  const sets = []
  const values = []
  for (const field of allowed) {
    if (!(field in req.body)) continue
    values.push(normalizePatchValue(field, req.body[field]))
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

const EXTENSAO_STALE_MS = 45_000

app.get('/api/whatsapp/extensao', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    'select token, status, ultimo_ping from cscx_whatsapp_extensao where clerk_user_id = $1',
    [getUserId(req)],
  )
  const row = rows[0]
  if (!row) return res.json({ data: null })
  const ativo = row.ultimo_ping && (Date.now() - new Date(row.ultimo_ping).getTime()) < EXTENSAO_STALE_MS
  res.json({ data: { token: row.token, status: ativo ? row.status : 'desconectado', ultimo_ping: row.ultimo_ping } })
}))

app.post('/api/whatsapp/extensao/token', asyncRoute(async (req, res) => {
  const userId = getUserId(req)
  const token = randomToken()
  const { rows } = await pool.query(`
    insert into cscx_whatsapp_extensao (clerk_user_id, token, status)
    values ($1, $2, 'desconectado')
    on conflict (clerk_user_id) do update set token = excluded.token, status = 'desconectado', ultimo_ping = null
    returning token, status, ultimo_ping
  `, [userId, token])
  res.json({ data: rows[0] })
}))

app.post('/api/whatsapp/extensao/ping', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'extensao') return res.status(403).json({ error: 'Somente a extensão pode chamar esta rota.' })
  const status = req.body.status === 'conectado' ? 'conectado' : 'desconectado'
  await pool.query(
    'update cscx_whatsapp_extensao set status = $2, ultimo_ping = now() where clerk_user_id = $1',
    [getUserId(req), status],
  )
  res.json({ data: { ok: true } })
}))

app.post('/api/whatsapp/extensao/chats', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'extensao') return res.status(403).json({ error: 'Somente a extensão pode chamar esta rota.' })
  const chats = Array.isArray(req.body.chats) ? req.body.chats : []
  for (const chat of chats.slice(0, 200)) {
    const telefone = phoneFromWhatsappId(chat.id)
    if (!telefone) continue
    await upsertWhatsappContato({
      whatsappId: chat.id,
      telefone,
      nome: stringOrNull(chat.nome),
      lastMessageAt: chat.lastMessageAt || null,
      lastMessage: stringOrNull(chat.lastMessage),
      unreadCount: Number(chat.unreadCount) || 0,
    })
  }
  res.json({ data: { ok: true, total: chats.length } })
}))

app.post('/api/whatsapp/extensao/mensagens', asyncRoute(async (req, res) => {
  if (req.auth.type !== 'extensao') return res.status(403).json({ error: 'Somente a extensão pode chamar esta rota.' })
  const mensagens = Array.isArray(req.body.mensagens) ? req.body.mensagens : []
  let salvas = 0
  for (const message of mensagens.slice(0, 200)) {
    const whatsappId = message.chatId
    const telefone = phoneFromWhatsappId(whatsappId)
    if (!telefone || !message.id) continue
    const contato = await upsertWhatsappContato({
      whatsappId,
      telefone,
      nome: stringOrNull(message.chatNome),
      lastMessageAt: message.timestamp || null,
      lastMessage: message.fromMe ? undefined : stringOrNull(message.body),
    })
    await pool.query(`
      insert into cscx_whatsapp_mensagens (
        contato_id, whatsapp_message_id, whatsapp_id, telefone, direcao, conteudo, tipo, enviado_em
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (whatsapp_message_id) do update set
        conteudo = excluded.conteudo,
        tipo = excluded.tipo
    `, [
      contato.id,
      message.id,
      whatsappId,
      telefone,
      message.fromMe ? 'saida' : 'entrada',
      message.body || '',
      message.type || 'chat',
      message.timestamp || new Date().toISOString(),
    ])
    salvas += 1
  }
  res.json({ data: { ok: true, total: salvas } })
}))

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

app.get('/api/whatsapp/chats', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    select whatsapp_id as id, telefone, nome, codigo_cliente, cliente_nome, unread_count, last_message, last_message_at
    from cscx_whatsapp_contatos
    order by last_message_at desc nulls last
    limit 60
  `)
  res.json({ data: rows })
}))

app.get('/api/whatsapp/chats/:chatId/messages', asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 40), 5), 80)
  const { rows: contatoRows } = await pool.query(
    'select * from cscx_whatsapp_contatos where whatsapp_id = $1',
    [req.params.chatId],
  )
  const saved = contatoRows[0]
  if (!saved) return res.json({ data: { contato: null, mensagens: [], chamados: [] } })
  const { rows: mensagens } = await pool.query(
    'select * from cscx_whatsapp_mensagens where contato_id = $1 order by enviado_em desc limit $2',
    [saved.id, limit],
  )
  mensagens.reverse()
  const chamados = saved.codigo_cliente ? await findAtendimentosByCodigoCliente(saved.codigo_cliente) : []
  res.json({ data: { contato: saved, mensagens, chamados } })
}))

app.patch('/api/whatsapp/contatos/:id', asyncRoute(async (req, res) => {
  const codigoCliente = identifierOrNull(req.body.codigo_cliente ?? req.body.codigoCliente)
  const clienteNome = stringOrNull(req.body.cliente_nome ?? req.body.clienteNome)
  const observacao = stringOrNull(req.body.observacao)
  const { rows } = await pool.query(`
    update cscx_whatsapp_contatos
    set codigo_cliente = $1,
        cliente_nome = $2,
        observacao = $3
    where id = $4
    returning *
  `, [codigoCliente, clienteNome, observacao, req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Contato nÃ£o encontrado.' })
  if (codigoCliente) {
    await upsertClienteLink(codigoCliente, clienteNome, rows[0].telefone).catch(() => null)
  }
  const chamados = rows[0].codigo_cliente ? await findAtendimentosByCodigoCliente(rows[0].codigo_cliente) : []
  res.json({ data: { contato: rows[0], chamados } })
}))

async function upsertClienteLink(codigoCliente, nome, telefone) {
  const byCodigo = await pool.query('select id from cscx_clientes where codigo_cliente = $1', [codigoCliente])
  if (byCodigo.rows[0]) {
    return pool.query(
      'update cscx_clientes set nome = coalesce($2, nome), telefone = $3 where id = $1',
      [byCodigo.rows[0].id, nome, telefone],
    )
  }
  if (telefone) {
    const byTelefone = await pool.query('select id from cscx_clientes where telefone = $1', [telefone])
    if (byTelefone.rows[0]) {
      return pool.query(
        'update cscx_clientes set codigo_cliente = $2, nome = coalesce($3, nome) where id = $1',
        [byTelefone.rows[0].id, codigoCliente, nome],
      )
    }
  }
  return pool.query(
    'insert into cscx_clientes (codigo_cliente, nome, telefone) values ($1, $2, $3)',
    [codigoCliente, nome, telefone],
  )
}

app.get('/api/whatsapp/clientes', asyncRoute(async (req, res) => {
  const search = String(req.query.search || '').trim()
  if (search.length < 2) return res.json({ data: [] })
  const { rows } = await pool.query(`
    with chamados_por_cliente as (
      select codigo_cliente, count(*)::int as chamados, max(cliente) as cliente
      from cscx_atendimentos
      where codigo_cliente is not null
      group by codigo_cliente
    ),
    combinado as (
      select c.codigo_cliente, coalesce(c.nome, a.cliente) as cliente, coalesce(a.chamados, 0) as chamados
      from cscx_clientes c
      left join chamados_por_cliente a on a.codigo_cliente = c.codigo_cliente
      union
      select a.codigo_cliente, a.cliente, a.chamados
      from chamados_por_cliente a
      where not exists (select 1 from cscx_clientes c where c.codigo_cliente = a.codigo_cliente)
    )
    select codigo_cliente, cliente, chamados
    from combinado
    where codigo_cliente ilike $1 or cliente ilike $1
    order by cliente asc nulls last
    limit 12
  `, [`%${search}%`])
  res.json({ data: rows })
}))

app.get('/api/pcp/pedidos/:codigo', asyncRoute(async (req, res) => {
  if (!PCP_API_URL || !PCP_API_KEY) return res.status(500).json({ error: 'Integração PCP não configurada.' })
  const codigo = encodeURIComponent(normalizePedidoCodigo(req.params.codigo))
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

app.get('/api/pcp/clientes/:codigoCliente/pedidos', asyncRoute(async (req, res) => {
  if (!PCP_API_URL || !PCP_API_KEY) return res.status(500).json({ error: 'Integração PCP não configurada.' })
  const codigo = encodeURIComponent(String(req.params.codigoCliente || '').trim())
  if (!codigo) return res.json({ data: [] })
  const select = encodeURIComponent('id,codigo_venda,codigo_cliente,nome_cliente,data_pedido,data_entrega,data_faturamento,situacao_erp,financeiro_bloqueado,last_webhook_payload')
  const response = await fetch(`${PCP_API_URL}/rest/v1/pedidos?codigo_cliente=eq.${codigo}&select=${select}&order=data_pedido.desc&limit=20`, {
    headers: { apikey: PCP_API_KEY, Authorization: `Bearer ${PCP_API_KEY}` },
  })
  const data = await response.json().catch(() => [])
  if (!response.ok) return res.status(response.status).json({ error: data?.message || 'Falha ao consultar pedidos do cliente.' })
  res.json({ data: (Array.isArray(data) ? data : []).map(normalizePcpPedido) })
}))

app.post('/api/clientes/sync', asyncRoute(async (_req, res) => {
  const result = await syncClientesFromPcp()
  res.json({ data: result })
}))

function normalizePedidoCodigo(value) {
  return String(value || '').trim().replace(/\.0+$/, '')
}

async function syncClientesFromPcp() {
  if (!PCP_API_URL || !PCP_API_KEY) {
    const error = new Error('Integração PCP não configurada.')
    error.status = 500
    throw error
  }
  const clientes = new Map()
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(
      `${PCP_API_URL}/rest/v1/pedidos?select=codigo_cliente,nome_cliente&codigo_cliente=not.is.null&order=codigo_cliente&offset=${offset}&limit=${pageSize}`,
      { headers: { apikey: PCP_API_KEY, Authorization: `Bearer ${PCP_API_KEY}` } },
    )
    const page = await response.json().catch(() => [])
    if (!response.ok) {
      const error = new Error(page?.message || 'Falha ao consultar clientes no PCP.')
      error.status = response.status
      throw error
    }
    for (const row of page) {
      const codigo = String(row.codigo_cliente || '').trim()
      if (!codigo) continue
      if (!clientes.has(codigo) && row.nome_cliente) clientes.set(codigo, row.nome_cliente)
      else if (!clientes.has(codigo)) clientes.set(codigo, null)
    }
    if (!Array.isArray(page) || page.length < pageSize) break
  }

  let upserted = 0
  for (const [codigo, nome] of clientes) {
    await pool.query(`
      insert into cscx_clientes (codigo_cliente, nome)
      values ($1, $2)
      on conflict (codigo_cliente) do update set
        nome = coalesce(cscx_clientes.nome, excluded.nome)
    `, [codigo, nome])
    upserted += 1
  }
  return { total: upserted }
}

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
    numero_pedido: identifierOrNull(body.numero_pedido ?? body.numeroPedido ?? body['Nº DO PEDIDO'] ?? body['N DO PEDIDO']),
    codigo_cliente: identifierOrNull(body.codigo_cliente ?? body.codigoCliente),
    cliente: stringOrNull(body.cliente ?? body['CLIENTE']),
    codigo_produto: identifierOrNull(body.codigo_produto ?? body.codigoProduto ?? body['COD. PRODUTO']),
    descricao_produto: stringOrNull(body.descricao_produto ?? body.descricaoProduto ?? body['DESCRICAO DO PRODUTO']),
    quantidade: toNumberOrNull(body.quantidade ?? body['QUANTIDADE']),
    valor_unitario: toNumberOrNull(body.valor_unitario ?? body.valorUnitario ?? body['VALOR UNITARIO']),
    valor_total: toNumberOrNull(body.valor_total ?? body.valorTotal ?? body['VALOR TOTAL']),
    motivo: stringOrNull(body.motivo ?? body['SOLICITACAO/ MOTIVO'] ?? body['QUAL A SOLICITACAO']),
    setor: stringOrNull(body.setor ?? body['SETOR'] ?? body['SETOR RESPONSAVEL']),
    responsavel: stringOrNull(body.responsavel ?? body['RESPONSAVEL']),
    proxima_acao: stringOrNull(body.proxima_acao ?? body.proximaAcao ?? body['PROXIMA ACAO'] ?? body['RESOLUCAO COM CLIENTE']),
    status: normalizaStatus(body.status ?? body['STATUS'] ?? body['STATUS ACOMPANHAMENTO']),
    novo_pedido: identifierOrNull(body.novo_pedido ?? body.novoPedido ?? body['NOVO PEDIDO']),
    cliente_tem_desconto: stringOrNull(body.cliente_tem_desconto ?? body.clienteTemDesconto ?? body['CLIENTE TEM DESCONTO']),
    vendedor: stringOrNull(body.vendedor ?? body['VENDEDOR']),
    descricao_situacao: stringOrNull(body.descricao_situacao ?? body.descricaoSituacao ?? body['DESCRICAO DA SITUACAO:'] ?? body['INFORMACOES GERAIS']),
    origem_planilha_aba: stringOrNull(body.origem_planilha_aba ?? body.origemAba),
    origem_linha: Number.isFinite(Number(body.origem_linha ?? body.origemLinha)) ? Number(body.origem_linha ?? body.origemLinha) : null,
    prioridade: body.prioridade || 'normal',
    agendado_para: body.agendado_para || body.agendadoPara || null,
    concluido_em: body.concluido_em || body.concluidoEm || null,
    reembolso_valor: toNumberOrNull(body.reembolso_valor ?? body.reembolsoValor),
    reembolso_motivo: stringOrNull(body.reembolso_motivo ?? body.reembolsoMotivo),
    reembolso_em: body.reembolso_em || body.reembolsoEm || null,
    pcp_pedido_id: stringOrNull(body.pcp_pedido_id ?? body.pcpPedidoId),
    pcp_item_id: stringOrNull(body.pcp_item_id ?? body.pcpItemId),
    pcp_payload: body.pcp_payload ?? body.pcpPayload ?? null,
  }
}

function normalizePatchValue(field, value) {
  if (field === 'status') return normalizaStatus(value)
  if (['numero_pedido', 'codigo_cliente', 'codigo_produto', 'novo_pedido'].includes(field)) return identifierOrNull(value)
  if (['quantidade', 'valor_unitario', 'valor_total', 'reembolso_valor'].includes(field)) return toNumberOrNull(value)
  if (field === 'data_solicitacao') return toDateOrNull(value)
  if (['agendado_para', 'concluido_em', 'reembolso_em'].includes(field)) return value || null
  if (field === 'pcp_payload') return value ?? null
  return stringOrNull(value)
}

function identifierOrNull(value) {
  return stringOrNull(value)?.replace(/\.0+$/, '') ?? null
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null
  const text = fixQuestionMarks(String(value)).trim()
  return text || null
}

function fixQuestionMarks(value) {
  return String(value)
    .replace(/\?\?ES/g, 'ÇÕES')
    .replace(/\?\?es/g, 'ções')
    .replace(/\?\?O/g, 'ÇÃO')
    .replace(/\?\?o/g, 'ção')
    .replace(/SOLICITA\?AO/g, 'SOLICITAÇÃO')
    .replace(/PRODU\?AO/g, 'PRODUÇÃO')
    .replace(/SEPARA\?AO/g, 'SEPARAÇÃO')
    .replace(/PROTE\?AO/g, 'PROTEÇÃO')
    .replace(/DEVOLU\?AO/g, 'DEVOLUÇÃO')
    .replace(/INFORMA\?OES/g, 'INFORMAÇÕES')
    .replace(/CORRE\?AO/g, 'CORREÇÃO')
    .replace(/AVALIA\?AO/g, 'AVALIAÇÃO')
    .replace(/CONFIRMA\?AO/g, 'CONFIRMAÇÃO')
    .replace(/ACEITA\?AO/g, 'ACEITAÇÃO')
    .replace(/OP\?AO/g, 'OPÇÃO')
    .replace(/SOLICITA\?ao/g, 'SOLICITAção')
    .replace(/solicita\?ao/g, 'solicitação')
    .replace(/produ\?ao/g, 'produção')
    .replace(/corre\?ao/g, 'correção')
    .replace(/avalia\?ao/g, 'avaliação')
    .replace(/confirma\?ao/g, 'confirmação')
    .replace(/aceita\?ao/g, 'aceitação')
    .replace(/op\?ao/g, 'opção')
    .replace(/CAL\?A/g, 'CALÇA')
    .replace(/cal\?a/g, 'calça')
    .replace(/CABE\?ADA/g, 'CABEÇADA')
    .replace(/cabe\?ada/g, 'cabeçada')
    .replace(/PE\?AS/g, 'PEÇAS')
    .replace(/pe\?as/g, 'peças')
    .replace(/PE\?A/g, 'PEÇA')
    .replace(/pe\?a/g, 'peça')
    .replace(/LA\?O/g, 'LAÇO')
    .replace(/la\?o/g, 'laço')
    .replace(/CR\?DITO/g, 'CRÉDITO')
    .replace(/C\?REDITO/g, 'CRÉDITO')
    .replace(/cr\?dito/g, 'crédito')
    .replace(/N\?O/g, 'NÃO')
    .replace(/n\?o/g, 'não')
    .replace(/ALGOD\?O/g, 'ALGODÃO')
    .replace(/FERR\?O/g, 'FERRÃO')
    .replace(/ferr\?o/g, 'ferrão')
    .replace(/CAF\?/g, 'CAFÉ')
    .replace(/CAMUR\?A/g, 'CAMURÇA')
    .replace(/CHAP\?U/g, 'CHAPÉU')
    .replace(/chap\?u/g, 'chapéu')
    .replace(/chap\?us/g, 'chapéus')
    .replace(/CABE\?A/g, 'CABEÇA')
    .replace(/DIFEREN\?A/g, 'DIFERENÇA')
    .replace(/tr\?s/g, 'três')
    .replace(/ir\?/g, 'irá')
    .replace(/enviar\?/g, 'enviará')
    .replace(/realizar\?/g, 'realizará')
    .replace(/ser\?/g, 'será')
    .replace(/respons\?vel/g, 'responsável')
    .replace(/equ\?voco/g, 'equívoco')
    .replace(/ap\?s/g, 'após')
    .replace(/Ap\?s/g, 'Após')
    .replace(/j\?/g, 'já')
    .replace(/\?poca/g, 'época')
    .replace(/necess\?rio/g, 'necessário')
    .replace(/NECESS\?RIO/g, 'NECESSÁRIO')
    .replace(/necess\?ria/g, 'necessária')
    .replace(/an\?lise/g, 'análise')
    .replace(/aus\?ncia/g, 'ausência')
    .replace(/at\?/g, 'até')
    .replace(/AT\?/g, 'ATÉ')
    .replace(/confer\?ncia/g, 'conferência')
    .replace(/ocorr\?ncia/g, 'ocorrência')
    .replace(/espec\?ficas/g, 'específicas')
    .replace(/v\?rios/g, 'vários')
    .replace(/inclu\?das/g, 'incluídas')
    .replace(/tamb\?m/g, 'também')
    .replace(/por\?m/g, 'porém')
    .replace(/POR\?M/g, 'PORÉM')
    .replace(/est\?o/g, 'estão')
    .replace(/EST\?O/g, 'ESTÃO')
    .replace(/estav\?o/g, 'estavam')
    .replace(/OT\?VIO/g, 'OTÁVIO')
    .replace(/ENT\?O/g, 'ENTÃO')
    .replace(/LAN\?OU/g, 'LANÇOU')
    .replace(/lan\?ou/g, 'lançou')
    .replace(/LAN\?ADA/g, 'LANÇADA')
    .replace(/LAN\?ADO/g, 'LANÇADO')
    .replace(/QUAL \? EXATAMENTE/g, 'QUAL É EXATAMENTE')
    .replace(/ agora \? necessário/g, ' agora é necessário')
    .replace(/ não \? indicado/g, ' não é indicado')
    .replace(/O CLIENTE \? DE/g, 'O CLIENTE É DE')
    .replace(/ENTREI \?PARA/g, 'ENTREI PARA')
    .replace(/referentes \? /g, 'referentes à ')
    .replace(/quanto \? /g, 'quanto à ')
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
    'concluido_em', 'reembolso_valor', 'reembolso_motivo', 'reembolso_em',
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
    codigo_venda: normalizePedidoCodigo(row.codigo_venda),
    codigo_cliente: identifierOrNull(row.codigo_cliente ?? clientePayload.codigo),
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
    codigo_produto: identifierOrNull(produto?.id_erp),
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

function phoneFromWhatsappId(value) {
  return String(value || '').split('@')[0].replace(/\D/g, '')
}

async function upsertWhatsappContato({ whatsappId, telefone, nome, lastMessageAt, lastMessage, unreadCount }) {
  const cleanedPhone = phoneFromWhatsappId(telefone || whatsappId)
  if (!cleanedPhone || !whatsappId) {
    const error = new Error('Telefone do WhatsApp nÃ£o identificado.')
    error.status = 400
    throw error
  }
  const { rows } = await pool.query(`
    insert into cscx_whatsapp_contatos (telefone, whatsapp_id, nome, last_message_at, last_message, unread_count)
    values ($1, $2, $3, $4, $5, coalesce($6, 0))
    on conflict (telefone) do update set
      whatsapp_id = excluded.whatsapp_id,
      nome = coalesce(cscx_whatsapp_contatos.nome, excluded.nome),
      last_message_at = greatest(coalesce(cscx_whatsapp_contatos.last_message_at, '-infinity'::timestamptz), coalesce(excluded.last_message_at, '-infinity'::timestamptz)),
      last_message = coalesce($5, cscx_whatsapp_contatos.last_message),
      unread_count = coalesce($6, cscx_whatsapp_contatos.unread_count)
    returning *
  `, [cleanedPhone, whatsappId, stringOrNull(nome), lastMessageAt, lastMessage ?? null, unreadCount ?? null])
  const contato = rows[0]
  if (!contato.codigo_cliente) {
    const matched = await matchClienteByTelefone(cleanedPhone)
    if (matched) return linkWhatsappContatoCliente(contato.id, matched.codigo_cliente, matched.nome)
  }
  return contato
}

async function matchClienteByTelefone(telefone) {
  const { rows } = await pool.query(
    'select codigo_cliente, nome from cscx_clientes where telefone = $1 limit 1',
    [telefone],
  )
  return rows[0] || null
}

async function linkWhatsappContatoCliente(contatoId, codigoCliente, clienteNome) {
  const { rows } = await pool.query(`
    update cscx_whatsapp_contatos
    set codigo_cliente = $2, cliente_nome = coalesce(cliente_nome, $3)
    where id = $1
    returning *
  `, [contatoId, codigoCliente, stringOrNull(clienteNome)])
  return rows[0]
}

async function saveWhatsappMessage(contatoId, message) {
  const whatsappId = message.fromMe ? message.to : message.from
  const telefone = phoneFromWhatsappId(whatsappId)
  const enviadoEm = message.timestamp ? new Date(message.timestamp * 1000).toISOString() : new Date().toISOString()
  const { rows } = await pool.query(`
    insert into cscx_whatsapp_mensagens (
      contato_id, whatsapp_message_id, whatsapp_id, telefone, direcao, conteudo, tipo, enviado_em
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (whatsapp_message_id) do update set
      conteudo = excluded.conteudo,
      tipo = excluded.tipo
    returning *
  `, [
    contatoId,
    message.id?._serialized || null,
    whatsappId,
    telefone,
    message.fromMe ? 'saida' : 'entrada',
    message.body || '',
    message.type || 'chat',
    enviadoEm,
  ])
  await pool.query('update cscx_whatsapp_contatos set last_message_at = greatest(coalesce(last_message_at, $2::timestamptz), $2::timestamptz) where id = $1', [contatoId, enviadoEm])
  return rows[0]
}

async function findAtendimentosByCodigoCliente(codigoCliente) {
  const { rows } = await pool.query(`
    select *
    from cscx_atendimentos
    where codigo_cliente = $1
    order by coalesce(agendado_para, created_at) desc
    limit 20
  `, [codigoCliente])
  return rows
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' })
})

app.listen(PORT, () => {
  console.log(`CS/CX API rodando na porta ${PORT}`)
  if (DATABASE_URL && PCP_API_URL && PCP_API_KEY) {
    syncClientesFromPcp()
      .then(result => console.log(`Clientes sincronizados do PCP: ${result.total}`))
      .catch(error => console.error('Falha ao sincronizar clientes do PCP:', error.message))
  }
})
