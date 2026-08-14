create extension if not exists pgcrypto;

create table if not exists cscx_usuarios (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text not null,
  nome text,
  papel text not null default 'operador' check (papel in ('admin', 'operador')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cscx_atendimentos (
  id uuid primary key default gen_random_uuid(),
  data_solicitacao date,
  numero_pedido text,
  cliente text,
  codigo_produto text,
  descricao_produto text,
  quantidade numeric(12, 2),
  valor_unitario numeric(12, 2),
  valor_total numeric(12, 2),
  motivo text,
  setor text,
  responsavel text,
  proxima_acao text,
  status text not null default 'ABERTO',
  novo_pedido text,
  cliente_tem_desconto text,
  vendedor text,
  descricao_situacao text,
  origem_planilha_aba text,
  origem_linha integer,
  pcp_pedido_id uuid,
  pcp_payload jsonb,
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta', 'urgente')),
  agendado_para timestamptz,
  concluido_em timestamptz,
  created_by_clerk_user_id text,
  updated_by_clerk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origem_planilha_aba, origem_linha)
);

create table if not exists cscx_interacoes (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references cscx_atendimentos(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota', 'ligacao', 'whatsapp', 'email', 'reuniao')),
  descricao text not null,
  realizado_em timestamptz not null default now(),
  criado_por_clerk_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists cscx_agendamentos (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid references cscx_atendimentos(id) on delete cascade,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'feito', 'cancelado')),
  responsavel text,
  observacao text,
  criado_por_clerk_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cscx_atendimentos_pedido on cscx_atendimentos (numero_pedido);
create index if not exists idx_cscx_atendimentos_status on cscx_atendimentos (status);
create index if not exists idx_cscx_atendimentos_agenda on cscx_atendimentos (agendado_para);
create index if not exists idx_cscx_atendimentos_cliente on cscx_atendimentos using gin (to_tsvector('portuguese', coalesce(cliente, '')));
create index if not exists idx_cscx_agendamentos_inicio on cscx_agendamentos (inicio);
create index if not exists idx_cscx_interacoes_atendimento on cscx_interacoes (atendimento_id, realizado_em desc);

create or replace function cscx_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cscx_usuarios_updated_at on cscx_usuarios;
create trigger trg_cscx_usuarios_updated_at
before update on cscx_usuarios
for each row execute function cscx_touch_updated_at();

drop trigger if exists trg_cscx_atendimentos_updated_at on cscx_atendimentos;
create trigger trg_cscx_atendimentos_updated_at
before update on cscx_atendimentos
for each row execute function cscx_touch_updated_at();

drop trigger if exists trg_cscx_agendamentos_updated_at on cscx_agendamentos;
create trigger trg_cscx_agendamentos_updated_at
before update on cscx_agendamentos
for each row execute function cscx_touch_updated_at();
