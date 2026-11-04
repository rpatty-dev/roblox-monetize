#!/usr/bin/env bash
# Installs the roblox-monetize skill into Claude Code (~/.claude/skills) and optionally registers the MCP server.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/roblox-monetize"

command -v node >/dev/null || { echo "Node 18+ is required: https://nodejs.org"; exit 1; }
major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 18 ] || { echo "Node 18+ is required (found $(node -v))"; exit 1; }

mkdir -p "$(dirname "$dest")"
rm -rf "$dest"
ln -s "$here/skills/roblox-monetize" "$dest"
node "$dest/scripts/monetize.mjs" selftest
echo "Skill installed: $dest"

if [ "${1:-}" = "--mcp" ]; then
  (cd "$here/mcp" && npm install --silent)
  claude mcp remove roblox-monetize --scope user >/dev/null 2>&1 || true
  claude mcp add roblox-monetize --scope user -- node "$here/mcp/server.mjs"
  echo "MCP server registered as roblox-monetize"
fi
echo "Next: create an Open Cloud API key, then run:  pbpaste | node \"$dest/scripts/monetize.mjs\" set-key"
