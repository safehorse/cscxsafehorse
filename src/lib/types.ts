export interface Atendimento {
  id: string
  data_solicitacao: string | null
  numero_pedido: string | null
  cliente: string | null
  codigo_produto: string | null
  descricao_produto: string | null
  quantidade: number | null
  valor_unitario: number | null
  valor_total: number | null
  motivo: string | null
  setor: string | null
  responsavel: string | null
  proxima_acao: string | null
  status: string
  novo_pedido: string | null
  cliente_tem_desconto: string | null
  vendedor: string | null
  descricao_situacao: string | null
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente'
  agendado_para: string | null
  created_at: string
  updated_at: string
  interacoes?: Interacao[]
  agenda?: Agendamento[]
}

export interface Interacao {
  id: string
  atendimento_id: string
  tipo: 'nota' | 'ligacao' | 'whatsapp' | 'email' | 'reuniao'
  descricao: string
  realizado_em: string
}

export interface Agendamento {
  id: string
  atendimento_id: string | null
  titulo: string
  inicio: string
  fim: string | null
  status: 'pendente' | 'feito' | 'cancelado'
  responsavel: string | null
  observacao: string | null
}

export interface DashboardData {
  totais: {
    total: number
    abertos: number
    hoje: number
    valor_total: string
  }
  proximos: Atendimento[]
  status: { status: string; total: number }[]
}
