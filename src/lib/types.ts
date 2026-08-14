export interface Atendimento {
  id: string
  data_solicitacao: string | null
  numero_pedido: string | null
  codigo_cliente: string | null
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
  concluido_em: string | null
  reembolso_valor: number | null
  reembolso_motivo: string | null
  reembolso_em: string | null
  pcp_pedido_id?: string | null
  pcp_item_id?: string | null
  pcp_payload?: unknown
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

export interface Usuario {
  id: string
  clerk_user_id: string | null
  email: string
  nome: string | null
  papel: 'admin' | 'cs'
  ativo: boolean
  convite_id: string | null
  convite_status: string | null
  convite_enviado_em: string | null
  created_at: string
  updated_at: string
}

export interface DashboardData {
  totais: {
    total: number
    abertos: number
    hoje: number
    atendimentos_hoje: number
    solucionados: number
    reembolsados: number
    valor_reembolso: string
    valor_total: string
  }
  proximos: Atendimento[]
  status: { status: string; total: number }[]
  por_data: { data: string; total: number; solucionados: number; reembolsados: number }[]
}

export interface CadastroOptions {
  setores: string[]
  responsaveis: string[]
}

export interface PcpPedidoItem {
  id: string
  produto_id: string | null
  codigo_produto: string | null
  descricao_produto: string | null
  quantidade: number | null
  valor_unitario: number | null
  valor_total: number | null
  obs: string | null
}

export interface PcpPedido {
  id: string
  codigo_venda: string
  codigo_cliente: string | null
  nome_cliente: string | null
  vendedor: string | null
  data_pedido: string | null
  data_entrega: string | null
  data_faturamento: string | null
  situacao_erp: string | null
  financeiro_bloqueado: boolean
  observacoes: string | null
  valor_total: number | null
  itens: PcpPedidoItem[]
}
