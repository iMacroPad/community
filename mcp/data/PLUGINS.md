# Plugins

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
