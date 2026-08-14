update cscx_atendimentos
set
  numero_pedido = regexp_replace(numero_pedido, '\.0+$', ''),
  codigo_cliente = regexp_replace(codigo_cliente, '\.0+$', ''),
  codigo_produto = regexp_replace(codigo_produto, '\.0+$', ''),
  novo_pedido = regexp_replace(novo_pedido, '\.0+$', '')
where coalesce(numero_pedido, '') ~ '\.0+$'
   or coalesce(codigo_cliente, '') ~ '\.0+$'
   or coalesce(codigo_produto, '') ~ '\.0+$'
   or coalesce(novo_pedido, '') ~ '\.0+$';

update cscx_whatsapp_contatos
set codigo_cliente = regexp_replace(codigo_cliente, '\.0+$', '')
where coalesce(codigo_cliente, '') ~ '\.0+$';
