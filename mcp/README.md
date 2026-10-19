# iMacroPad MCP server

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant make iMacroPad community content
(plugins, widget packs, themes and layouts) and check it with the app's own validator before it is submitted to
the [community catalog](https://www.imacropad.app/community/).

It only reads and writes text: it never installs anything on your pad or Mac, and never needs a key or a token.

## Tools

| Tool | What it does |
|---|---|
| `get_format_reference` | The plugin file format: design rules, a field-by-field JSON summary (Plugin, Profile, Layout, PadWidget, Theme, Integration, Macro, MacroAction) and `docs/PLUGINS.md`. Also a resource: `imacropad://reference/format`. |
| `list_widget_kinds` | Widget kinds, the info-panel catalog (id, name, group, setting, default size), theme palette roles, theme enums and the built-in theme ids. |
| `scaffold_plugin` | A starter file that passes the check: a `widget-pack` or an `app-plugin` (a landscape layout of keys, a dial and cards for one Mac app), optionally with a theme and an example integration. |
| `scaffold_theme` | A complete palette theme from a mood (`dark`, `light`, `neon`, `warm`, `pastel`, `mono`, `retro`) and optional colours, with legends that read on their keys. |
| `scaffold_layout` | A layout from a list of widgets (info panels by id, other widgets by kind), placed on a 12 × 8 landscape grid: frames never overlap and stay inside the pad. |
| `validate_plugin` | The app's validator (`imacropadd plugin validate`), or a JavaScript port of its rules when that is not available, plus layout overlaps, unknown info panels and the catalog's rules. |
| `submit_instructions` | The `items/<id>/` folder the catalog expects, a `meta.json` and README drafted from the plugin, and the pull-request steps. |

**Which validator runs.** In this order: `IMACROPADD_BIN`, `imacropadd` on the `PATH`, the iMacroPad Mac app
(`~/Applications` or `/Applications/iMacroPadD.app/Contents/MacOS/imacropadd`), a copy in `~/.cache/imacropad-mcp`, and
on a Mac the catalog's `validator` release, downloaded once into that folder. Offline or on another system the
JavaScript port runs and the report says so; the catalog runs the real one on every pull request anyway.

## Install

Needs Node 20 or later.

**Claude Code**

```sh
claude mcp add imacropad -- npx -y @imacropad/mcp
```

**Claude Desktop**: Settings ▸ Developer ▸ Edit Config, then in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imacropad": { "command": "npx", "args": ["-y", "@imacropad/mcp"] }
  }
}
```

**Cursor**: `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project), the same `mcpServers` block as above.

**VS Code**: `.vscode/mcp.json` in the workspace:

```json
{
  "servers": {
    "imacropad": { "type": "stdio", "command": "npx", "args": ["-y", "@imacropad/mcp"] }
  }
}
```

**From a clone** (until the package is on npm, or to change it):

```sh
cd community/mcp && npm install          # in the catalog's own repository the folder is mcp/
node community/mcp/src/index.js          # what an MCP client starts; it talks over stdin and stdout
claude mcp add imacropad -- node "$PWD/community/mcp/src/index.js"
```

## The skill

[`../skill/imacropad-community`](../skill/imacropad-community) teaches an assistant the workflow (read the format, design
for a landscape pad, native panels before HTML, no secrets in files, validate until it passes, prepare the submission).
It works with this server and, through its bundled `reference.md`, without it. Download it as a zip from
[imacropad.app/community](https://www.imacropad.app/community/#ai).

## For maintainers

| | |
|---|---|
| `node scripts/gen-catalog.mjs [--src <app repo>]` | rebuilds `data/catalog.json` from the app's Swift model (info panels and groups, widget kinds, palette roles, themes, actions, key names, the HTML and text rules), copies the docs into `data/` and writes the skill's `reference.md`. Run after a change to the model. |
| `node scripts/smoke.mjs` | starts the server over stdio and calls every tool once, validating each scaffold |
| `npm publish --access public` | publishes `@imacropad/mcp` (`src/`, `data/`, this README) |
