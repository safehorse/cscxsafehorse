-- A importacao da planilha trouxe setor/responsavel/proxima_acao com
-- variacoes de maiusculas/minusculas e espacos (ex.: "Vendas" e "vendas"),
-- o que fez cscx_setores/cscx_responsaveis/cscx_proximas_acoes acumularem
-- linhas duplicadas (a constraint unica em "nome" e sensivel a caixa).
-- Esta migracao:
--   1) escolhe um nome canonico para cada grupo (preferindo o nome ja
--      cadastrado na tabela de cadastro em vez do texto solto do chamado);
--   2) atualiza cscx_atendimentos e as tabelas de cadastro para usar o
--      nome canonico;
--   3) remove as linhas de cadastro duplicadas;
--   4) adiciona uma coluna normalizada com indice unico para impedir novos
--      cadastros com o mesmo nome (ignorando caixa e espacos extras).

create temporary table tmp_setor_canonical as
with candidates as (
  select nome as txt, 1 as priority from cscx_setores
  union all
  select trim(setor), 2
  from cscx_atendimentos
  where nullif(trim(coalesce(setor, '')), '') is not null
),
counts as (
  select
    lower(trim(regexp_replace(txt, '\s+', ' ', 'g'))) as norm_key,
    txt,
    priority,
    count(*) as qty
  from candidates
  group by 1, 2, 3
)
select distinct on (norm_key) norm_key, txt as canonical
from counts
order by norm_key, priority asc, qty desc, txt asc;

create temporary table tmp_responsavel_canonical as
with candidates as (
  select nome as txt, 1 as priority from cscx_responsaveis
  union all
  select trim(responsavel), 2
  from cscx_atendimentos
  where nullif(trim(coalesce(responsavel, '')), '') is not null
),
counts as (
  select
    lower(trim(regexp_replace(txt, '\s+', ' ', 'g'))) as norm_key,
    txt,
    priority,
    count(*) as qty
  from candidates
  group by 1, 2, 3
)
select distinct on (norm_key) norm_key, txt as canonical
from counts
order by norm_key, priority asc, qty desc, txt asc;

create temporary table tmp_proxima_acao_canonical as
with candidates as (
  select nome as txt, 1 as priority from cscx_proximas_acoes
  union all
  select trim(proxima_acao), 2
  from cscx_atendimentos
  where nullif(trim(coalesce(proxima_acao, '')), '') is not null
),
counts as (
  select
    lower(trim(regexp_replace(txt, '\s+', ' ', 'g'))) as norm_key,
    txt,
    priority,
    count(*) as qty
  from candidates
  group by 1, 2, 3
)
select distinct on (norm_key) norm_key, txt as canonical
from counts
order by norm_key, priority asc, qty desc, txt asc;

-- Remove as linhas de cadastro duplicadas, mantendo uma por grupo
-- (preferindo a ativa e a mais antiga).
delete from cscx_setores s
using (
  select id, row_number() over (
    partition by lower(trim(regexp_replace(nome, '\s+', ' ', 'g')))
    order by ativo desc, created_at asc, id
  ) as rn
  from cscx_setores
) ranked
where s.id = ranked.id and ranked.rn > 1;

delete from cscx_responsaveis s
using (
  select id, row_number() over (
    partition by lower(trim(regexp_replace(nome, '\s+', ' ', 'g')))
    order by ativo desc, created_at asc, id
  ) as rn
  from cscx_responsaveis
) ranked
where s.id = ranked.id and ranked.rn > 1;

delete from cscx_proximas_acoes s
using (
  select id, row_number() over (
    partition by lower(trim(regexp_replace(nome, '\s+', ' ', 'g')))
    order by ativo desc, created_at asc, id
  ) as rn
  from cscx_proximas_acoes
) ranked
where s.id = ranked.id and ranked.rn > 1;

-- Renomeia a linha sobrevivente e os chamados para o nome canonico.
update cscx_setores s
set nome = t.canonical
from tmp_setor_canonical t
where lower(trim(regexp_replace(s.nome, '\s+', ' ', 'g'))) = t.norm_key
  and s.nome is distinct from t.canonical;

update cscx_responsaveis s
set nome = t.canonical
from tmp_responsavel_canonical t
where lower(trim(regexp_replace(s.nome, '\s+', ' ', 'g'))) = t.norm_key
  and s.nome is distinct from t.canonical;

update cscx_proximas_acoes s
set nome = t.canonical
from tmp_proxima_acao_canonical t
where lower(trim(regexp_replace(s.nome, '\s+', ' ', 'g'))) = t.norm_key
  and s.nome is distinct from t.canonical;

update cscx_atendimentos a
set setor = t.canonical
from tmp_setor_canonical t
where nullif(trim(coalesce(a.setor, '')), '') is not null
  and lower(trim(regexp_replace(a.setor, '\s+', ' ', 'g'))) = t.norm_key
  and a.setor is distinct from t.canonical;

update cscx_atendimentos a
set responsavel = t.canonical
from tmp_responsavel_canonical t
where nullif(trim(coalesce(a.responsavel, '')), '') is not null
  and lower(trim(regexp_replace(a.responsavel, '\s+', ' ', 'g'))) = t.norm_key
  and a.responsavel is distinct from t.canonical;

update cscx_atendimentos a
set proxima_acao = t.canonical
from tmp_proxima_acao_canonical t
where nullif(trim(coalesce(a.proxima_acao, '')), '') is not null
  and lower(trim(regexp_replace(a.proxima_acao, '\s+', ' ', 'g'))) = t.norm_key
  and a.proxima_acao is distinct from t.canonical;

-- Impede novos cadastros com o mesmo nome (ignorando caixa/espacos).
alter table cscx_setores add column if not exists nome_normalizado text
  generated always as (lower(trim(regexp_replace(nome, '\s+', ' ', 'g')))) stored;
create unique index if not exists idx_cscx_setores_nome_normalizado on cscx_setores (nome_normalizado);

alter table cscx_responsaveis add column if not exists nome_normalizado text
  generated always as (lower(trim(regexp_replace(nome, '\s+', ' ', 'g')))) stored;
create unique index if not exists idx_cscx_responsaveis_nome_normalizado on cscx_responsaveis (nome_normalizado);

alter table cscx_proximas_acoes add column if not exists nome_normalizado text
  generated always as (lower(trim(regexp_replace(nome, '\s+', ' ', 'g')))) stored;
create unique index if not exists idx_cscx_proximas_acoes_nome_normalizado on cscx_proximas_acoes (nome_normalizado);
