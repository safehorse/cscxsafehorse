create table if not exists cscx_whatsapp_contatos (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique,
  whatsapp_id text not null unique,
  nome text,
  codigo_cliente text,
  cliente_nome text,
  observacao text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cscx_whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid references cscx_whatsapp_contatos(id) on delete cascade,
  whatsapp_message_id text unique,
  whatsapp_id text not null,
  telefone text not null,
  direcao text not null check (direcao in ('entrada', 'saida')),
  conteudo text,
  tipo text,
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_cscx_whatsapp_contatos_cliente on cscx_whatsapp_contatos (codigo_cliente);
create index if not exists idx_cscx_whatsapp_contatos_last on cscx_whatsapp_contatos (last_message_at desc);
create index if not exists idx_cscx_whatsapp_mensagens_contato on cscx_whatsapp_mensagens (contato_id, enviado_em desc);
create index if not exists idx_cscx_whatsapp_mensagens_telefone on cscx_whatsapp_mensagens (telefone, enviado_em desc);

drop trigger if exists trg_cscx_whatsapp_contatos_updated_at on cscx_whatsapp_contatos;
create trigger trg_cscx_whatsapp_contatos_updated_at
before update on cscx_whatsapp_contatos
for each row execute function cscx_touch_updated_at();
