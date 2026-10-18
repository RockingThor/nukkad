#!/usr/bin/env bash
# Bundle the backend and the static web app into one Lambda zip.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/build"
rm -rf "$OUT" && mkdir -p "$OUT/pkg"
pnpm --dir "$ROOT/apps/web" build
ESB=$(ls -d "$ROOT"/node_modules/.pnpm/esbuild@0.28*/node_modules/esbuild/bin/esbuild | head -1)
"$ESB" "$ROOT/packages/nukkad-mcp/src/app.ts" --bundle --platform=node --target=node20 --format=esm \
  --outfile="$OUT/pkg/index.mjs" --external:@aws-sdk/* \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
cp -r "$ROOT/apps/web/out" "$OUT/pkg/public"
python3 -c "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2])" "$OUT/nukkad" "$OUT/pkg"
ls -la "$OUT/nukkad.zip"
