# iMacroPad community catalog

Layouts, themes, widgets, plugins and workflows made by iMacroPad users, checked before they are listed.
Browse and install them at **[imacropad.app/community](https://www.imacropad.app/community/)**.

- **Install**: on the website, *Install in iMacroPad* opens the app on your iPad or iPhone with the item's review
  sheet: the check report and a switch for each permission it asks for, all off. Or copy the file's link into
  Settings ▸ Plugins ▸ *Get one from a link*.
- **Like**: 👍 the item's issue (the website links to it). The website lists the most liked.
- **Request**: [ask for something](../../issues/new?template=request.yml) or 👍 a request.
- **Share yours**: [CONTRIBUTING.md](CONTRIBUTING.md).

Every item is data, never code, and passes four gates before it is listed: the folder rules, the app's own
validator, a review by Claude ([REVIEW.md](REVIEW.md)) and an editor. The app checks it again on the pad and on the Mac
before it installs it.

## For editors

| | |
|---|---|
| `scripts/catalog.mjs check` | the folder rules (`--base DIR` also checks version bumps) |
| `scripts/catalog.mjs publish` | a release per new version, an issue per new item |
| `scripts/catalog.mjs index` | `index.json` for the website, with installs, likes and requests |
| `editors-picks.json` | the IDs shown under *Editors' picks* |

Claude is the catalog's first reviewer: the GitHub app [Claude](https://github.com/apps/claude) is installed on
this repo, reviews every pull request as `claude[bot]` (advisory: it never approves) and answers editors who
mention `@claude` in an issue or a pull request.

Setup once: the ruleset on `main` (pull request, Code Owners review, checks `rules` and `validate`); secrets
`CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) and `SITE_DEPLOY_HOOK` (Cloudflare Pages deploy hook that
rebuilds the website); a release `validator` with the `imacropadd` binary (`Scripts/publish-validator.sh` in the
app's repo).

Items are shared under CC BY 4.0 by their authors.
