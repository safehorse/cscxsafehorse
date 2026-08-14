alter table cscx_atendimentos
  add column if not exists reembolso_valor numeric(12, 2),
  add column if not exists reembolso_motivo text,
  add column if not exists reembolso_em timestamptz;

create index if not exists idx_cscx_atendimentos_reembolso
  on cscx_atendimentos (reembolso_em)
  where reembolso_valor is not null or nullif(trim(coalesce(reembolso_motivo, '')), '') is not null;
