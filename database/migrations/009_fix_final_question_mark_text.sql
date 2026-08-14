update cscx_atendimentos
set
  descricao_situacao = replace(replace(descricao_situacao, 'EST?O', 'ESTÃO'), 'NECESS?RIO', 'NECESSÁRIO'),
  descricao_produto = replace(replace(descricao_produto, 'EST?O', 'ESTÃO'), 'NECESS?RIO', 'NECESSÁRIO'),
  motivo = replace(replace(motivo, 'EST?O', 'ESTÃO'), 'NECESS?RIO', 'NECESSÁRIO'),
  proxima_acao = replace(replace(proxima_acao, 'EST?O', 'ESTÃO'), 'NECESS?RIO', 'NECESSÁRIO');
