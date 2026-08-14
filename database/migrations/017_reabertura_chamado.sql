alter table cscx_atendimentos
  add column if not exists reaberto_em timestamptz;

alter table cscx_interacoes
  add column if not exists produto_id text,
  add column if not exists produto_descricao text;

alter table cscx_interacoes drop constraint if exists cscx_interacoes_tipo_check;
alter table cscx_interacoes add constraint cscx_interacoes_tipo_check
  check (tipo = any (array['nota', 'ligacao', 'whatsapp', 'email', 'reuniao', 'reabertura']));
