#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createRequire } = require("node:module");

const IMAGE_MIME = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"]
]);

const BUNDLED_NODE_MODULES = path.join(
  os.homedir(),
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
);

function fail(message, details) {
  const payload = { status: "error", message };
  if (details) payload.details = details;
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      fail(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function defaultOutputPath() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return path.resolve(process.cwd(), "output", `meme-${stamp}.png`);
}

function resolveFile(file, label) {
  if (!file) fail(`Missing required --${label}`);
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    fail(`${label} file does not exist`, absolute);
  }
  return absolute;
}

function resolveImageDataUrl(file) {
  const absolute = resolveFile(file, "image");
  const ext = path.extname(absolute).toLowerCase();
  const mime = IMAGE_MIME.get(ext);
  if (!mime) {
    fail("Unsupported image type. Use PNG, JPEG, WebP, or GIF.", absolute);
  }
  return {
    file: absolute,
    dataUrl: `data:${mime};base64,${fs.readFileSync(absolute).toString("base64")}`
  };
}

function resolveText(args) {
  if (args["text-file"]) {
    return fs.readFileSync(resolveFile(args["text-file"], "text-file"), "utf8").trim();
  }
  if (typeof args.text === "string" && args.text.trim()) {
    return args.text.trim();
  }
  fail("Missing caption text. Provide --text or --text-file.");
}

function resolveHtml(file) {
  const fallback = path.resolve(__dirname, "../../../..", "index.html");
  return resolveFile(file || fallback, "html");
}

function resolveOutput(file) {
  const output = path.resolve(file || defaultOutputPath());
  if (path.extname(output).toLowerCase() !== ".png") {
    fail("--output must end with .png", output);
  }
  return output;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (firstError) {
    try {
      return createRequire(path.join(BUNDLED_NODE_MODULES, "noop.js"))("playwright");
    } catch (secondError) {
      fail(
        "Playwright is not available.",
        "Run inside Codex Desktop's bundled runtime or install Playwright for the active Node.js environment."
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { dataUrl, file: image } = resolveImageDataUrl(args.image);
  const text = resolveText(args);
  const html = resolveHtml(args.html);
  const output = resolveOutput(args.output);
  const { chromium } = loadPlaywright();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(html).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const api = window.memeGenerator;
      return Boolean(api && api.loadImageDataUrl && api.setText && api.exportPng);
    }, null, { timeout: 10000 });

    const result = await page.evaluate(async (payload) => {
      await window.memeGenerator.loadImageDataUrl(payload.dataUrl);
      window.memeGenerator.setText(payload.text);
      return window.memeGenerator.exportPng();
    }, { dataUrl, text });

    if (!result || !result.base64 || !result.width || !result.height) {
      fail("The Meme Generator page returned an invalid PNG payload.");
    }

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, Buffer.from(result.base64, "base64"));

    console.log(JSON.stringify({
      status: "ok",
      file: output,
      image,
      html,
      width: result.width,
      height: result.height,
      textLength: text.length
    }, null, 2));
  } catch (error) {
    fail("Failed to generate meme PNG.", error && error.message ? error.message : String(error));
  } finally {
    if (browser) await browser.close();
  }
}

main();
