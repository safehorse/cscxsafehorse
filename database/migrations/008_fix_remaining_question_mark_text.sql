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

update cscx_atendimentos
set
  cliente = cscx_fix_remaining_question_marks(cliente),
  descricao_produto = cscx_fix_remaining_question_marks(descricao_produto),
  motivo = cscx_fix_remaining_question_marks(motivo),
  setor = cscx_fix_remaining_question_marks(setor),
  responsavel = cscx_fix_remaining_question_marks(responsavel),
  proxima_acao = cscx_fix_remaining_question_marks(proxima_acao),
  status = cscx_fix_remaining_question_marks(status),
  novo_pedido = cscx_fix_remaining_question_marks(novo_pedido),
  cliente_tem_desconto = cscx_fix_remaining_question_marks(cliente_tem_desconto),
  vendedor = cscx_fix_remaining_question_marks(vendedor),
  descricao_situacao = cscx_fix_remaining_question_marks(descricao_situacao),
  reembolso_motivo = cscx_fix_remaining_question_marks(reembolso_motivo);

drop function cscx_fix_remaining_question_marks(text);
