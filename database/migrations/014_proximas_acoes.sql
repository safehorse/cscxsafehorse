create table if not exists cscx_proximas_acoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into cscx_proximas_acoes (nome)
select distinct trim(proxima_acao)
from cscx_atendimentos
where nullif(trim(coalesce(proxima_acao, '')), '') is not null
on conflict (nome) do nothing;

drop trigger if exists trg_cscx_proximas_acoes_updated_at on cscx_proximas_acoes;
create trigger trg_cscx_proximas_acoes_updated_at
before update on cscx_proximas_acoes
for each row execute function cscx_touch_updated_at();
