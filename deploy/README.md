# Deploy VPS

Dominio: `cscx.safehorse.com.br`

Host: `root@172.233.6.88` (mesma VPS do pcpsafehorse, pasta `/opt/cscxsafehorse`).

Chave SSH local esperada:

```powershell
$env:USERPROFILE\.ssh\pcpsafehorse_vps
```

Nao copie a chave privada para o repositorio.

## Layout real na VPS

Nao ha pipeline automatico (sem GitHub Actions, diferente do pcpsafehorse) e o deploy e manual. Layout observado em `/opt/cscxsafehorse`:

```text
/opt/cscxsafehorse
  repo/          # git checkout de https://github.com/safehorse/cscxsafehorse (origin)
  current/       # build do frontend (dist/) servido pelo nginx - diretorio real, NAO symlink
  server/        # copia do server/ usado pelo systemd (node server/index.mjs)
  node_modules/  # deps do server
  package.json / package-lock.json  # copia usada pelo server em producao
  .env
  database/
  releases/      # existe mas nao e usado no fluxo atual (vazio)
  secrets/
```

**Push no GitHub NAO atualiza o site sozinho.** `git push` so manda o codigo pro GitHub; alguem
precisa entrar na VPS, atualizar `repo/`, buildar e copiar pro `current`/`server`, e reiniciar o
systemd. Sem isso a VPS continua rodando o commit antigo indefinidamente.

## Passo a passo do deploy manual

Rodar via SSH em `root@172.233.6.88`:

```bash
cd /opt/cscxsafehorse/repo
git pull origin main

# backend: so precisa reinstalar se package.json mudou
npm ci

# frontend
npm run build   # gera repo/dist

# backup do current antes de sobrescrever
tar -czf /opt/cscxsafehorse/backup-current-pre-$(date +%Y%m%d%H%M%S).tar.gz -C /opt/cscxsafehorse current

# publica o novo build e o novo server
rsync -a --delete repo/dist/ /opt/cscxsafehorse/current/
rsync -a --delete repo/server/ /opt/cscxsafehorse/server/
cp repo/package.json repo/package-lock.json /opt/cscxsafehorse/

systemctl restart cscxsafehorse
systemctl status cscxsafehorse --no-pager
```

Se `package.json` mudou (novas deps do server), rodar `npm ci` tambem em `/opt/cscxsafehorse`
(fora do `repo/`) antes do restart, ja que e de la que o systemd sobe o processo.

## Servicos

- Nginx: `deploy/nginx-cscx.safehorse.com.br.conf`
- Systemd: `deploy/cscxsafehorse.service`
- API local: `127.0.0.1:3010`
- Banco: PostgreSQL na propria VPS ou em host acessivel pela VPS via `DATABASE_URL`
