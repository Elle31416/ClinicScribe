#!/usr/bin/env bash
set -euo pipefail

npm ci
node --check server.js
test -f public/index.html
test -f public/pcm-processor.js
test -f render.yaml

if grep -RInE \
  --exclude-dir=node_modules \
  --exclude=package-lock.json \
  --exclude='.env.example' \
  'ASSEMBLYAI_API_KEY=.+|AIza[0-9A-Za-z_-]{20,}' .; then
  echo "Possible committed secret found."
  exit 1
fi

npm start