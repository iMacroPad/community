# Making iMacroPad community content

iMacroPad turns an iPad or iPhone into an app-aware control deck for the Mac. A plugin file holds layouts, themes,
widgets, integrations and macros, as data only. Design rules that make a good one:

- **Landscape pad**: a layout is a 12 × 8 grid (`columns: 12, rows: 8`); frames are fractions of the pad, never overlapping, inside 0…1.
- **Native first**: use `info` panels (clock, weather, Mac CPU…), `markdown` and `chart` before `html`. HTML is static only and needs the `html` permission.
- **Tints, not colours**: give widgets a `tint` (`key`, `accent`, `accent2`, `danger`, `surface`) so they look right in every theme.
- **No secrets in files**: an API key is `${secret:NAME}`; each user puts their own in the Mac's keychain (`imacropadd secret set NAME`).
- **Declare permissions** for every capability used, each with a true, specific reason.
- **Validate** (`imacropadd plugin validate FILE`, or the MCP's `validate_plugin`) until there are no errors, then submit (`submit_instructions`).


# JSON summary of a plugin file

A plugin file is `<id>.imacropad-plugin.json`. Everything is optional unless marked **required**; a hand-written
file may leave out whatever it does not use. Unknown fields are ignored. Colours are always `"#RRGGBB"`.

## Plugin (the file)

| field | type | rules |
|---|---|---|
| `format` | number | `1` |
| `id` **required** | string | `author.plugin-name`: lower case letters, digits, dots, dashes, at most 80 (`^[a-z0-9]+([.-][a-z0-9]+)+$`). Never `imacropad.…`. The catalog wants `^[a-z0-9]+(\.[a-z0-9-]+)+$` and the folder named after it. |
| `name` **required** | string | 1–60 characters (catalog: 2–60) |
| `version` | string | `1.0.0`; raise it on every change |
| `author` | string | at most 80 (catalog: required) |
| `blurb` | string | at most 400 (catalog: 20–400, one or two sentences) |
| `icon` | string | an SF Symbol name, e.g. `chart.bar.xaxis` |
| `app` | `{"name": "Figma", "bundleIDs": ["com.figma.Desktop"]}` | leave out for a general plugin. Keys may only act on these apps. |
| `profiles` | [Profile] | layouts, at most 24 |
| `themes` | [Theme] | at most 16 |
| `components` | [PadWidget] | widgets that are not on a layout (a widget pack), at most 200; their frame only gives a size |
| `triggers` | [`{"event": "gesture:trackpad:tap3", "action": MacroAction}`] | gestures and MIDI on the Mac (`^(gesture|midi):[a-z0-9:]{1,60}$`), at most 64 |
| `integrations` | [Integration] | calls to other services made by the Mac, at most 32 |
| `macros` | [Macro] | at most 64 |
| `permissions` | [`{"capability": Capability, "reason": "…"}`] | every capability the content uses, with a true reason of 10–300 characters |

## Profile (a layout)

| field | type | rules |
|---|---|---|
| `name` **required** | string | 1–60 |
| `layout` **required** | Layout | |
| `matchBundleIDs` | [string] | only bundle IDs of the plugin's `app` |
| `themeID` | string | a built-in theme id or one of the plugin's own themes |
| `icon` | string | SF Symbol |
| `isSaver` | bool | a screensaver scene |
| `isDefault` | bool | ignored for plugins (warning) |
| `id` | UUID | left out, the app makes one |

**Layout**: all four fields are **required**: `columns` and `rows` (1–24, the editor's snap grid; use **12 × 8 for a landscape pad**),
`backgroundHex` (`"#000000"`), `widgets` (at most 150).

Inside actions every value is required except the optional ones (`menu.bundleID`, `clickElement.bundleID`, `when.otherwise`);
a `keyChord` always has `modifiers` (`[]` for none). `chips` options need `label` and `action`; a finder needs `title`, `label` and `set`.

## PadWidget

| field | type | rules |
|---|---|---|
| `kind` **required** | WidgetKind | see below |
| `frame` **required** | `{"x": 0, "y": 0, "w": 0.25, "h": 0.25}` | fractions of the pad, 0…1: `x + w ≤ 1`, `y + h ≤ 1`, `w, h > 0`. On a C × R grid a cell is `1/C` wide and `1/R` high. Widgets should not overlap. |
| `style` | WidgetStyle | |
| `action` | MacroAction | tap, knob clockwise, slider; for markdown/html/chart only `{"integration": …}` |
| `altAction` | MacroAction | knob anticlockwise, long press, toggle off; never on markdown/html/chart |
| `hapticOnTrigger` | bool | default true |
| `stateKey` | string | toggles: `obs.recording`, `obs.streaming`, `obs.paused`, `volume.muted`, or `local.<anything>` |
| `options` | [`{"label": "…", "action": MacroAction}`] | `chips` pills, at most 24 |
| `gestures` | {TrackpadGesture: MacroAction} | `trackpad` only; gestures: `swipe3Up`, `swipe3Down`, `swipe3Left`, `swipe3Right`, `pinchOut`, `pinchIn` |
| `infoID` | string | `info` only: an info panel id (`list_widget_kinds`) |
| `param` | string | `info`: the panel's one setting; markdown/html/chart with an integration: seconds between calls (≥ 30) |
| `settings` | {string: string} | `info` choices; values for an integration's `${input:name}` |
| `content` | string | markdown, html and chart only, at most 200 KB |

**WidgetStyle**: `label` (≤ 60), `sublabel` (≤ 60), `iconSystemName` (SF Symbol), `tint` (`key`, `accent`, `accent2`, `danger`, `surface`: the theme
colours it), `fontSize` (15), `shape` (`roundedRect`, `rect`, `circle`, `capsule`), `cornerRadius` (12), `led` (bool), `customColors` + `fillHex` / `labelHex`
(only when `customColors` is true; prefer tints so every theme works). `mediaName` does not travel in a plugin.

**WidgetKind**:
- `button`: tap → action
- `knob`: rotate CW → action, CCW → altAction, press → nothing/action
- `slider`: drag → setVolume-style continuous action
- `trackpad`: relative pointer + click
- `trackball`: relative pointer, momentum
- `pencilArea`: Apple Pencil drawing surface (pointer + pressure)
- `label`: static text / icon, no action
- `toggle`: stateful button: action = turn on, altAction = turn off; `stateKey` mirrors server state
- `volumeKnob`: knob with RGB LED ring + level meter, follows the Mac's real output volume
- `colorWheel`: Photoshop-style HSB wheel (hue ring + saturation/brightness square) → photoshop(.setForeground)
- `brushPicker`: brush size / hardness / opacity → photoshop(.setBrush)
- `appSwitcher`: strip of running Mac apps (real icons) → activate / set manual target
- `obsScenes`: dynamic OBS scene (and source) buttons fed by the daemon's OBS state
- `obsStatus`: recording / on air / paused with the running time; tap re-reads OBS
- `obsMixer`: OBS's audio mixer: a fader and a mute key per input
- `obsPreview`: a live picture of what OBS records or streams
- `scrollStrip`: mouse scroll wheel: rolls along its long side, with momentum
- `roller`: creative-console roller: a cylinder on its side, rolled across its short side
- `rotary`: flat dial turned with a fingertip
- `chips`: a named group of pill buttons (`options`), e.g. model or effort
- `aiSessions`: the terminal tabs and panes that run an AI tool → bring one to the front
- `voice`: a big microphone: tap, speak a command (built-in or one's own), see what was heard and done
- `markdown`: formatted text from `content`, or from the integration its action names
- `html`: a static HTML page: no script, no network, no forms
- `chart`: bars, a line or an area from numbers in `content` or from an integration
- `info`: an information panel (clock, weather, Mac state…): which one is `infoID`, see InfoCatalog

## Theme

| field | type | rules |
|---|---|---|
| `id` **required** | string | must start with `<plugin id>.` |
| `name` **required** | string | |
| `palette` **required** | ThemePalette | all 10 roles, `#RRGGBB` |
| `family` | string | default `Custom` |
| `blurb` | string | one line |
| `keycap` | KeycapStyle | default `flat` |
| `cornerRadius` | number | 0–60 (12) |
| `borderWidth` | number | 0–12 (0) |
| `keyGap` | number | 0–0.3 (0.06) |
| `font` | `system`, `rounded`, `mono`, `serif` | |
| `uppercaseLegends`, `ledRing`, `rainbowBadge` | bool | |
| `pressEffect` | `none`, `depress`, `glow`, `ripple`, `bounce` | |
| `sound` | `none`, `tick`, `click`, `clack`, `typewriter` | |
| `hapticSharpness` | number | 0 soft … 1 crisp (0.7) |
| `backgroundGradient` | [hex] | stops over the background |
| `hardware` | `{"capHeight": 1, "rgb": false, "backlit": false, "legendAlign": "center", "knob": "knurled", "knobHex", "caseHex", "caseEdgeHex", "material": "plastic", "keyHexes": [hex]}` | for the hardware keycaps |
| `backgroundImageName`, `keyImageNames` | | pictures do not travel in a plugin: leave out |

**ThemePalette roles**:
- `background`: pad surface
- `key`: normal keycap
- `accent`: highlighted keys (primary brand color)
- `accent2`: secondary highlight
- `danger`: destructive keys (delete, leave call…)
- `surface`: trackpad / pencil / meter wells
- `legend`: text + icon on normal keys
- `legendOnAccent`: text + icon on accent keys
- `border`: keycap rim
- `glow`: LED ring / halo color

Legends need contrast: `legend` on `key` and `legendOnAccent` on `accent` at least 3:1 (4.5:1 reads better), or the check warns.

**KeycapStyle**: `flat`, `chiclet`, `mechanical`, `retro`, `typewriter`, `glass`, `rubber`, `sculpted`, `dome`, `ringed`, `lcd`, `crystal`, `dish`.
Knob styles `knurled`, `matte`, `pointer`; materials `plastic`, `wood`, `stone`, `marble`, `brick`, `metal`.

Built-in theme ids a layout can name with `themeID` (98): `twilight-75`, `round-dots-orange`, `crystal-ice`, `crystal-pink`, `burgundy-gold`, `steampunk-typewriter`, `classic-beige-cyl`, `mx-keys-mini-mac`, `huntsman-rgb`, `retro-n-edition`, `pop-lime`, `q1-shell-white`, `retro-classic-leather`, `seventies-olive`, `magic-keyboard-silver`, `qwerkywriter`, `slim-solar-graphite`, `q-navy`, `g-blue`, `graphite-studio`, `speed-editor`, `creative-console`, `lcd-deck`, `grading-panel`, `mini-keydial`, `vintage-sampler`, `mini-keys-25`, `walnut`, `forest-moss`, `mountain-stone`, `deep-sea`, `carrara-marble`, `red-brick`, `cyberpunk-night-city`, `warcraft-azeroth`, `starcraft-terran`, `diablo-sanctuary`, `prince-of-persia`, `mortal-kombat`, `need-for-speed`, `gta-vice`, `god-of-war`, `ottoman-court`, `iznik-cini`, `galata-tower`, `ay-yildiz`, `kapadokya`, `pamukkale`, `efes`, `ayasofya`, `kiz-kulesi`, `turk-kahvesi`, `anadolu-kilimi`, `turkiye-turu`, `classic-dark`, `apple-ii`, `macintosh-128k`, `apple-extended-ii`, `imac-g3-bondi`, `apple-pro-keyboard`, `powerbook-g4-titanium`, `aluminum-2007`, `macbook-pro-space-gray`, `magic-keyboard-touch-id`, `imac-m1`, `m3-space-black`, `mx-keys`, `mx-mechanical`, `g915`, `atari-800`, `commodore-64`, `amiga-500`, `zx-spectrum`, `ibm-model-m`, `ibm-pc-5150`, `ti-99-4a`, `msx`, `game-boy-dmg`, `hhkb`, `keychron-k2`, `das-keyboard`, `razer-blackwidow`, `corsair-k70`, `gmk-olivia`, `gmk-laser`, `cherry-mxboard`, `underwood-5`, `olivetti-valentine`, `hologram`, `tron`, `synthwave`, `nothing`, `steampunk`, `dracula`, `nord`, `solarized-dark`, `solarized-light`, `e-ink`.

## Integration

| field | type | rules |
|---|---|---|
| `name` **required** | string | `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 40, unique |
| `url` **required** | string | `https://…` (rest, mcp), `wss://…` (websocket), `host:port` (grpc); plain http/ws only to localhost; the host may not come from a placeholder |
| `title` | string | |
| `kind` | `rest`, `websocket`, `mcp`, `grpc` | default `rest` |
| `method` | GET, POST, PUT, PATCH, DELETE | rest; default POST |
| `headers` | {string: string} | a header named like authorization/token/api-key/cookie/secret/password must use `${secret:NAME}` |
| `body` | string | rest body, websocket message, mcp tool arguments (JSON), grpc request (JSON) |
| `tool` | string | mcp tool name / grpc `package.Service/Method` (required for those kinds) |
| `extract` | string | dotted path into the JSON answer, `*` = the first that has the rest |
| `output` | `none`, `copy`, `type`, `open`, `save` | default `none` |
| `fileType` | `png`, `jpg`, `jpeg`, `webp`, `gif`, `mp4`, `mov`, `mp3`, `wav`, `pdf`, `txt`, `md`, `json` | for `save` |
| `find` | [`{"title", "search"?, "options"?, "list", "label", "detail", "set"}`] | lets the editor pick inputs from a list |

Placeholders: `${clipboard}`, `${secret:NAME}` (`^[A-Z][A-Z0-9_]{1,63}$`, kept in the Mac's keychain, **never the value in the file**),
`${input:name}` (`^[a-z][a-z0-9_]{0,31}$`, from the widget's `settings`).

## Macro

`{"name": "…", "icon": "bolt.fill", "steps": [MacroAction], "triggers": ["hotkey:cmd+shift+m", "text:;mtg", "time:09:00", …], "notes": "…"}`;
at most 60 steps; triggers match `^(hotkey|text|time|every|app|obs|mac|gesture|midi):.{1,120}$`.

## MacroAction (what a key does)

Swift's Codable shape: one key named after the case; unlabelled values are `_0`, `_1`; a case without values is `{}`.

```json
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
```

Every case (from the app's model):
- `{"keyChord": {"_0": KeyChord}}`: A key + modifiers, e.g. ⌘/ for "toggle comment".
- `{"typeText": {"_0": String}}`: Type a literal string (passwords, snippets, "One key = Q-W-E").
- `{"runShortcut": {"_0": String}}`: Run a macOS Shortcut by name via `shortcuts run`.
- `{"openApp": {"bundleID": String}}`: Bring an app to the front (bundle id).
- `{"openURL": {"_0": String}}`: Open a URL / file with the default handler.
- `{"setVolume": {"_0": Int}}`: Set absolute output volume 0...100.
- `{"mediaKey": {"_0": MediaKey}}`: Media/system key (see ceiling note in KeyInjector).
- `{"scrollBy": {"dx": Double, "dy": Double}}`: Scroll the Mac by a wheel notch — knobs bind to this.
- `{"sequence": {"_0": [MacroAction]}}`: Fire several actions in order — macros "used in tandem".
- `{"performIn": {"bundleID": String, "action": MacroAction}}`: Bring a Mac app to the front, then perform `action` in it — lets the iPad drive an app that isn't frontmost (manual target mode).
- `{"obs": {"_0": OBSCommand}}`: OBS Studio via obs-websocket (daemon-side). Real state comes back as ServerMessage.obs.
- `{"photoshop": {"_0": PhotoshopCommand}}`: Adobe Photoshop via AppleScript `do javascript` (daemon-side).
- `{"teams": {"_0": TeamsCommand}}`: Microsoft Teams meeting controls (chords + AX scripting, daemon-side).
- `{"menu": {"bundleID": String?, "path": [String]}}`: Press a menu item by its titles, e.g. ["Window", "Zoom"]; works for items with no shortcut. A component like "#3" picks the third item of that menu. `bundleID` nil = the frontmost app.
- `{"midi": {"_0": MIDICommand}}`: Send a MIDI message from the Mac's "iMacroPad" virtual source (daemon-side) — the pad as a control surface.
- `{"integration": {"plugin": String, "name": String}}`: A call an installed plugin defines (REST, WebSocket, MCP, gRPC), made by the Mac. The key only names it.
- `{"wait": {"seconds": Double}}`: Pause for a while before the next step.
- `{"click": {"x": Double, "y": Double, "button": Int}}`: Click at a point on the Mac's screen (global coordinates, top-left origin). `button` 0 = left, 1 = right.
- `{"clickElement": {"bundleID": String?, "title": String}}`: Press a button, checkbox or other control by its title or description in the app's windows (nil = front app).
- `{"waitFor": {"_0": MacroCondition, "timeout": Double}}`: Hold the macro until the condition holds, or fail after `timeout` seconds.
- `{"when": {"_0": MacroCondition, "then": MacroAction, "otherwise": MacroAction?}}`: Do `then` when the condition holds right now, else `otherwise` (nil = nothing).
- `{"loop": {"times": Int, "action": MacroAction}}`: Do `action` `times` times.
- `{"setClipboard": {"_0": String}}`: Put text on the Mac's clipboard.
- `{"appleScript": {"_0": String}}`: Run AppleScript or a shell command on the Mac — only when the Mac allows scripts (menu bar ▸ Allow Scripts).
- `{"shell": {"_0": String}}`
- `{"quitApp": {"bundleID": String}}`: Quit a Mac app the polite way (it may still ask to save).
- `{"macro": {"_0": UUID}}`: Run a macro of the library by its id.
- `{"pad": {"_0": PadCommand}}`: Something the pad itself does: switch layout, start the screensaver.
- `{"setVariable": {"name": String, "value": String}}`: Keep a text under a name for later steps: `` in any text is replaced by it (see `MacroText`).
- `{"clickText": {"_0": String}}`: Click words read on the screen, for apps whose controls have no names (Electron, games, remote desktops).
- `{"notify": {"_0": String}}`: A notification on the Mac.
- `{"stop": {}}`: End the macro here, as finished (not as a failure).

Value types:
- `KeyChord`: `{"key": <key name>, "modifiers": [`command`, `option`, `control`, `shift`, `function`]}`
- `MediaKey`: `playPause`, `next`, `previous`, `volumeUp`, `volumeDown`, `mute`, `brightnessUp`, `brightnessDown`
- `TeamsCommand`: `toggleMic`, `toggleCamera`, `raiseHand`, `toggleBlur`, `shareScreen`, `openChat`, `acceptCall`, `declineCall`, `leave`, `toggleRecording`, `toggleTranscript`, `toggleCaptions`, `statusAvailable`, `statusBusy`, `statusDoNotDisturb`, `statusBeRightBack`, `statusAway`, `statusOffline`
- `OBSCommand`: `{"toggleRecord": {}}`, `{"startRecord": {}}`, `{"stopRecord": {}}`, `{"pauseRecord": {}}`, `{"resumeRecord": {}}`, `{"toggleStream": {}}`, `{"startStream": {}}`, `{"stopStream": {}}`, `{"setScene": {"_0": String}}`, `{"setSourceVisible": {"scene": String, "source": String, "visible": Bool}}`, `{"toggleInputMute": {"_0": String}}`, `{"setInputVolume": {"_0": String, "mul": Double}}`, `{"saveReplayBuffer": {}}`, `{"refresh": {}}`
- `PhotoshopCommand`: `{"setForeground": {"hex": String}}`, `{"setBackground": {"hex": String}}`, `{"swapColors": {}}`, `{"setBrush": {"size": Double?, "hardness": Double?, "opacity": Double?}}`, `{"selectTool": {"_0": String}}`, `{"refresh": {}}`
- `PadCommand`: `{"layout": {"_0": String}}`, `{"nextLayout": {}}`, `{"previousLayout": {}}`, `{"screensaver": {"_0": Bool}}`, `{"theme": {"_0": String}}`
- `MIDICommand`: `{"note": {"channel": Int, "note": Int, "velocity": Int}}`, `{"noteOn": {"channel": Int, "note": Int, "velocity": Int}}`, `{"noteOff": {"channel": Int, "note": Int}}`, `{"cc": {"channel": Int, "controller": Int, "value": Int}}`, `{"program": {"channel": Int, "program": Int}}`
- `MacroCondition`: `{"appFrontmost": {"_0": String}}`, `{"appRunning": {"_0": String}}`, `{"element": {"bundleID": String?, "title": String}}`, `{"windowTitle": {"contains": String}}`, `{"not": {"_0": MacroCondition}}`, `{"all": {"_0": [MacroCondition]}}`, `{"any": {"_0": [MacroCondition]}}`, `{"time": {"from": String, "to": String}}`, `{"weekdays": {"_0": [Int]}}`, `{"text": {"_0": String, "_1": TextTest, "_2": String}}`, `{"textOnScreen": {"_0": String}}`

`appleScript` and `shell` are always refused in a plugin. `openApp`, `performIn`, `menu` with a `bundleID` and `quitApp` only for the plugin's own app.

Key names: `a`, `s`, `d`, `f`, `h`, `g`, `z`, `x`, `c`, `v`, `b`, `q`, `w`, `e`, `r`, `y`, `t`, `o`, `u`, `i`, `p`, `l`, `j`, `k`, `n`, `m`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `0`, `=`, `-`, `]`, `[`, `'`, `;`, `\`, `,`, `/`, `.`, ```, `return`, `enter`, `tab`, `space`, `delete`, `backspace`, `escape`, `esc`, `forwarddelete`, `home`, `end`, `pageup`, `pagedown`, `left`, `right`, `down`, `up`, `kp0`, `kp1`, `kp2`, `kp3`, `kp4`, `kp5`, `kp6`, `kp7`, `kp8`, `kp9`, `kp.`, `kp+`, `kp-`, `kpenter`, `f1`, `f2`, `f3`, `f4`, `f5`, `f6`, `f7`, `f8`, `f9`, `f10`, `f11`, `f12`, `f13`, `f14`, `f15`, `f16`, `f17`, `f18`, `f19`, `f20`.

## Capabilities (permissions)

- `keys`: Press keys, menu items and media controls
- `typeText`: Type text it brings
- `openLinks`: Open web and app links
- `shortcuts`: Run your Shortcuts by name
- `network`: Call the servers it names
- `clipboard`: Send your clipboard to those servers
- `typeAnswers`: Type a server's answer into the app in front
- `saveFiles`: Save a server's answer to Downloads
- `triggers`: React to gestures and MIDI keys on the Mac
- `html`: Show its own HTML (static: no script, no network)
- `liveData`: Show data it fetches, refreshed while on screen

What needs what: key chords, menus, media, volume, scrolling, MIDI, OBS/Photoshop/Teams, opening the app, clicks → `keys`;
`typeText` → `typeText`; `runShortcut` → `shortcuts`; `openURL` → `openLinks`; `setClipboard` → `clipboard`;
an integration → `network` (+ `clipboard` when it sends `${clipboard}`, + `typeAnswers` / `saveFiles` / `openLinks` for output type / save / open);
triggers or macro triggers → `triggers`; an html widget with content → `html`; a markdown/html/chart widget with an integration → `liveData`.
Info panels, labels and static markdown or charts need nothing.

## Info panels

`{"kind": "info", "infoID": "clock.digital", "frame": {…}, "param": "…"}`; sizes are grid cells (w × h). Full list: `list_widget_kinds`.
- **Time**: `clock.digital`, `clock.analog`, `clock.flip`, `clock.world`, `date`, `calendar.month`, `progress`, `countdown`
- **Tools**: `timer`, `stopwatch`, `note`, `battery.ipad`, `saver`
- **Weather & sky**: `weather.now`, `weather.hourly`, `weather.daily`, `air`, `sun`, `moon`
- **Personal**: `events`, `timeline`, `reminders`, `photos`
- **Mac**: `ai.sessions`, `mac.cpu`, `mac.memory`, `mac.disk`, `mac.network`, `mac.battery`, `mac.playing`, `mac.badges`, `mac.front`, `mac.command`
- **Market**: `fx`, `crypto`
- **Sports & F1**: `sports.team`, `sports.next`, `sports.last`, `sports.table`, `sports.player`, `sports.tennis`, `f1.race`, `f1.drivers`, `f1.teams`, `f1.driver`, `f1.team`
- **Usage stats**: `stats.today`, `stats.week`, `stats.top`, `stats.hours`, `stats.keys`, `stats.board`
- **Status**: `status.services`, `status.site`


# The plugin format (docs/PLUGINS.md)


A plugin is everything iMacroPad knows about one app, in one JSON file that can be shared:

| Part | What it holds |
|---|---|
| `app` | The Mac app it is for (name, bundle IDs). Its keys may only act on these apps. |
| `profiles` | Layouts: every key, dial, toggle and trackpad with its shortcut, menu item or gesture. |
| `themes` | Looks and colour palettes; a layout names the one it wears with `themeID`. |
| `components` | Widgets that are not on a layout: keys, dials, sliders, scroll wheels, and the free-style ones (Markdown, HTML, chart). They appear in Settings ▸ Widgets and in the editor's component library, and go on any layout. |
| `permissions` | What it asks to be allowed, each with the author's reason (see Permissions). |
| `triggers` | Gestures and MIDI keys on the Mac itself, active while the app is in front. |
| `integrations` | Calls to other services, made by the Mac: REST, WebSocket, MCP tools, gRPC. |

It holds data, never code. What a key may do is the fixed action vocabulary (`MacroAction`); what a plugin as
a whole may do is checked before it is installed.

The built-in plugins are the gallery's layouts grouped by app (`Plugins.builtIn`, 79 of them); Microsoft Teams
is the worked example with its own theme, call deck, component set and two trackpad gestures. A community
example with integrations is in [`plugins/`](../plugins).

A **widget pack** is a plugin that brings only widgets: with an `app` it is for that app (its keys first
bring that app to the front on other layouts), without one it is general.

## Hard limits

These hold for every plugin and widget, whatever it asks for and whatever is allowed:

- **No code.** A file holds data. There is no action that runs a script, a shell command or a program;
  the only things a key can do are the cases of `MacroAction`.
- **HTML is static.** An `.html` widget is drawn by a web view with JavaScript off, every request blocked
  by a content rule that is in place before the page loads, no stored data, and every navigation refused.
  The text is checked as well (no script, event handlers, forms, frames, links, media or anything loaded
  from outside; pictures only as `data:image`), when the file is installed and each time it is drawn —
  also for HTML an integration answers. Measured with a page that gets past the text check: 6 requests
  reach a local server from an ordinary web view, 0 from this one.
- **Markdown and charts are drawn by the app.** Links in Markdown are text; nothing opens.
- **Harmful text goes nowhere.** Text that pipes into a shell, deletes files, asks for administrator
  rights, reads keys, or — in words, English or Turkish — tells an assistant to drop its instructions,
  destroy data, send secrets, switch off a protection or act without approval, is refused in typed text
  *and* in everything an integration sends (address, headers, body, MCP tool arguments). A server's
  answer that is typed into the app in front is one line (it cannot press return) and goes through the
  same check on the Mac.
- **The Mac decides again.** It validates every file itself, removes what was not allowed, and re-reads
  its plugin folder through the same check; a pad can name an installed integration, never send an address.

The text rules are patterns: they catch the known shapes, not every wording. What cannot be worded
around is the rest of this list.

## Permissions

A plugin from outside (a file or a link) declares each capability it uses and why:

```json
"permissions": [
  { "capability": "network",   "reason": "The image key calls Google's Gemini API." },
  { "capability": "clipboard", "reason": "The text on your clipboard is the prompt that is sent." }
]
```

| `capability` | Covers |
|---|---|
| `keys` | key shortcuts, menu items, media and volume keys, scrolling, MIDI, opening its app |
| `typeText` | typing text the plugin brings |
| `openLinks` | opening web and app links |
| `shortcuts` | running your Shortcuts by name |
| `network` | calling the servers its integrations name |
| `clipboard` | sending your clipboard to those servers |
| `typeAnswers` | typing a server's answer into the app in front |
| `saveFiles` | saving a server's answer to Downloads/iMacroPad |
| `triggers` | reacting to gestures and MIDI keys on the Mac |
| `html` | showing its own static HTML |
| `liveData` | a Markdown, HTML or chart widget showing what an integration answers |

- Using a capability without declaring it, or with a reason shorter than 10 characters, is an error: the file stays out.
- The review sheet lists each one with the reason and a switch, all off. **What stays off is taken out of
  the installed copy** (`Plugin.restricted(to:)`): those keys do nothing, those integrations and triggers
  are not there, that HTML is blank — on the pad and, with the same list, on the Mac.
  `imacropadd plugin install FILE` asks the same questions in the terminal.
- A plugin's page shows what it asked for and what it got; **Look at its permissions again** reopens the review.
- Not asked: the built-in plugins, and what you make on this pad yourself (the wizard, a copy, a widget saved
  from the editor). Those are recorded by the pad as yours — a file's ID proves nothing — and when you share
  one, the permissions it needs are written into the file with reasons you can edit on its page.

## Widgets: Settings ▸ Widgets

- **New widget**: a button, toggle, knob, slider, scroll wheel, rotary dial, chip group, label, Markdown,
  HTML page or chart. It lands in your pack “My widgets” and opens in a form with a live preview.
- In the layout editor, **Save as a widget…** on the selected widget puts a copy into one of your packs.
- **+** on any widget — yours, a pack's, or one of the built-in sets — puts it on the layout that is showing.
- A pack is shared from its page like any plugin, and comes in by file or https link through the same check
  and the same permission switches.

Free-style widgets carry `content`:

| `kind` | `content` |
|---|---|
| `markdown` | `# Heading`, `## Subheading`, `- list`, `> quote`, `**bold**`, `*italic*`, `` `code` `` |
| `html` | static HTML with inline styles |
| `chart` | `{"type":"bar","title":"…","labels":[…],"values":[…]}`, a JSON list of numbers, or lines of `label, value` (first line may be `bar`, `line` or `area`) |

With `"action": {"integration": {"plugin": "<its id>", "name": "<call>"}}` the widget shows what that call
answers instead (the Mac makes the call; `param` is the seconds between calls, never under 30).
Example pack: [`plugins/community.status-widgets.imacropad-plugin.json`](../plugins/community.status-widgets.imacropad-plugin.json).

**Templates.** A `content` with `{{…}}` tags is filled from the answer (JSON) rather than shown as written:

| tag | does |
|---|---|
| `{{events.0.strEvent}}` | the value at a dotted path; `.` is the current item; in a list of `{"name": …}` objects a word picks by name (`stats.wins.displayValue`) |
| `{{strTimestamp\|date}}` | an ISO date or timestamp (UTC unless it says otherwise) in the pad's language and time zone |
| `{{date\|date:time}}` | the same, with the time in a field of its own (`"date": "2026-10-25"`, `"time": "20:00:00Z"`) |
| `{{#list}}…{{/list}}` | repeated per item (`{{#list\|5}}` = the first five), or shown once for a value that is there |
| `{{^list}}…{{/list}}` | shown when it is missing, empty or false |

In `html` widgets every value is HTML-escaped, and the filled page goes through the same static-HTML check.
With no integration, tags read the pad's own usage stats (Settings ▸ Stats): `stats.screenTime`, `stats.taps`,
`stats.since`, `stats.today.{screenTime,taps,minutes}`, the top five `stats.layouts`, `stats.apps`,
`stats.themes`, `stats.widgets` (each `rank`, `name`, `taps`, `time`, `minutes`, `share` in percent of the
first) and the last seven `stats.days` (`day`, `minutes`, `taps`, `share`). They never leave the iPad.

**Inputs.** `${input:team}` in an integration's address, headers or body is filled from the widget's
`settings` (`"settings": {"team": "133804"}`), encoded for where it sits; the editor shows one field per input
under Live data. So one call serves every team, league or city, and the server's address stays fixed.

**Finders.** Nobody should have to look up an ID: an integration's `find` lets the editor pick its inputs from
a list. `search` names another integration of the plugin; when it reads `${input:q}` it is asked again for what
is typed, otherwise it is fetched once and narrowed on the pad. A fixed list goes in `options` instead.
`list` is where the items are in the answer; `label`, `detail` and each value in `set` are templates filled from
the item:

```json
"find": [{"title": "Team", "search": "find-team", "list": "teams",
          "label": "{{strTeam}}", "detail": "{{strSport}} · {{strLeague}}", "set": {"team": "{{idTeam}}"}}]
```

The picked label is kept as `settings["team.title"]`, and a widget named after the old pick takes the new name.

Community examples: [`community.usage-stats`](../plugins/community.usage-stats.imacropad-plugin.json),
[`community.sports-scores`](../plugins/community.sports-scores.imacropad-plugin.json) and
[`community.status-widgets`](../plugins/community.status-widgets.imacropad-plugin.json). They are packs of the app's own
info panels (`"kind": "info"` with an `infoID`, a `param` and `settings`) and ready layouts — no HTML: the Usage stats
charts of Settings ▸ Stats; Sports & F1 (team card, next match, last result, full league tables from ESPN for the big
leagues and TheSportsDB for any other, player card, tennis rankings, Formula 1 from Jolpica) with five looks
(`settings.look`: club, photo, scoreboard, minimal, or automatic); and service status pages and site monitors. An AI
assistant can make packs like these with the community MCP server and skill (see community/README.md).

## On the pad: Settings ▸ Plugins

- **Install** a built-in one, **open a file** someone shared, or **get one from an https link**.
  A file is shown with its check report first; Install stays off while there is an error.
- **From the Community site**: *Install in iMacroPad* opens `imacropad://install?url=<https file>`, which fetches
  the file and shows the same review sheet. The catalog (its own public repo, `community/` here until it moves)
  lists only items that passed its folder rules, `imacropadd plugin validate`, an AI review and an editor.
- **Make a copy to change**: the copy gets your own ID (`user.<name>-<4 hex>`), so it can be edited and shared.
  Its layouts open in the normal editor, its themes in the theme editor; integrations and gestures have their
  own forms. The plugin keeps whatever you change.
- **Share the plugin file**: `<id>.imacropad-plugin.json`, with the layouts and themes as they are now.
- **New plugin for an app…**: pick the app (the ones open on the Mac are listed). The Mac reads its menu
  commands with their shortcuts, the shortcuts you gave it yourself (`NSUserKeyEquivalents` in its preferences)
  and the link types of its `Info.plist`, and proposes a component for each: a key for a command, one dial for
  a pair (Zoom In / Zoom Out, Next / Previous), a toggle for show/hide commands. A command without a shortcut
  is pressed in the menu by name. Keep the proposal (what does not fit the 6×8 grid goes to the component
  library) or start with an empty layout and design it in the editor.
- A key calls an integration with **Do ▸ Plugin integration** in the editor; a Shortcut with **Do ▸ Run Shortcut**.

## The check (`PluginValidator`)

Runs on the pad when a file is opened and again on the Mac before it is kept. It only reads the file.
An error keeps the plugin out; warnings are what you are shown to decide.

**Rejected**

- Not a plugin, larger than 4 MB, made for a newer format, empty, or beyond the size limits
  (24 layouts, 150 keys a layout, 40 steps a sequence, 2000 typed characters).
- An `imacropad.` ID from outside the app; a theme ID that does not start with the plugin's own ID.
- A layout bound to, or a key aimed at (`performIn`, `openApp`, `menu`), an app the plugin does not declare.
- Typed text that pipes into a shell, downloads and runs, deletes files, asks for administrator rights,
  reads keys or the keychain, changes shell start-up files or system settings — also when split over several steps.
- `openURL` with `file:`, `javascript:`, `data:`, a bare path or a remote-login scheme.
- Integrations: a key or token written into the file (headers, address or body), unencrypted `http://` or
  `ws://` to anything but this Mac, a link-local or metadata address, a server address taken from a
  placeholder, an unknown placeholder, an answer saved under a file type that runs when opened.
- Keys off the pad, unknown key names, colours that are not `#RRGGBB`, pictures outside the app's folder.
- An HTML widget that is not static, a chart without numbers, a Markdown/HTML/chart widget that tries to press something.
- A capability used without being asked for with a reason (see Permissions).

**Shown as warnings or notes**: text a key types, Shortcuts it runs, custom link types it opens, hosts it
calls, the clipboard being sent to a host, answers typed or opened, unreadable legend contrast, keys that
lock the screen or log out.

## The test tool (`imacropadd plugin test`)

The check plus this Mac and the real app; it presses nothing:

- the app is installed; when it is running, every menu item a key presses by name exists in its menus
  (more than half missing = made for another app, version or language: rejected);
- how many of the key shortcuts appear in the app's menus (web-based apps such as Teams keep theirs out of
  the menus, so this is a note);
- every Shortcut it runs exists; every secret it needs is in the keychain; `grpcurl` is there when needed;
- every integration's server accepts a connection.

On the pad the same test is **Test with the app on the Mac** on a plugin's page and on the review sheet.

```sh
imacropadd plugin validate FILE…      # the check alone; exit 1 when a file is rejected (CI for a plugin repo)
imacropadd plugin test FILE [--json]  # the check + this Mac and the app
imacropadd plugin install FILE        # only when it passes
imacropadd plugin remove ID | list
imacropadd plugin scan BUNDLE         # an app's commands and the components proposed for them
imacropadd plugin call ID NAME        # run one integration of an installed plugin and print the answer
imacropadd plugin builtin [ID]        # the built-in plugins / one as a file to start from
python3 Scripts/plugin-test.py        # the gate end to end over the wire, on a spare port
```

## Integrations

```json
{ "name": "generate-image", "title": "Image from clipboard", "kind": "rest", "method": "POST",
  "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
  "headers": { "x-goog-api-key": "${secret:GEMINI_API_KEY}" },
  "body": "{\"contents\":[{\"parts\":[{\"text\":\"${clipboard}\"}]}]}",
  "extract": "candidates.0.content.parts.*.inlineData.data", "output": "save", "fileType": "png" }
```

| `kind` | `url` | `body` | `tool` |
|---|---|---|---|
| `rest` | `https://…` | request body (JSON gets `Content-Type: application/json`) | — |
| `websocket` | `wss://…` (`ws://localhost` allowed) | the message sent; one answer is awaited | — |
| `mcp` | the server's Streamable-HTTP address | the tool's arguments as JSON | the tool's name |
| `grpc` | `host:port` | the request as JSON | `package.Service/Method` |

- The pad sends only the plugin's ID, the call's name and the widget's inputs; the Mac looks the call up in its
  installed copy. A pad can never hand the Mac an address: an `${input:…}` may not stand in the server's part.
- `${secret:NAME}` is read from the Mac's login keychain: `imacropadd secret set NAME` asks for the value
  without showing it (`secret list`, `secret remove NAME`). `${clipboard}` is the text on the Mac's clipboard:
  copy a prompt, press the key.
- `extract` picks the useful part of a JSON answer: keys and positions joined with dots, `*` for the first
  element that has the rest. For MCP without a path the tool's text (or first picture) is taken.
- `output`: `none`, `copy`, `type`, `open` (web links only) or `save` — to `~/Downloads/iMacroPad/` as one of
  png, jpg, jpeg, webp, gif, mp4, mov, mp3, wav, pdf, txt, md, json; base64 and https links are fetched/decoded.
- Redirects are not followed, so a header with a secret never reaches another server. The call runs behind
  the key press and ends in a notification on the Mac.
- gRPC goes through `grpcurl` (`brew install grpcurl`); URLSession has no HTTP/2 trailers to do it natively.
- MCP servers that need an OAuth sign-in are not supported; a bearer token in a `${secret:…}` header is.
  The Higgsfield entry in the sample is a shape to fill in: take the address and tool name from the server's
  own documentation and check it with `imacropadd plugin call`.

An Apple Shortcut needs no integration: `{ "runShortcut": { "_0": "Name" } }` on a key runs it.

## Sharing with the community

A plugin is a single file, so a folder in any git repo is a plugin catalogue: users install from the raw
https link, and `imacropadd plugin validate plugins/*.json` in CI keeps a rejected file from being merged.
To contribute one here: make it on the pad (or start from `imacropadd plugin builtin ID`), share the file,
put it in `plugins/` as `<id>.imacropad-plugin.json` with an ID of your own (`yourname.app-name`), and run
`swift test` — `theCommunitySamplesPass` checks every file in that folder.

Not there yet: signatures (a file does not prove who made it — the check judges what it does, and the
`imacropad.` namespace cannot be claimed), plugin pictures (key images and theme backgrounds do not travel),
and an in-app catalogue browser.

## Where things live

| | |
|---|---|
| `Sources/MacroKit/Plugin.swift` | the file's model, reports, the app scan |
| `Sources/MacroKit/PluginValidator.swift` | the check |
| `Sources/MacroKit/PluginBuilder.swift` | scan → components → layout; the built-in catalogue |
| `Sources/imacropadd/Plugins.swift` | the Mac's plugin folder, test tool, secrets, integration calls, CLI |
| `Sources/MacroKit/CustomWidgets.swift` | the static-HTML check, chart data |
| `Sources/iPadApp/PluginStore.swift`, `Settings/PluginsView.swift` | installing on the pad, permissions, the plugin and widget managers, editors, wizard |
| `Sources/iPadApp/Widgets/CustomWidgets.swift` | the Markdown, HTML and chart widgets; the locked-down web view |
| `Tests/MacroKitTests/PluginTests.swift`, `Tests/iPadUITests/PluginsUITests.swift`, `Scripts/plugin-test.py` | tests |

On the Mac: `~/.config/imacropadd/plugins/<id>.json` (`IMACROPADD_PLUGINS=<folder>` for tests).
On the pad: `Documents/Plugins/<id>.json`; a plugin's layouts are ordinary layouts tagged with its ID,
its themes ordinary custom themes whose ID starts with it. Protocol 6 added `scanApp`, `installPlugin`,
`removePlugin`, `testPlugin`, `appScan`, `pluginReport` and the `integration` action; protocol 7 added the
granted permissions to `installPlugin`, and `fetchData` / `data` for widgets that show an integration's answer.
