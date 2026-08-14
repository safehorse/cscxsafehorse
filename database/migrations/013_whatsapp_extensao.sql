alter table cscx_whatsapp_contatos add column if not exists last_message text;
alter table cscx_whatsapp_contatos add column if not exists unread_count int not null default 0;

create table if not exists cscx_whatsapp_extensao (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  token text not null unique,
  status text not null default 'desconectado',
  ultimo_ping timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_cscx_whatsapp_extensao_updated_at on cscx_whatsapp_extensao;
create trigger trg_cscx_whatsapp_extensao_updated_at
before update on cscx_whatsapp_extensao
for each row execute function cscx_touch_updated_at();
