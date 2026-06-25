---
name: meme-creator
description: Generate meme PNG images from a user's local image and caption using the Meme Generator website's own HTML and Canvas rendering defaults. Use when the user asks to create a 梗图/meme from an image plus text, wants the result to match the local Meme Generator web app, or needs a PNG exported without browser file-upload automation or OpenCLI clicking.
---

# Meme Creator

## Overview

Generate a PNG by opening the local Meme Generator HTML in headless Playwright, injecting the image as a data URL, setting the caption, and exporting the page's real canvas output. Do not automate Chrome file uploads and do not click through OpenCLI.

## Workflow

1. Resolve the user's image to a local file path. Ask for the path only if it is not provided or cannot be inferred.
2. Resolve the caption from direct user text or from a local text file.
3. Choose an output path ending in `.png`; default to `output/meme-YYYYMMDD-HHMMSS.png` under the current workspace.
4. Run `scripts/create_meme.js` with absolute paths.
5. Return the generated PNG path, dimensions, and any important warning from the script output.

## Command

Use Node.js:

```bash
node .agents/skills/meme-creator/scripts/create_meme.js \
  --image /absolute/path/input.jpg \
  --text-file /absolute/path/caption.txt \
  --output /absolute/path/output.png
```

For short captions, pass text directly:

```bash
node .agents/skills/meme-creator/scripts/create_meme.js \
  --image /absolute/path/input.jpg \
  --text "第一行
第二行" \
  --output /absolute/path/output.png
```

Optional `--html /absolute/path/index.html` overrides the HTML entrypoint. Use it only when the user explicitly wants a different Meme Generator checkout or artifact.

## Defaults And Invariants

- Preserve the website's current default rendering parameters: font family, weight, colors, font size percent, line height, padding, box height, radius, and max line width.
- Use `window.memeGenerator.loadImageDataUrl()`, `setText()`, and `exportPng()` from the page. This keeps output aligned with the web app.
- Prefer canvas export over page or element screenshots. The preview canvas may be CSS-scaled, while `exportPng()` returns the true original image dimensions.
- Do not use OpenCLI, Chrome extension bridges, OS file pickers, or `<input type="file">` upload automation.

## Failure Handling

- If Playwright is unavailable, report that the script needs Playwright and prefer running inside Codex Desktop's bundled runtime.
- If the page does not expose `window.memeGenerator`, stop and report that the local HTML no longer exposes the automation API.
- If the image is unsupported, ask for PNG, JPEG, WebP, or GIF.
