alter table cscx_usuarios
  alter column clerk_user_id drop not null;

alter table cscx_usuarios
  drop constraint if exists cscx_usuarios_papel_check;

update cscx_usuarios
set papel = 'cs'
where papel = 'operador';

alter table cscx_usuarios
  add constraint cscx_usuarios_papel_check check (papel in ('admin', 'cs'));

alter table cscx_usuarios
  alter column papel set default 'cs';

create unique index if not exists idx_cscx_usuarios_email_lower
  on cscx_usuarios (lower(email));

update cscx_usuarios
set papel = 'admin',
    nome = coalesce(nome, 'Plinio Giglioti'),
    ativo = true
where lower(email) = 'plinio.giglioti@safehorse.com.br';

insert into cscx_usuarios (email, nome, papel, ativo)
select 'plinio.giglioti@safehorse.com.br', 'Plinio Giglioti', 'admin', true
where not exists (
  select 1
  from cscx_usuarios
  where lower(email) = 'plinio.giglioti@safehorse.com.br'
);
