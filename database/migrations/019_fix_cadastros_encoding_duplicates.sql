-- As migracoes 007/008/009 corrigiram a codificacao (?? -> caracteres
-- acentuados) em cscx_atendimentos, mas cscx_setores, cscx_responsaveis e
-- cscx_proximas_acoes tinham sido populadas ANTES dessas correcoes (migracao
-- 002/014), entao ficaram com o texto quebrado (ex.: "EXPEDI??O").
-- Isso fazia o dropdown do wizard (GET /api/cadastros, que faz UNION com o
-- texto ja corrigido de cscx_atendimentos) mostrar duas entradas pro mesmo
-- setor/responsavel: uma quebrada ("EXPEDI??O") e uma correta ("EXPEDIÇÃO").
-- Esta migracao aplica a mesma correcao de codificacao ao "nome" das tres
-- tabelas de cadastro e remove eventuais duplicatas resultantes.

create or replace function cscx_fix_question_marks(value text)
returns text
language plpgsql
immutable
as $$
begin
  if value is null then
    return null;
  end if;

  value := replace(value, '??ES', 'ÇÕES');
  value := replace(value, '??es', 'ções');
  value := replace(value, '??O', 'ÇÃO');
  value := replace(value, '??o', 'ção');
  value := replace(value, 'SOLICITA?AO', 'SOLICITAÇÃO');
  value := replace(value, 'PRODU?AO', 'PRODUÇÃO');
  value := replace(value, 'SEPARA?AO', 'SEPARAÇÃO');
  value := replace(value, 'PROTE?AO', 'PROTEÇÃO');
  value := replace(value, 'DEVOLU?AO', 'DEVOLUÇÃO');
  value := replace(value, 'INFORMA?OES', 'INFORMAÇÕES');
  value := replace(value, 'CORRE?AO', 'CORREÇÃO');
  value := replace(value, 'AVALIA?AO', 'AVALIAÇÃO');
  value := replace(value, 'CONFIRMA?AO', 'CONFIRMAÇÃO');
  value := replace(value, 'ACEITA?AO', 'ACEITAÇÃO');
  value := replace(value, 'OP?AO', 'OPÇÃO');
  value := replace(value, 'solicita?ao', 'solicitação');
  value := replace(value, 'produ?ao', 'produção');
  value := replace(value, 'corre?ao', 'correção');
  value := replace(value, 'avalia?ao', 'avaliação');
  value := replace(value, 'confirma?ao', 'confirmação');
  value := replace(value, 'aceita?ao', 'aceitação');
  value := replace(value, 'op?ao', 'opção');
  value := replace(value, 'CAL?A', 'CALÇA');
  value := replace(value, 'cal?a', 'calça');
  value := replace(value, 'CABE?ADA', 'CABEÇADA');
  value := replace(value, 'cabe?ada', 'cabeçada');
  value := replace(value, 'PE?AS', 'PEÇAS');
  value := replace(value, 'pe?as', 'peças');
  value := replace(value, 'PE?A', 'PEÇA');
  value := replace(value, 'pe?a', 'peça');
  value := replace(value, 'LA?O', 'LAÇO');
  value := replace(value, 'la?o', 'laço');
  value := replace(value, 'CR?DITO', 'CRÉDITO');
  value := replace(value, 'C?REDITO', 'CRÉDITO');
  value := replace(value, 'cr?dito', 'crédito');
  value := replace(value, 'N?O', 'NÃO');
  value := replace(value, 'n?o', 'não');
  value := replace(value, 'ALGOD?O', 'ALGODÃO');
  value := replace(value, 'FERR?O', 'FERRÃO');
  value := replace(value, 'CAF?', 'CAFÉ');
  value := replace(value, 'CAMUR?A', 'CAMURÇA');
  value := replace(value, 'CHAP?U', 'CHAPÉU');
  value := replace(value, 'tr?s', 'três');
  value := replace(value, 'ir?', 'irá');
  value := replace(value, 'enviar?', 'enviará');
  value := replace(value, 'respons?vel', 'responsável');
  value := replace(value, 'equ?voco', 'equívoco');
  value := replace(value, 'ap?s', 'após');
  value := replace(value, 'Ap?s', 'Após');
  value := replace(value, 'j?', 'já');
  value := replace(value, '?poca', 'época');
  value := replace(value, 'necess?rio', 'necessário');
  value := replace(value, 'an?lise', 'análise');
  value := replace(value, 'aus?ncia', 'ausência');
  value := replace(value, 'at?', 'até');
  value := replace(value, 'LAN?OU', 'LANÇOU');
  value := replace(value, 'lan?ou', 'lançou');
  value := replace(value, 'QUAL ? EXATAMENTE', 'QUAL É EXATAMENTE');
  value := replace(value, 'referentes ? ', 'referentes à ');
  value := replace(value, 'quanto ? ', 'quanto à ');

  return value;
end;
$$;

create or replace function cscx_fix_remaining_question_marks(value text)
returns text
language plpgsql
immutable
as $$
begin
  if value is null then
    return null;
  end if;

  value := replace(value, 'ferr?o', 'ferrão');
  value := replace(value, 'chap?u', 'chapéu');
  value := replace(value, 'chap?us', 'chapéus');
  value := replace(value, 'CABE?A', 'CABEÇA');
  value := replace(value, 'DIFEREN?A', 'DIFERENÇA');
  value := replace(value, 'realizar?', 'realizará');
  value := replace(value, 'ser?', 'será');
  value := replace(value, 'necess?ria', 'necessária');
  value := replace(value, 'AT?', 'ATÉ');
  value := replace(value, 'confer?ncia', 'conferência');
  value := replace(value, 'ocorr?ncia', 'ocorrência');
  value := replace(value, 'espec?ficas', 'específicas');
  value := replace(value, 'v?rios', 'vários');
  value := replace(value, 'inclu?das', 'incluídas');
  value := replace(value, 'tamb?m', 'também');
  value := replace(value, 'por?m', 'porém');
  value := replace(value, 'POR?M', 'PORÉM');
  value := replace(value, 'est?o', 'estão');
  value := replace(value, 'estav?o', 'estavam');
  value := replace(value, 'OT?VIO', 'OTÁVIO');
  value := replace(value, 'ENT?O', 'ENTÃO');
  value := replace(value, 'LAN?ADA', 'LANÇADA');
  value := replace(value, 'LAN?ADO', 'LANÇADO');
  value := replace(value, ' agora ? necessário', ' agora é necessário');
  value := replace(value, ' não ? indicado', ' não é indicado');
  value := replace(value, 'O CLIENTE ? DE', 'O CLIENTE É DE');
  value := replace(value, 'ENTREI ?PARA', 'ENTREI PARA');

  return value;
end;
$$;

update cscx_setores
set nome = cscx_fix_remaining_question_marks(cscx_fix_question_marks(nome))
where nome ~ '\?';

update cscx_responsaveis
set nome = cscx_fix_remaining_question_marks(cscx_fix_question_marks(nome))
where nome ~ '\?';

update cscx_proximas_acoes
set nome = cscx_fix_remaining_question_marks(cscx_fix_question_marks(nome))
where nome ~ '\?';

drop function cscx_fix_question_marks(text);
drop function cscx_fix_remaining_question_marks(text);

-- Remove duplicatas que possam ter surgido da correcao (mesma logica da 018).
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
