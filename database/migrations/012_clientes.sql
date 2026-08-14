create table if not exists cscx_clientes (
  id uuid primary key default gen_random_uuid(),
  codigo_cliente text not null unique,
  nome text,
  telefone text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cscx_clientes_nome on cscx_clientes (nome);

drop trigger if exists trg_cscx_clientes_updated_at on cscx_clientes;
create trigger trg_cscx_clientes_updated_at
before update on cscx_clientes
for each row execute function cscx_touch_updated_at();
