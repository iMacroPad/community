# Sharing what you made

Layouts, themes, widget packs, plugins with integrations and macro workflows are all one kind of file in
iMacroPad: a plugin (`.imacropad-plugin.json`). Share yours here and anyone can install it from
[imacropad.app/community](https://www.imacropad.app/community/) with one tap.

## 1. Make it and export it

On the pad: **Settings ▸ Plugins ▸ your plugin ▸ Share the plugin file** (for a widget pack: Settings ▸ Widgets ▸
the pack ▸ Share). The permissions it needs are written into the file, with reasons you can edit on its page.

Then check it on your Mac, the same check the app and this catalog run:

```sh
imacropadd plugin validate your.id.imacropad-plugin.json
imacropadd plugin test your.id.imacropad-plugin.json     # also against the real app on this Mac
```

## 2. Add one folder

```
items/<id>/                       the folder is named after the plugin's "id"
  <id>.imacropad-plugin.json      the file you exported
  meta.json                       what kind it is, tags, screenshots
  README.md                       what it does, what it needs, how to set it up
  screenshots/1.png …             1–8 pictures of it on the pad, PNG/JPEG/WebP, 1.5 MB each at most
```

```json
{
  "type": "widgets",
  "tags": ["sports", "football"],
  "screenshots": [{ "file": "1.png", "caption": "Next match and the league table" }]
}
```

`type` is one of: `plugin` (everything for one app), `layout`, `theme`, `widgets`, `integration`
(calls to other services), `workflow` (macros).

**ID**: lower case with a dot, starting with your name: `yourname.davinci-color`. Not `imacropad.…`.
**Version**: change anything in the plugin file and raise `"version"` (1.0.0 → 1.0.1). Installs are counted per version.
**README**: plain Markdown, no HTML, no pictures (they go in `screenshots/`). Say which app and version you
tested it with, and what an integration sends where.

## 3. Open a pull request

One item per pull request, changing only `items/<id>/`. Then, in order:

1. **Rules**: the folder follows the format above (`node scripts/catalog.mjs check`).
2. **Validator**: the app's own check runs on a Mac. An error stops here.
3. **Claude's review**: Claude (`claude[bot]`) reads the file, the README and every screenshot against
   [REVIEW.md](REVIEW.md) and posts a review on the pull request. It only advises.
4. **Editor**: a person reads the review, tries it on a real pad when it presses keys in an app, and merges.

Merged items are live on the website within minutes. Updates go the same way; an editor may remove an item that
stops working or breaks the rules.

## Rules

- It works with the current app, and does what its README and screenshots say.
- No keys, tokens or personal data in any file. A plugin names secrets (`${secret:NAME}`); each person puts their own in their Mac's keychain.
- Screenshots are yours, of this item, with nothing personal in them.
- Nothing that impersonates an app maker, advertises, tracks, or sends data the README does not mention.
- By opening a pull request you share it under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**Want something that does not exist yet?** [Request it](../../issues/new?template=request.yml), or 👍 a request
that is already there. The most wanted ones are shown on the website.
