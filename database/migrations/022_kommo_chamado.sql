ALTER TABLE cscx_atendimentos
  ADD COLUMN IF NOT EXISTS kommo_lead_id bigint,
  ADD COLUMN IF NOT EXISTS kommo_protocolo text,
  ADD COLUMN IF NOT EXISTS kommo_status text,
  ADD COLUMN IF NOT EXISTS kommo_erro text,
  ADD COLUMN IF NOT EXISTS kommo_enviado_em timestamptz;
