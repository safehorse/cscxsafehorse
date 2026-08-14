alter table cscx_atendimentos
  add column if not exists codigo_cliente text,
  add column if not exists pcp_item_id uuid;

create table if not exists cscx_setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cscx_responsaveis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into cscx_setores (nome)
select distinct trim(setor)
from cscx_atendimentos
where nullif(trim(coalesce(setor, '')), '') is not null
on conflict (nome) do nothing;

insert into cscx_responsaveis (nome)
select distinct trim(responsavel)
from cscx_atendimentos
where nullif(trim(coalesce(responsavel, '')), '') is not null
on conflict (nome) do nothing;

create index if not exists idx_cscx_atendimentos_codigo_cliente on cscx_atendimentos (codigo_cliente);
create index if not exists idx_cscx_atendimentos_pcp_item_id on cscx_atendimentos (pcp_item_id);

drop trigger if exists trg_cscx_setores_updated_at on cscx_setores;
create trigger trg_cscx_setores_updated_at
before update on cscx_setores
for each row execute function cscx_touch_updated_at();

drop trigger if exists trg_cscx_responsaveis_updated_at on cscx_responsaveis;
create trigger trg_cscx_responsaveis_updated_at
before update on cscx_responsaveis
for each row execute function cscx_touch_updated_at();
