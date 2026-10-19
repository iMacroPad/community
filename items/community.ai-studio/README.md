Keys that send the text on your clipboard to AI services and bring the answer back to your Mac.

## What you get

- **Image from clipboard**: sends your clipboard text to Google's Gemini 2.5 Flash Image and saves the picture
  as a PNG in Downloads/iMacroPad, then opens it.
- **Answer the clipboard**: sends your clipboard text to Google's Gemini 2.5 Flash and puts a short answer on
  your clipboard.
- **Video (MCP)**: sends your clipboard text to the `generate_video` tool of Higgsfield's MCP server
  (`mcp.higgsfield.ai`). The server answers with a link, which opens in your browser.
- **My Shortcut**: runs a Shortcut named exactly **AI Studio**. It is not included: make your own in the
  Shortcuts app first. Without it the key does nothing.
- **Copy** and **Paste**: ⌘C and ⌘V, to copy a prompt and paste an answer.
- A *How to use* card and the *AI Studio Neon* theme.

## Before you start

1. **Gemini** (image and answer keys): get an API key at Google AI Studio and put it into the Mac's keychain
   as `GEMINI_API_KEY`.
2. **Higgsfield** (video key): get an access token from your Higgsfield account and put it into the Mac's
   keychain as `HIGGSFIELD_TOKEN`. Skip this if you don't want the video key.
3. Install, then switch on only the permissions you want. What stays off is removed from your copy.

The plugin file never holds a key.

## What leaves your Mac

Nothing is sent until you press a key. Then only your clipboard text goes out: to Google for the image and
answer keys, to Higgsfield for the video key. Their own terms apply to what you send.
