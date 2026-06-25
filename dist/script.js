    const $ = (id) => document.getElementById(id);

    const canvas = $("canvas");
    const ctx = canvas.getContext("2d");

    const imageInput = $("imageInput");
    const agentImageUrl = $("agentImageUrl");
    const memeText = $("memeText");
    const agentPrompt = `你现在要帮我把 Meme Generator 接入 OpenCLI，并安装用于自动生成梗图的 Skill。请按下面步骤执行，并在每一步完成后继续下一步：

1. 检查本机 Node.js 版本是否 >= 21.0.0；如果版本不够，请告诉我需要先升级 Node.js。
2. 安装或更新 OpenCLI：
   npm install -g @jackwener/opencli
3. 确认 Chrome 已安装 Browser Bridge 扩展：
   https://chromewebstore.google.com/detail/browser-bridge/jbajonmonccnibicpjlfkkcenpjcpedo
4. 运行诊断：
   opencli doctor
5. 安装 OpenCLI 浏览器 Skill：
   npx skills add jackwener/opencli --skill opencli-browser
6. 安装 Meme Generator Skill：
   npx skills add cnzhihao/Meme-Generator --skill meme-generator

安装完成后，后续我会用 $meme-generator 让你根据我的本地知识库目录、输出目录和梗图主题，自动打开 https://meme-generator.fhxqtech.com，选择段子和图片，生成 PNG，并保存到我指定的位置。`;

    const controls = [
      "fontFamily", "fontWeight", "textColor", "boxColor", "fontSizePct", "lineHeight",
      "padXPct", "boxHeightEm", "radiusEm", "maxWidthPct"
    ];

    let sourceImage = new Image();
    let hasImage = false;

    function roundedRectPath(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function updateControlLabels() {
      $("fontSizePctValue").textContent = Number($("fontSizePct").value).toFixed(1) + "%";
      $("lineHeightValue").textContent = Number($("lineHeight").value).toFixed(2);
      $("padXPctValue").textContent = Number($("padXPct").value).toFixed(2) + "em";
      $("boxHeightEmValue").textContent = Number($("boxHeightEm").value).toFixed(2) + "em";
      $("radiusEmValue").textContent = Number($("radiusEm").value).toFixed(2) + "em";
      $("maxWidthPctValue").textContent = Number($("maxWidthPct").value).toFixed(0) + "%";
    }

    function getRawLines() {
      return memeText.value
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);
    }

    function wrapLine(line, maxWidth) {
      if (!line) return [];

      const result = [];
      let current = "";
      const chars = Array.from(line);

      for (const ch of chars) {
        const test = current + ch;
        if (ctx.measureText(test).width <= maxWidth || current.length === 0) {
          current = test;
        } else {
          result.push(current);
          current = ch;
        }
      }

      if (current) result.push(current);
      return result;
    }

    function fitCanvasToImage() {
      if (hasImage && sourceImage.naturalWidth && sourceImage.naturalHeight) {
        canvas.width = sourceImage.naturalWidth;
        canvas.height = sourceImage.naturalHeight;
      } else {
        canvas.width = 1080;
        canvas.height = 1080;
      }
    }

    // Equal-ratio fit into the preview frame; height is preferred, but a
    // landscape image is capped by the frame width so it never stretches.
    function fitCanvasToView() {
      const wrap = document.querySelector(".canvas-wrap");
      if (!wrap) return;
      const padW = wrap.clientWidth - 48;   // minus horizontal padding (24 * 2)
      const padH = wrap.clientHeight - 48;  // minus vertical padding (24 * 2)
      if (padW <= 0 || padH <= 0) return;

      const ratio = canvas.width / canvas.height;
      let dispH = padH;
      let dispW = dispH * ratio;
      if (dispW > padW) {            // landscape overflow: fall back to width
        dispW = padW;
        dispH = dispW / ratio;
      }
      canvas.style.width = Math.floor(dispW) + "px";
      canvas.style.height = Math.floor(dispH) + "px";
    }

    function drawPlaceholder(w, h) {
      const cell = Math.max(24, Math.round(w / 24));

      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(0, 0, w, h);

      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          if (((x / cell) + (y / cell)) % 2 === 0) {
            ctx.fillStyle = "#e2e8f0";
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }

      ctx.fillStyle = "#64748b";
      ctx.font = `700 ${Math.max(28, w * 0.035)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("上传图片后自动预览", w / 2, h / 2);
    }

    function render() {
      updateControlLabels();
      fitCanvasToImage();

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (hasImage) {
        ctx.drawImage(sourceImage, 0, 0, w, h);
      } else {
        drawPlaceholder(w, h);
      }

      const fontFamily = $("fontFamily").value;
      const fontWeight = $("fontWeight").value;
      const fontSize = Math.max(12, w * Number($("fontSizePct").value) / 100);
      const lineHeight = Number($("lineHeight").value);
      const padX = fontSize * Number($("padXPct").value);
      const boxH = fontSize * Number($("boxHeightEm").value);
      const radius = fontSize * Number($("radiusEm").value);
      const maxLineWidth = w * Number($("maxWidthPct").value) / 100 - padX * 2;
      const textColor = $("textColor").value;
      const boxColor = $("boxColor").value;

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const visualLines = [];
      for (const raw of getRawLines()) {
        visualLines.push(...wrapLine(raw, maxLineWidth));
      }

      const step = fontSize * lineHeight;
      const totalH = visualLines.length > 0 ? ((visualLines.length - 1) * step + boxH) : 0;
      const top = Math.max(0, (h - totalH) / 2);
      const measuredLines = visualLines.map(text => {
        const lineW = Math.ceil(ctx.measureText(text).width);
        return {
          text,
          lineW,
          boxW: Math.min(w, lineW + padX * 2)
        };
      });
      const blockW = measuredLines.reduce((max, line) => Math.max(max, line.boxW), 0);
      const blockX = (w - blockW) / 2;

      for (let i = 0; i < measuredLines.length; i++) {
        const { text, boxW } = measuredLines[i];
        const x = blockX;
        const boxY = top + i * step;

        ctx.fillStyle = boxColor;
        if (radius > 0) {
          roundedRectPath(ctx, x, boxY, boxW, boxH, radius);
          ctx.fill();
        } else {
          ctx.fillRect(x, boxY, boxW, boxH);
        }

        ctx.fillStyle = textColor;
        ctx.fillText(text, x + padX, boxY + boxH / 2);
      }

      fitCanvasToView();
    }

    function loadImageFromSrc(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        if (/^https?:\/\//i.test(src)) {
          img.crossOrigin = "anonymous";
        }
        img.onload = () => {
          sourceImage = img;
          hasImage = true;
          render();
          resolve();
        };
        img.onerror = reject;
        img.src = src;
      });
    }

    imageInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => loadImageFromSrc(reader.result).catch(() => alert("图片加载失败，请换一张图片。"));
      reader.readAsDataURL(file);
    });

    function loadAgentImageUrl() {
      const src = agentImageUrl.value.trim();
      if (!src) return;
      if (!/^(https?:\/\/|data:image\/|blob:)/i.test(src)) return;
      loadImageFromSrc(src).catch(() => alert("Agent 图片加载失败，请检查 URL 或 CORS。"));
    }

    agentImageUrl.addEventListener("input", () => {
      window.clearTimeout(agentImageUrl._loadTimer);
      agentImageUrl._loadTimer = window.setTimeout(loadAgentImageUrl, 250);
    });
    agentImageUrl.addEventListener("change", loadAgentImageUrl);
    agentImageUrl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadAgentImageUrl();
    });
    $("agentLoadImageBtn").addEventListener("click", loadAgentImageUrl);

    controls.forEach(id => {
      const el = $(id);
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    memeText.addEventListener("input", () => {
      window.clearTimeout(memeText._renderTimer);
      memeText._renderTimer = window.setTimeout(render, 120);
    });

    $("downloadBtn").addEventListener("click", () => {
      render();

      canvas.toBlob((blob) => {
        if (!blob) {
          alert("导出失败，请重试。");
          return;
        }

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

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meme-${stamp}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, "image/png");
    });

    $("clearImageBtn").addEventListener("click", () => {
      sourceImage = new Image();
      hasImage = false;
      imageInput.value = "";
      agentImageUrl.value = "";
      render();
    });

    const agentPromptBtn = $("agentPromptBtn");
    const agentPromptModal = $("agentPromptModal");
    const agentPromptText = $("agentPromptText");
    const closeAgentPromptBtn = $("closeAgentPromptBtn");
    const copyAgentPromptBtn = $("copyAgentPromptBtn");

    function openAgentPrompt() {
      agentPromptText.value = agentPrompt;
      agentPromptModal.hidden = false;
      copyAgentPromptBtn.textContent = "复制 Prompt";
      window.setTimeout(() => agentPromptText.focus(), 0);
    }

    function closeAgentPrompt() {
      agentPromptModal.hidden = true;
      agentPromptBtn.focus();
    }

    async function copyAgentPrompt() {
      agentPromptText.select();
      try {
        await navigator.clipboard.writeText(agentPrompt);
      } catch (error) {
        document.execCommand("copy");
      }
      copyAgentPromptBtn.textContent = "已复制";
      window.setTimeout(() => {
        copyAgentPromptBtn.textContent = "复制 Prompt";
      }, 1400);
    }

    agentPromptBtn.addEventListener("click", openAgentPrompt);
    closeAgentPromptBtn.addEventListener("click", closeAgentPrompt);
    copyAgentPromptBtn.addEventListener("click", copyAgentPrompt);
    agentPromptModal.addEventListener("click", (event) => {
      if (event.target === agentPromptModal) closeAgentPrompt();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !agentPromptModal.hidden) closeAgentPrompt();
    });

    window.addEventListener("resize", fitCanvasToView);

    render();
