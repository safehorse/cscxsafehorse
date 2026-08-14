update cscx_atendimentos
set status = case
  when upper(status) in ('AGUARDANDO DEVOLU??O', 'AGUARDANDO DEVOLUCAO', 'AGUARDANDO DEVOLUÇÃO') then 'AGUARDANDO DEVOLUÇÃO'
  when upper(status) in ('EM PRODU??O', 'EM PRODUCAO', 'EM PRODUÇÃO') then 'EM PRODUÇÃO'
  when upper(status) in ('EM ANALISE', 'EM ANÁLISE') then 'EM ANÁLISE'
  when upper(status) in ('CREDITO GERADO', 'CRÉDITO GERADO') then 'CRÉDITO GERADO'
  else status
end
where upper(status) in (
  'AGUARDANDO DEVOLU??O',
  'AGUARDANDO DEVOLUCAO',
  'AGUARDANDO DEVOLUÇÃO',
  'EM PRODU??O',
  'EM PRODUCAO',
  'EM PRODUÇÃO',
  'EM ANALISE',
  'EM ANÁLISE',
  'CREDITO GERADO',
  'CRÉDITO GERADO'
);
