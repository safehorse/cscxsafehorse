alter table cscx_clientes
  add column if not exists endereco text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists cep text,
  add column if not exists telefone1 text,
  add column if not exists telefone2 text,
  add column if not exists telefone3 text,
  add column if not exists email1 text,
  add column if not exists email2 text,
  add column if not exists contato text,
  add column if not exists cpf_cnpj text;
