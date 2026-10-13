ALTER TABLE cscx_atendimentos
  ADD COLUMN IF NOT EXISTS finalizacao_resultado text,
  ADD COLUMN IF NOT EXISTS finalizacao_detalhes text;
