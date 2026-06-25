import { cli, Strategy } from "@jackwener/opencli/registry";
import { ArgumentError, CommandExecutionError } from "@jackwener/opencli/errors";
import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_URL = "https://meme-generator.fhxqtech.com";
const IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

function resolveImageDataUrl(file) {
  const absolute = path.resolve(String(file || ""));
  if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new ArgumentError(`图片文件不存在: ${absolute}`);
  }
  const mime = IMAGE_MIME[path.extname(absolute).toLowerCase()];
  if (!mime) {
    throw new ArgumentError("图片仅支持 PNG、JPEG、WebP 或 GIF");
  }
  return {
    file: absolute,
    dataUrl: `data:${mime};base64,${fs.readFileSync(absolute).toString("base64")}`
  };
}

function resolveText(kwargs) {
  const textFile = String(kwargs.textFile || "");
  const text = String(kwargs.text || "");
  if (textFile) {
    const absolute = path.resolve(textFile);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      throw new ArgumentError(`文案文件不存在: ${absolute}`);
    }
    return fs.readFileSync(absolute, "utf-8").trim();
  }
  if (!text.trim()) {
    throw new ArgumentError("必须提供文案：使用位置参数 <text> 或 --textFile");
  }
  return text.trim();
}

function resolveOutput(value) {
  const output = path.resolve(String(value || "./meme.png"));
  if (path.extname(output).toLowerCase() !== ".png") {
    throw new ArgumentError("--output 必须是 .png 文件路径");
  }
  return output;
}

cli({
  site: "meme-generator",
  name: "generate",
  description: "生成梗图 PNG 并保存到本地",
  access: "write",
  example: "opencli meme-generator generate --image ./face.jpg --textFile ./joke.txt --output ./meme.png -f json",
  domain: "meme-generator.fhxqtech.com",
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: "text", type: "string", required: false, positional: true, help: "梗图文案；多行文案建议使用 --textFile" },
    { name: "image", type: "string", required: true, help: "本地图片路径，支持 PNG、JPEG、WebP、GIF" },
    { name: "textFile", type: "string", default: "", help: "本地文案文件路径，优先级高于位置参数 text" },
    { name: "output", type: "string", default: "./meme.png", help: "输出 PNG 文件路径" },
    { name: "url", type: "string", default: DEFAULT_URL, help: "Meme Generator 页面 URL" }
  ],
  columns: ["file", "width", "height", "textLength", "status"],
  func: async (page, kwargs) => {
    const { dataUrl } = resolveImageDataUrl(kwargs.image);
    const text = resolveText(kwargs);
    const output = resolveOutput(kwargs.output);
    const url = String(kwargs.url || DEFAULT_URL);

    try {
      await page.goto(url);
      await page.wait({ selector: "#canvas", timeout: 20 });

      const result = await page.evaluate(async (payload) => {
        const api = window.memeGenerator;
        if (!api?.loadImageDataUrl || !api?.setText || !api?.exportPng) {
          throw new Error("网页未提供 memeGenerator 自动化 API");
        }
        await api.loadImageDataUrl(payload.dataUrl);
        api.setText(payload.text);
        return api.exportPng();
      }, { dataUrl, text });

      if (!result?.base64 || !result.width || !result.height) {
        throw new Error("网页返回了无效的 PNG 结果");
      }

      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, Buffer.from(result.base64, "base64"));

      return [{
        file: output,
        width: result.width,
        height: result.height,
        textLength: text.length,
        status: "ok"
      }];
    } catch (error) {
      if (error instanceof ArgumentError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `生成梗图失败: ${message}`,
        `确认网页可访问且已部署 window.memeGenerator 自动化 API。当前地址: ${url}`
      );
    }
  }
});
