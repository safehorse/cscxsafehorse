# CS/CX Safe Horse

Sistema de atendimento de sucesso do cliente, com agenda e acompanhamento por pedido.

## Stack

- Frontend: Vite, React, Tailwind e Clerk.
- Backend: Node/Express.
- Banco: PostgreSQL na VPS.

## Primeiros passos

```powershell
npm install
Copy-Item .env.example .env
npm run dev
npm run dev:api
```

## Banco na VPS

1. Configure `DATABASE_URL` no `.env`.
2. Aplique o schema:

```powershell
psql $env:DATABASE_URL -f database/migrations/001_cscx_initial.sql
```

3. Importe a planilha inicial:

```powershell
npm run import:planilha
```

Por padrao o script procura `SUCESSO DO CLIENTE 2026.xlsx` na Area de Trabalho.
