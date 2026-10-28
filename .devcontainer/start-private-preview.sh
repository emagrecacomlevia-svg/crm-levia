#!/usr/bin/env bash
# Starts only the HUB-05 branch preview inside the owner's Codespace.
# Port visibility is controlled by GitHub Codespaces (PRIVATE by default).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun indisponível; a preparação do Codespace não terminou." >&2
  exit 1
fi

if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/login >/dev/null 2>&1; then
  echo "LEVIA HUB-05: prévia privada já ativa na porta 3000."
  exit 0
fi

# Nothing is deployed, made public, or persisted outside this Codespace.
nohup bun run dev -- --host 0.0.0.0 --port 3000 \
  > /tmp/levia-hub05-private-preview.log 2>&1 < /dev/null &
preview_pid=$!
sleep 2
if kill -0 "$preview_pid" 2>/dev/null; then
  echo "LEVIA HUB-05: servidor iniciado na porta 3000; abra a porta PRIVATE/HTTPS."
else
  echo "A inicialização da prévia falhou; consulte o log local do Codespace." >&2
  exit 1
fi
