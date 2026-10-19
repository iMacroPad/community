// The plugin file format for an assistant: docs/PLUGINS.md plus a field-by-field summary of the JSON,
// with the lists (widget kinds, info panels, palette roles, actions, key names) taken from the app's model.
import { catalog, doc } from './data.js';

const list = a => a.map(x => `\`${x}\``).join(', ');

/** `{"keyChord": {"_0": KeyChord}}` for one MacroAction case, as Swift's Codable writes it. */
export function actionShape(c) {
  if (!c.params.length) return `{"${c.name}": {}}`;
  return `{"${c.name}": {${c.params.map(p => `"${p.label}": ${p.type}`).join(', ')}}}`;
}

export function schemaSummary() {
  const C = catalog();
  const A = C.actions;
  const enumLine = (name, cases) => `- \`${name}\`: ${cases.map(c => typeof c === 'string' ? `\`${c}\`` : `\`${actionShape(c)}\``).join(', ')}`;
  return `# JSON summary of a plugin file

A plugin file is \`<id>.imacropad-plugin.json\`. Everything is optional unless marked **required**; a hand-written
file may leave out whatever it does not use. Unknown fields are ignored. Colours are always \`"#RRGGBB"\`.

## Plugin (the file)

| field | type | rules |
|---|---|---|
| \`format\` | number | \`1\` |
| \`id\` **required** | string | \`author.plugin-name\`: lower case letters, digits, dots, dashes, at most 80 (\`^[a-z0-9]+([.-][a-z0-9]+)+$\`). Never \`imacropad.…\`. The catalog wants \`^[a-z0-9]+(\\.[a-z0-9-]+)+$\` and the folder named after it. |
| \`name\` **required** | string | 1–60 characters (catalog: 2–60) |
| \`version\` | string | \`1.0.0\`; raise it on every change |
| \`author\` | string | at most 80 (catalog: required) |
| \`blurb\` | string | at most 400 (catalog: 20–400, one or two sentences) |
| \`icon\` | string | an SF Symbol name, e.g. \`chart.bar.xaxis\` |
| \`app\` | \`{"name": "Figma", "bundleIDs": ["com.figma.Desktop"]}\` | leave out for a general plugin. Keys may only act on these apps. |
| \`profiles\` | [Profile] | layouts, at most 24 |
| \`themes\` | [Theme] | at most 16 |
| \`components\` | [PadWidget] | widgets that are not on a layout (a widget pack), at most 200; their frame only gives a size |
| \`triggers\` | [\`{"event": "gesture:trackpad:tap3", "action": MacroAction}\`] | gestures and MIDI on the Mac (\`^(gesture|midi):[a-z0-9:]{1,60}$\`), at most 64 |
| \`integrations\` | [Integration] | calls to other services made by the Mac, at most 32 |
| \`macros\` | [Macro] | at most 64 |
| \`permissions\` | [\`{"capability": Capability, "reason": "…"}\`] | every capability the content uses, with a true reason of 10–300 characters |

## Profile (a layout)

| field | type | rules |
|---|---|---|
| \`name\` **required** | string | 1–60 |
| \`layout\` **required** | Layout | |
| \`matchBundleIDs\` | [string] | only bundle IDs of the plugin's \`app\` |
| \`themeID\` | string | a built-in theme id or one of the plugin's own themes |
| \`icon\` | string | SF Symbol |
| \`isSaver\` | bool | a screensaver scene |
| \`isDefault\` | bool | ignored for plugins (warning) |
| \`id\` | UUID | left out, the app makes one |

**Layout**: \`columns\` and \`rows\` (1–24, the editor's snap grid; use **12 × 8 for a landscape pad**), \`backgroundHex\`,
\`widgets\` (at most 150).

## PadWidget

| field | type | rules |
|---|---|---|
| \`kind\` **required** | WidgetKind | see below |
| \`frame\` **required** | \`{"x": 0, "y": 0, "w": 0.25, "h": 0.25}\` | fractions of the pad, 0…1: \`x + w ≤ 1\`, \`y + h ≤ 1\`, \`w, h > 0\`. On a C × R grid a cell is \`1/C\` wide and \`1/R\` high. Widgets should not overlap. |
| \`style\` | WidgetStyle | |
| \`action\` | MacroAction | tap, knob clockwise, slider; for markdown/html/chart only \`{"integration": …}\` |
| \`altAction\` | MacroAction | knob anticlockwise, long press, toggle off; never on markdown/html/chart |
| \`hapticOnTrigger\` | bool | default true |
| \`stateKey\` | string | toggles: \`obs.recording\`, \`obs.streaming\`, \`obs.paused\`, \`volume.muted\`, or \`local.<anything>\` |
| \`options\` | [\`{"label": "…", "action": MacroAction}\`] | \`chips\` pills, at most 24 |
| \`gestures\` | {TrackpadGesture: MacroAction} | \`trackpad\` only; gestures: ${list(C.gestures)} |
| \`infoID\` | string | \`info\` only: an info panel id (\`list_widget_kinds\`) |
| \`param\` | string | \`info\`: the panel's one setting; markdown/html/chart with an integration: seconds between calls (≥ 30) |
| \`settings\` | {string: string} | \`info\` choices; values for an integration's \`\${input:name}\` |
| \`content\` | string | markdown, html and chart only, at most 200 KB |

**WidgetStyle**: \`label\` (≤ 60), \`sublabel\` (≤ 60), \`iconSystemName\` (SF Symbol), \`tint\` (${list(C.themeEnums.Tint)}: the theme
colours it), \`fontSize\` (15), \`shape\` (${list(C.shapes)}), \`cornerRadius\` (12), \`led\` (bool), \`customColors\` + \`fillHex\` / \`labelHex\`
(only when \`customColors\` is true; prefer tints so every theme works). \`mediaName\` does not travel in a plugin.

**WidgetKind**:
${C.widgetKinds.map(k => `- \`${k.kind}\`${k.note ? `: ${k.note}` : ''}`).join('\n')}

## Theme

| field | type | rules |
|---|---|---|
| \`id\` **required** | string | must start with \`<plugin id>.\` |
| \`name\` **required** | string | |
| \`palette\` **required** | ThemePalette | all ${C.paletteRoles.length} roles, \`#RRGGBB\` |
| \`family\` | string | default \`Custom\` |
| \`blurb\` | string | one line |
| \`keycap\` | KeycapStyle | default \`flat\` |
| \`cornerRadius\` | number | 0–60 (12) |
| \`borderWidth\` | number | 0–12 (0) |
| \`keyGap\` | number | 0–0.3 (0.06) |
| \`font\` | ${list(C.themeEnums.LegendFont)} | |
| \`uppercaseLegends\`, \`ledRing\`, \`rainbowBadge\` | bool | |
| \`pressEffect\` | ${list(C.themeEnums.PressEffect)} | |
| \`sound\` | ${list(C.themeEnums.ClickSound)} | |
| \`hapticSharpness\` | number | 0 soft … 1 crisp (0.7) |
| \`backgroundGradient\` | [hex] | stops over the background |
| \`hardware\` | \`{"capHeight": 1, "rgb": false, "backlit": false, "legendAlign": "center", "knob": "knurled", "knobHex", "caseHex", "caseEdgeHex", "material": "plastic", "keyHexes": [hex]}\` | for the hardware keycaps |
| \`backgroundImageName\`, \`keyImageNames\` | | pictures do not travel in a plugin: leave out |

**ThemePalette roles**:
${C.paletteRoles.map(r => `- \`${r.role}\`${r.note ? `: ${r.note}` : ''}`).join('\n')}

Legends need contrast: \`legend\` on \`key\` and \`legendOnAccent\` on \`accent\` at least 3:1 (4.5:1 reads better), or the check warns.

**KeycapStyle**: ${C.themeEnums.KeycapStyle.map(s => `\`${s.split(':')[0]}\``).join(', ')}.
Knob styles ${list(C.themeEnums.KnobStyle.map(s => s.split(':')[0]))}; materials ${list(C.themeEnums.CapMaterial.map(s => s.split(':')[0]))}.

Built-in theme ids a layout can name with \`themeID\` (${C.themes.length}): ${list(C.themes.map(t => t.id))}.

## Integration

| field | type | rules |
|---|---|---|
| \`name\` **required** | string | \`^[a-z0-9]+(-[a-z0-9]+)*$\`, ≤ 40, unique |
| \`url\` **required** | string | \`https://…\` (rest, mcp), \`wss://…\` (websocket), \`host:port\` (grpc); plain http/ws only to localhost; the host may not come from a placeholder |
| \`title\` | string | |
| \`kind\` | ${list(C.integrationKinds)} | default \`rest\` |
| \`method\` | GET, POST, PUT, PATCH, DELETE | rest; default POST |
| \`headers\` | {string: string} | a header named like authorization/token/api-key/cookie/secret/password must use \`\${secret:NAME}\` |
| \`body\` | string | rest body, websocket message, mcp tool arguments (JSON), grpc request (JSON) |
| \`tool\` | string | mcp tool name / grpc \`package.Service/Method\` (required for those kinds) |
| \`extract\` | string | dotted path into the JSON answer, \`*\` = the first that has the rest |
| \`output\` | ${list(C.integrationOutputs)} | default \`none\` |
| \`fileType\` | ${list(C.fileTypes)} | for \`save\` |
| \`find\` | [\`{"title", "search"?, "options"?, "list", "label", "detail", "set"}\`] | lets the editor pick inputs from a list |

Placeholders: \`\${clipboard}\`, \`\${secret:NAME}\` (\`^[A-Z][A-Z0-9_]{1,63}$\`, kept in the Mac's keychain, **never the value in the file**),
\`\${input:name}\` (\`^[a-z][a-z0-9_]{0,31}$\`, from the widget's \`settings\`).

## Macro

\`{"name": "…", "icon": "bolt.fill", "steps": [MacroAction], "triggers": ["hotkey:cmd+shift+m", "text:;mtg", "time:09:00", …], "notes": "…"}\`;
at most 60 steps; triggers match \`^(hotkey|text|time|every|app|obs|mac|gesture|midi):.{1,120}$\`.

## MacroAction (what a key does)

Swift's Codable shape: one key named after the case; unlabelled values are \`_0\`, \`_1\`; a case without values is \`{}\`.

\`\`\`json
{"keyChord": {"_0": {"key": "s", "modifiers": ["command"]}}}
{"menu": {"path": ["File", "Export…"]}}
{"typeText": {"_0": "Hello"}}
{"openURL": {"_0": "https://example.com"}}
{"runShortcut": {"_0": "My Shortcut"}}
{"mediaKey": {"_0": "playPause"}}
{"sequence": {"_0": [{"keyChord": {"_0": {"key": "c", "modifiers": ["command"]}}}, {"wait": {"seconds": 0.2}}]}}
{"integration": {"plugin": "<this plugin's id>", "name": "<integration name>"}}
{"pad": {"_0": {"layout": {"_0": "Stats"}}}}
{"stop": {}}
\`\`\`

Every case (from the app's model):
${A.MacroAction.map(c => `- \`${actionShape(c)}\`${c.doc ? `: ${c.doc}` : ''}`).join('\n')}

Value types:
- \`KeyChord\`: \`{"key": <key name>, "modifiers": [${list(A.Modifier)}]}\`
${enumLine('MediaKey', A.MediaKey)}
${enumLine('TeamsCommand', A.TeamsCommand)}
${enumLine('OBSCommand', A.OBSCommand)}
${enumLine('PhotoshopCommand', A.PhotoshopCommand)}
${enumLine('PadCommand', A.PadCommand)}
${enumLine('MIDICommand', A.MIDICommand)}
${enumLine('MacroCondition', A.MacroCondition)}

\`appleScript\` and \`shell\` are always refused in a plugin. \`openApp\`, \`performIn\`, \`menu\` with a \`bundleID\` and \`quitApp\` only for the plugin's own app.

Key names: ${list(C.keys)}.

## Capabilities (permissions)

${C.capabilities.map(c => `- \`${c.id}\`: ${c.title}`).join('\n')}

What needs what: key chords, menus, media, volume, scrolling, MIDI, OBS/Photoshop/Teams, opening the app, clicks → \`keys\`;
\`typeText\` → \`typeText\`; \`runShortcut\` → \`shortcuts\`; \`openURL\` → \`openLinks\`; \`setClipboard\` → \`clipboard\`;
an integration → \`network\` (+ \`clipboard\` when it sends \`\${clipboard}\`, + \`typeAnswers\` / \`saveFiles\` / \`openLinks\` for output type / save / open);
triggers or macro triggers → \`triggers\`; an html widget with content → \`html\`; a markdown/html/chart widget with an integration → \`liveData\`.
Info panels, labels and static markdown or charts need nothing.

## Info panels

\`{"kind": "info", "infoID": "clock.digital", "frame": {…}, "param": "…"}\`; sizes are grid cells (w × h). Full list: \`list_widget_kinds\`.
${C.infoGroups.map(g => `- **${g.title}**: ${C.infoPanels.filter(p => p.group === g.id).map(p => `\`${p.id}\``).join(', ')}`).join('\n')}
`;
}

/** The whole reference: the design rules, the JSON summary and docs/PLUGINS.md. */
export function formatReference({ full = true } = {}) {
  const design = `# Making iMacroPad community content

iMacroPad turns an iPad or iPhone into an app-aware control deck for the Mac. A plugin file holds layouts, themes,
widgets, integrations and macros, as data only. Design rules that make a good one:

- **Landscape pad**: a layout is a 12 × 8 grid (\`columns: 12, rows: 8\`); frames are fractions of the pad, never overlapping, inside 0…1.
- **Native first**: use \`info\` panels (clock, weather, Mac CPU…), \`markdown\` and \`chart\` before \`html\`. HTML is static only and needs the \`html\` permission.
- **Tints, not colours**: give widgets a \`tint\` (\`key\`, \`accent\`, \`accent2\`, \`danger\`, \`surface\`) so they look right in every theme.
- **No secrets in files**: an API key is \`\${secret:NAME}\`; each user puts their own in the Mac's keychain (\`imacropadd secret set NAME\`).
- **Declare permissions** for every capability used, each with a true, specific reason.
- **Validate** (\`imacropadd plugin validate FILE\`, or the MCP's \`validate_plugin\`) until there are no errors, then submit (\`submit_instructions\`).
`;
  return [design, schemaSummary(), full ? '# The plugin format (docs/PLUGINS.md)\n\n' + doc('PLUGINS.md').replace(/^# Plugins\n/, '') : ''].filter(Boolean).join('\n\n');
}
