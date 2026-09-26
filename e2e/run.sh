#!/bin/zsh
# End-to-end tests against a credential-free build of Slate.
#
# The app is copied to a temporary directory WITHOUT any .env file, every
# provider/Supabase variable is unset, and the browser-side mock API
# (e2e/harness/mock-api.js) answers /api/* requests. No real key, provider
# or Supabase project can be reached from this run.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DST=${E2E_DIR:-${TMPDIR:-/tmp}/slate-e2e}
PORT=${E2E_PORT:-3100}
while lsof -i :"$PORT" >/dev/null 2>&1; do
  echo "Port $PORT is already in use, trying next port..."
  PORT=$((PORT + 1))
done
UNSET=(-u OPENAI_API_KEY -u SUPABASE_URL -u SUPABASE_SECRET_KEY -u SUPABASE_PUBLISHABLE_KEY -u SUPABASE_JWKS_URL
  -u LTXV_API_KEY -u GEMINI_API_KEY -u NV_API_KEY -u QWEN_IMAGE_API_KEY -u QWEN_IMAGE_EDIT_API_KEY -u VERCEL_OIDC_TOKEN)

mkdir -p "$DST"
rsync -a --delete --exclude='.env*' --exclude='.git' --exclude='.next' --exclude='.claude' \
  --exclude='.agent-logs' --exclude='docs' --exclude='node_modules' --exclude='test-results' --exclude='playwright-report' \
  "$ROOT/" "$DST/"
# Turbopack refuses a symlinked node_modules; hard links are instant and take no space.
[ -L "$DST/node_modules" ] && rm "$DST/node_modules"
rsync -a --delete --link-dest="$ROOT/node_modules" "$ROOT/node_modules/" "$DST/node_modules/"
if ls -a "$DST" | grep -qi '^\.env'; then echo "env file present in E2E copy, aborting"; exit 1; fi

cp "$ROOT/e2e/harness/mock-api.js" "$DST/public/mock-api.js"
cp "$ROOT/e2e/harness/guard.ts" "$DST/src/lib/auth/guard.ts"
perl -0pi -e 's#<body>\{children\}</body>#<head><script src="/mock-api.js" /></head><body>{children}</body>#' "$DST/src/app/layout.tsx"
grep -q 'mock-api.js' "$DST/src/app/layout.tsx" || { echo "layout patch failed"; exit 1; }

cd "$DST"
env "${UNSET[@]}" SLATE_MOCK=1 SLATE_STORE=memory npx next build > "$DST/e2e-build.log" 2>&1 || { tail -30 "$DST/e2e-build.log"; exit 1; }
env "${UNSET[@]}" SLATE_MOCK=1 SLATE_STORE=memory npx next start -p "$PORT" > "$DST/e2e-server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for i in {1..60}; do
  if ! kill -0 "$SERVER" 2>/dev/null; then
    echo "E2E server crashed during startup:"
    cat "$DST/e2e-server.log"
    exit 1
  fi
  curl -sf "http://localhost:$PORT" >/dev/null && break
  sleep 1
done

cd "$ROOT"
E2E_BASE_URL="http://localhost:$PORT" npx playwright test "$@"
