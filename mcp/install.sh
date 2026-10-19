#!/bin/sh
# Installs (or updates) the iMacroPad MCP server from this repository into ~/.imacropad/mcp
# and adds it to Claude Code when the `claude` command is there.
#   curl -fsSL https://raw.githubusercontent.com/iMacroPad/community/main/mcp/install.sh | sh
# Needs Node 20 or later, npm, curl and tar. Run it again to update.
set -eu
REPO=iMacroPad/community
DIR="${IMACROPAD_MCP_DIR:-$HOME/.imacropad/mcp}"

command -v node >/dev/null 2>&1 || { echo "iMacroPad MCP needs Node 20 or later: https://nodejs.org" >&2; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "iMacroPad MCP needs Node 20 or later (found $(node -v))" >&2; exit 1; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
echo "Downloading the MCP server from github.com/$REPO …"
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" | tar -xz -C "$tmp"
rm -rf "$DIR"; mkdir -p "$(dirname "$DIR")"
mv "$tmp"/*/mcp "$DIR"
(cd "$DIR" && npm install --omit=dev --no-audit --no-fund --silent)
ENTRY="$DIR/src/index.js"

if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user imacropad >/dev/null 2>&1 || true
  claude mcp add --scope user imacropad -- node "$ENTRY" && echo "Added to Claude Code as \"imacropad\" (every project)."
fi
cat <<EOF

iMacroPad MCP is in $DIR
For Claude Desktop, Cursor and other MCP apps, add to their MCP settings:
{ "mcpServers": { "imacropad": { "command": "node", "args": ["$ENTRY"] } } }
EOF
