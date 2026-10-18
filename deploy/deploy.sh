#!/usr/bin/env bash
# Build and push new code to the existing Lambda. First time setup is in deploy/README.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/deploy/bundle.sh"
aws lambda update-function-code --function-name "${FUNCTION:-nukkad}" --zip-file "fileb://$ROOT/deploy/build/nukkad.zip" --query LastModified --output text
aws lambda wait function-updated-v2 --function-name "${FUNCTION:-nukkad}"
