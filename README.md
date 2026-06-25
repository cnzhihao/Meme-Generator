# Meme Generator

A static Chinese meme image generator. Upload an image, edit the text, adjust layout options, and export a PNG from the browser.

## Local Usage

Open `index.html` directly in a browser.

The deployed static build lives in `dist/` and mirrors the root HTML, CSS, and JavaScript files.

## Cloudflare Pages

Use these settings when connecting the GitHub repository to Cloudflare Pages:

- Repository: `cnzhihao/Meme-Generator`
- Production branch: `main`
- Build command: leave empty
- Build output directory: `dist`
- Root directory: `/`

The Pages project name is configured as `meme-generator` in `wrangler.jsonc`.

## License

MIT
