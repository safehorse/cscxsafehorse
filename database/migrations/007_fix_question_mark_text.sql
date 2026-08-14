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

update cscx_atendimentos
set
  cliente = cscx_fix_question_marks(cliente),
  descricao_produto = cscx_fix_question_marks(descricao_produto),
  motivo = cscx_fix_question_marks(motivo),
  setor = cscx_fix_question_marks(setor),
  responsavel = cscx_fix_question_marks(responsavel),
  proxima_acao = cscx_fix_question_marks(proxima_acao),
  status = cscx_fix_question_marks(status),
  novo_pedido = cscx_fix_question_marks(novo_pedido),
  cliente_tem_desconto = cscx_fix_question_marks(cliente_tem_desconto),
  vendedor = cscx_fix_question_marks(vendedor),
  descricao_situacao = cscx_fix_question_marks(descricao_situacao),
  reembolso_motivo = cscx_fix_question_marks(reembolso_motivo);

drop function cscx_fix_question_marks(text);
