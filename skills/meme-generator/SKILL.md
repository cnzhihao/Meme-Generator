---
name: meme-generator
description: Generate meme PNG images from a user's local joke, caption, and image library by selecting source material, operating the Meme Generator website through OpenCLI browser automation, and saving the downloaded result to the requested location. Use when the user asks to turn local memes, jokes, text snippets, or image assets into a finished meme image.
---

# Meme Generator

## Overview

Use this skill to make a finished meme PNG from a local knowledge base of jokes and images. The browser UI is `https://meme-generator.fhxqtech.com`.

This skill assumes OpenCLI's `opencli-browser` skill is available. If browser commands fail because OpenCLI or Browser Bridge is missing, ask the user to install or repair OpenCLI before continuing.

## Workflow

1. Confirm inputs:
   - Knowledge base directory containing jokes/captions and images.
   - Output directory for the final PNG.
   - Meme topic, joke, audience, or style requested by the user.
2. Read source material:
   - Text files: `.txt`, `.md`, `.json`.
   - Images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.
   - Do not delete, rewrite, or reorganize original source files.
3. Select material:
   - Pick or adapt one short joke/caption that fits the user's request.
   - Pick one matching image. Prefer clear, inspectable images over blurry or tiny files.
   - If the request names a specific joke or image, use that unless the file is missing.
4. Generate the meme:
   - Use OpenCLI browser automation to open `https://meme-generator.fhxqtech.com`.
   - Prefer the Agent image URL path over the native file picker:
     1. Start a temporary local static server for the selected image with `Access-Control-Allow-Origin: *`.
     2. Fill `#agentImageUrl` with the served image URL, for example `http://127.0.0.1:8790/image.jpg`.
     3. Click `#agentLoadImageBtn`.
     4. Verify the canvas dimensions match the loaded image.
   - Use the native file input only as a fallback.
   - Fill the caption textarea with the selected or adapted text.
   - Adjust advanced controls only when needed for readability.
   - Download the PNG.
5. Save the result:
   - Move the downloaded PNG to the requested output directory.
   - Use a clear filename based on the topic plus a timestamp, for example `meme-product-launch-20260625-143000.png`.
   - Never overwrite an existing file; add a timestamp or numeric suffix.

## Browser Automation Notes

- Prefer structured OpenCLI browser commands over manual screenshot guessing.
- Wait for the page and canvas to render before downloading.
- Native file upload can be blocked by Chrome with `Not allowed`. Do not ask the user to upload manually; use the Agent image URL path instead.
- If the downloaded file location is ambiguous, check the user's Downloads folder first and use modification time to identify the newest meme PNG.

## Output

Return the saved file path and a short note describing which source text and image were used.
