alter table cscx_usuarios
  add column if not exists convite_id text,
  add column if not exists convite_status text,
  add column if not exists convite_enviado_em timestamptz;

update cscx_usuarios
set convite_status = 'active'
where clerk_user_id is not null
  and convite_status is null;
