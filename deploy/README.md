# Deploy VPS

Dominio: `cscx.safehorse.com.br`

Chave SSH local esperada:

```powershell
$env:USERPROFILE\.ssh\pcpsafehorse_vps
```

Nao copie a chave privada para o repositorio.

## Layout sugerido na VPS

```text
/var/www/cscxsafehorse
  dist/
  server/
  database/
  package.json
  package-lock.json
  .env
```

## Servicos

- Nginx: `deploy/nginx-cscx.safehorse.com.br.conf`
- Systemd: `deploy/cscxsafehorse.service`
- API local: `127.0.0.1:3001`
- Banco: PostgreSQL na propria VPS ou em host acessivel pela VPS via `DATABASE_URL`
