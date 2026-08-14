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
const PCP_API_URL = (process.env.PCP_API_URL || '').replace(/\/$/, '')
const PCP_API_KEY = process.env.PCP_API_KEY || ''
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

if (!DATABASE_URL) {
  console.warn('DATABASE_URL nao configurado. O servidor vai iniciar, mas as rotas de banco falharao.')
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
  return value || 'ABERTO'
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
  if (!token) return res.status(401).json({ error: 'Autenticacao obrigatoria.' })
  if (!jwks) return res.status(500).json({ error: 'CLERK_JWKS_URL nao configurado no backend.' })

  try {
    const options = CLERK_JWT_ISSUER ? { issuer: CLERK_JWT_ISSUER } : undefined
    const { payload } = await jwtVerify(token, jwks, options)
    req.auth = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Sessao invalida ou expirada.' })
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

app.get('/api/atendimentos', asyncRoute(async (req, res) => {
  const search = String(req.query.search || '').trim()
  const status = String(req.query.status || '').trim()
  const responsavel = String(req.query.responsavel || '').trim()
  const limit = Math.min(Number(req.query.limit || 80), 200)

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

  values.push(limit)
  const sql = `
    select *
    from cscx_atendimentos
    ${where.length ? `where ${where.join(' and ')}` : ''}
    order by coalesce(agendado_para, created_at) desc
    limit $${values.length}
  `
  const { rows } = await pool.query(sql, values)
  res.json({ data: rows })
}))

app.get('/api/atendimentos/:id', asyncRoute(async (req, res) => {
  const atendimento = await pool.query('select * from cscx_atendimentos where id = $1', [req.params.id])
  if (!atendimento.rows[0]) return res.status(404).json({ error: 'Atendimento nao encontrado.' })

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
    'data_solicitacao', 'numero_pedido', 'cliente', 'codigo_produto', 'descricao_produto',
    'quantidade', 'valor_unitario', 'valor_total', 'motivo', 'setor', 'responsavel',
    'proxima_acao', 'status', 'novo_pedido', 'cliente_tem_desconto', 'vendedor',
    'descricao_situacao', 'prioridade', 'agendado_para', 'concluido_em',
  ]
  const sets = []
  const values = []
  for (const field of allowed) {
    if (!(field in req.body)) continue
    values.push(field === 'status' ? normalizaStatus(req.body[field]) : req.body[field] || null)
    sets.push(`${field} = $${values.length}`)
  }
  if (!sets.length) return res.status(400).json({ error: 'Nenhum campo valido para atualizar.' })
  values.push(getUserId(req))
  sets.push(`updated_by_clerk_user_id = $${values.length}`)
  values.push(req.params.id)
  const { rows } = await pool.query(`
    update cscx_atendimentos
    set ${sets.join(', ')}
    where id = $${values.length}
    returning *
  `, values)
  if (!rows[0]) return res.status(404).json({ error: 'Atendimento nao encontrado.' })
  res.json({ data: rows[0] })
}))

app.post('/api/atendimentos/:id/interacoes', asyncRoute(async (req, res) => {
  const tipo = String(req.body.tipo || 'nota')
  const descricao = String(req.body.descricao || '').trim()
  if (!descricao) return res.status(400).json({ error: 'Informe a descricao da interacao.' })
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
  if (!titulo || !inicio) return res.status(400).json({ error: 'Titulo e inicio sao obrigatorios.' })
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
  if (!PCP_API_URL || !PCP_API_KEY) return res.status(500).json({ error: 'Integracao PCP nao configurada.' })
  const codigo = encodeURIComponent(req.params.codigo)
  const select = encodeURIComponent('id,codigo_venda,codigo_cliente,nome_cliente,data_pedido,data_entrega,data_faturamento,situacao_erp,financeiro_bloqueado,observacoes,pedido_itens(id,quantidade,produto:produto_id(nome,id_erp))')
  const response = await fetch(`${PCP_API_URL}/rest/v1/pedidos?codigo_venda=eq.${codigo}&select=${select}`, {
    headers: { apikey: PCP_API_KEY, Authorization: `Bearer ${PCP_API_KEY}` },
  })
  const data = await response.json().catch(() => [])
  if (!response.ok) return res.status(response.status).json({ error: data?.message || 'Falha ao consultar PCP.' })
  res.json({ data: Array.isArray(data) ? data[0] || null : data })
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
  }
}

function stringOrNull(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

async function upsertAtendimento(row, userId) {
  const fields = [
    'data_solicitacao', 'numero_pedido', 'cliente', 'codigo_produto', 'descricao_produto',
    'quantidade', 'valor_unitario', 'valor_total', 'motivo', 'setor', 'responsavel',
    'proxima_acao', 'status', 'novo_pedido', 'cliente_tem_desconto', 'vendedor',
    'descricao_situacao', 'origem_planilha_aba', 'origem_linha', 'prioridade', 'agendado_para',
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

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Erro interno.' })
})

app.listen(PORT, () => {
  console.log(`CS/CX API rodando na porta ${PORT}`)
})
