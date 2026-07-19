#!/bin/bash
# HAR Viewer API rebuild helper
# Run from project root: bash scripts/rebuild-api.sh
#
# Compatible with: Linux, macOS, WSL (Ubuntu/Debian/other distros)
# Windows: Run inside WSL2 or Git Bash

set -e

# ─── Resolve project root ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔧 Rebuilding HAR Viewer API..."
echo "📁 Project root: $PROJECT_ROOT"

API_DIR="apps/api"
NEST="$PROJECT_ROOT/node_modules/.bin/nest"

# ─── Check prerequisites ──────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed. Install from https://nodejs.org/"
  exit 1
fi

if [ ! -f "$NEST" ]; then
  echo "❌ NestJS CLI not found. Run: npm install --legacy-peer-deps"
  exit 1
fi

# ─── Ensure shared-types.ts is in src/ ────────────────────────────────────
if [ ! -f "$API_DIR/src/shared-types.ts" ]; then
  echo "📋 Copying shared types..."
  cp packages/shared/src/index.ts "$API_DIR/src/shared-types.ts"
fi

# ─── Fix @har-viewer/shared imports ───────────────────────────────────────
echo "🔍 Checking imports..."
find "$API_DIR/src" -name "*.ts" -print0 2>/dev/null | while IFS= read -r -d '' f; do
  if grep -q "@har-viewer/shared" "$f"; then
    echo "  Fixing: $f"
    # Compute relative depth from src/
    rel_path="${f#$API_DIR/src/}"
    depth=$(echo "$rel_path" | tr -cd '/' | wc -c)
    rel_prefix=""
    for i in $(seq 1 "$depth"); do rel_prefix="../$rel_prefix"; done
    # Use sed compatible with both GNU (Linux/WSL) and BSD (macOS)
    if sed --version 2>/dev/null | grep -q GNU; then
      sed -i "s|from '@har-viewer/shared'|from '${rel_prefix}shared-types'|g" "$f"
    else
      sed -i '' "s|from '@har-viewer/shared'|from '${rel_prefix}shared-types'|g" "$f"
    fi
  fi
done

# ─── Clean and build ──────────────────────────────────────────────────────
echo "🏗️  Building NestJS API..."
cd "$API_DIR"
rm -rf dist/

"$NEST" build 2>&1

# ─── Verify build output ──────────────────────────────────────────────────
if [ -f "dist/main.js" ]; then
  SIZE=$(wc -c < dist/main.js | tr -d ' ')
  echo "✅ Build successful: dist/main.js (${SIZE} bytes)"
else
  echo "❌ Build failed: dist/main.js not found"
  echo "📂 Checking dist/:"
  find dist -name "*.js" 2>/dev/null | head -5 || echo "  (empty)"
  exit 1
fi

echo ""
echo "▶  Run API with: node dist/main.js"
echo "▶  Or via npm:   npm run start:prod --workspace=apps/api"
