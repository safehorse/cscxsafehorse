# Banco CS/CX

O banco deste projeto roda na VPS Safe Horse.

## Aplicar schema

Use a URL de conexao PostgreSQL da VPS em `DATABASE_URL` e aplique:

```powershell
psql $env:DATABASE_URL -f database/migrations/001_cscx_initial.sql
psql $env:DATABASE_URL -f database/migrations/002_wizard_cadastros.sql
```

## Tabelas principais

- `cscx_atendimentos`: registros importados da planilha e atendimentos criados no app.
- `cscx_agendamentos`: compromissos do calendario ligados a um atendimento.
- `cscx_interacoes`: historico de contato, notas, WhatsApp, email e ligacoes.
- `cscx_usuarios`: vinculo operacional com usuarios Clerk.
- `cscx_setores` e `cscx_responsaveis`: cadastros usados no wizard.
