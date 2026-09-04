    const $ = (id) => document.getElementById(id);

    const canvas = $("canvas");
    const ctx = canvas.getContext("2d");

    const imageInput = $("imageInput");
    const agentImageUrl = $("agentImageUrl");
    const memeText = $("memeText");
    const agentPrompt = `请安装并使用 https://github.com/cnzhihao/Meme-Generator 里的 \`meme-creator\` Skill，把我的本地图片和文字生成中文梗图 PNG。自由图文模式：图片路径是：\`/path/to/image.jpg\`，文字是：「你的文案」。分镜模板模式：先用 \`setMode("comicTemplate")\`，然后选择 \`setTemplate("performAgain")\` 并设置 \`top\`、\`bottom\`，选择 \`setTemplate("sevenStepPodium")\` 并设置 \`step1\` 到 \`step7\`，或选择 \`setTemplate("goodYoureGreat")\` 并设置 \`top\`、\`middle\`。如果 Skill 尚未安装，请先安装；如果当前会话不能自动加载，就读取该 Skill 的 \`SKILL.md\` 并按流程执行。`;

    const controls = [
      "fontFamily", "fontWeight", "textColor", "boxColor", "fontSizePct", "lineHeight",
      "padXPct", "boxHeightEm", "radiusEm", "maxWidthPct"
    ];

    let sourceImage = new Image();
    let hasImage = false;
    const state = {
      mode: "freeText",
      templateId: "performAgain"
    };

    const comicTemplates = {
      performAgain: {
        label: "你能再表演一下那个吗？",
        src: "assets/template-perform-again.png",
        width: 408,
        height: 550,
        textBoxes: {
          top: { x: 34, y: 358, w: 158, h: 34 },
          bottom: { x: 31, y: 508, w: 160, h: 28 }
        }
      },
      sevenStepPodium: {
        label: "七级领奖台",
        src: "assets/template-seven-step-podium.png",
        width: 800,
        height: 829,
        textBoxes: {
          step1: { x: 34, y: 542, w: 84, h: 275 },
          step2: { x: 142, y: 560, w: 83, h: 257 },
          step3: { x: 249, y: 582, w: 82, h: 235 },
          step4: { x: 355, y: 604, w: 83, h: 213 },
          step5: { x: 462, y: 625, w: 83, h: 192 },
          step6: { x: 570, y: 648, w: 82, h: 169 },
          step7: { x: 676, y: 674, w: 84, h: 143 }
        },
        textOptions: {
          maxFontSize: 32,
          minFontSize: 7,
          lineHeight: 1.12
        }
      },
      goodYoureGreat: {
        label: "好的你真棒",
        src: "assets/template-good-youre-great.png",
        width: 1368,
        height: 1149,
        textBoxes: {
          top: { x: 360, y: 28, w: 600, h: 126 },
          middle: { x: 548, y: 376, w: 322, h: 142 }
        },
        textOptions: {
          maxFontSize: 90,
          minFontSize: 10,
          lineHeight: 1.08
        }
      }
    };

    const templateFields = {
      performAgain: [
        { fieldId: "top", inputId: "performAgainTopText", boxId: "top" },
        { fieldId: "bottom", inputId: "performAgainBottomText", boxId: "bottom" }
      ],
      sevenStepPodium: [
        { fieldId: "step1", inputId: "sevenStep1Text", boxId: "step1" },
        { fieldId: "step2", inputId: "sevenStep2Text", boxId: "step2" },
        { fieldId: "step3", inputId: "sevenStep3Text", boxId: "step3" },
        { fieldId: "step4", inputId: "sevenStep4Text", boxId: "step4" },
        { fieldId: "step5", inputId: "sevenStep5Text", boxId: "step5" },
        { fieldId: "step6", inputId: "sevenStep6Text", boxId: "step6" },
        { fieldId: "step7", inputId: "sevenStep7Text", boxId: "step7" }
      ],
      goodYoureGreat: [
        { fieldId: "top", inputId: "goodYoureGreatTopText", boxId: "top" },
        { fieldId: "middle", inputId: "goodYoureGreatMiddleText", boxId: "middle" }
      ]
    };

    const templateImages = {};
    Object.entries(comicTemplates).forEach(([id, template]) => {
      const img = new Image();
      img.onload = render;
      img.src = template.src;
      templateImages[id] = img;
    });

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
      if (state.mode === "comicTemplate") {
        const template = comicTemplates[state.templateId];
        const img = templateImages[state.templateId];
        canvas.width = (img && img.naturalWidth) || template.width;
        canvas.height = (img && img.naturalHeight) || template.height;
      } else if (hasImage && sourceImage.naturalWidth && sourceImage.naturalHeight) {
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
      if (state.mode === "comicTemplate") {
        renderComicTemplate();
      } else {
        renderFreeText();
      }
    }

    function renderFreeText() {
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

    function wrapTextForBox(text, maxWidth) {
      const lines = [];
      const rawLines = String(text || "")
        .replace(/\r\n/g, "\n")
        .split("\n");

      for (const rawLine of rawLines) {
        const source = rawLine.trim();
        if (!source) {
          lines.push("");
          continue;
        }

        let current = "";
        for (const ch of Array.from(source)) {
          const test = current + ch;
          if (ctx.measureText(test).width <= maxWidth || current.length === 0) {
            current = test;
          } else {
            lines.push(current);
            current = ch;
          }
        }
        if (current) lines.push(current);
      }

      return lines;
    }

    function fitTextBoxLines(text, box, options) {
      const {
        family,
        weight,
        maxFontSize,
        minFontSize,
        lineHeight
      } = options;
      const safeText = String(text || "").trim();
      const horizontalPad = Math.max(2, box.w * 0.04);
      const verticalPad = Math.max(2, box.h * 0.08);
      const maxWidth = Math.max(1, box.w - horizontalPad * 2);
      const maxHeight = Math.max(1, box.h - verticalPad * 2);

      for (let size = maxFontSize; size >= minFontSize; size -= 0.5) {
        ctx.font = `${weight} ${size}px ${family}`;
        const lines = wrapTextForBox(safeText, maxWidth);
        const totalHeight = lines.length * size * lineHeight;
        const widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
        if (widest <= maxWidth && totalHeight <= maxHeight) {
          return { lines, size, lineHeight, horizontalPad, verticalPad };
        }
      }

      ctx.font = `${weight} ${minFontSize}px ${family}`;
      return {
        lines: wrapTextForBox(safeText, maxWidth),
        size: minFontSize,
        lineHeight,
        horizontalPad,
        verticalPad
      };
    }

    function drawFittedTextBox(text, box, options = {}) {
      const fontFamily = $("fontFamily").value;
      const fontWeight = $("fontWeight").value;
      const fitted = fitTextBoxLines(text, box, {
        family: fontFamily,
        weight: fontWeight,
        maxFontSize: Math.min(options.maxFontSize || 17, box.h * 0.62),
        minFontSize: options.minFontSize || 2,
        lineHeight: options.lineHeight || 1.12
      });
      const textColor = $("textColor").value;
      const lineStep = fitted.size * fitted.lineHeight;
      const totalHeight = fitted.lines.length * lineStep;
      const startY = box.y + box.h / 2 - totalHeight / 2 + lineStep / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.font = `${fontWeight} ${fitted.size}px ${fontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 0; i < fitted.lines.length; i++) {
        ctx.fillText(fitted.lines[i], box.x + box.w / 2, startY + i * lineStep);
      }
      ctx.restore();
    }

    function renderComicTemplate() {
      updateControlLabels();
      fitCanvasToImage();

      const w = canvas.width;
      const h = canvas.height;
      const template = comicTemplates[state.templateId];
      const templateImage = templateImages[state.templateId];

      ctx.clearRect(0, 0, w, h);
      if (templateImage && templateImage.complete && templateImage.naturalWidth) {
        ctx.drawImage(templateImage, 0, 0, w, h);
      } else {
        drawPlaceholder(w, h);
      }

      (templateFields[state.templateId] || []).forEach(({ inputId, boxId }) => {
        drawFittedTextBox($(inputId).value, template.textBoxes[boxId], template.textOptions);
      });

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

    function syncModePanels() {
      const isComicTemplate = state.mode === "comicTemplate";
      $("freeTextAssetPanel").hidden = isComicTemplate;
      $("freeTextCopyPanel").hidden = isComicTemplate;
      $("comicTemplateAssetPanel").hidden = !isComicTemplate;
      $("comicTemplateCopyPanel").hidden = !isComicTemplate;
      $("performAgainCopyFields").hidden = state.templateId !== "performAgain";
      $("sevenStepCopyFields").hidden = state.templateId !== "sevenStepPodium";
      $("goodYoureGreatCopyFields").hidden = state.templateId !== "goodYoureGreat";
      $("modeFreeText").checked = !isComicTemplate;
      $("modeComicTemplate").checked = isComicTemplate;
    }

    function setMode(mode) {
      state.mode = mode === "comicTemplate" ? "comicTemplate" : "freeText";
      syncModePanels();
      render();
      return { mode: state.mode };
    }

    function setTemplate(templateId) {
      if (!comicTemplates[templateId]) {
        throw new Error(`Unknown comic template: ${templateId}`);
      }
      state.templateId = templateId;
      const input = document.querySelector(`input[name="comicTemplate"][value="${templateId}"]`);
      if (input) input.checked = true;
      syncModePanels();
      render();
      return { templateId: state.templateId };
    }

    document.querySelectorAll('input[name="memeMode"]').forEach(input => {
      input.addEventListener("change", () => setMode(input.value));
    });

    document.querySelectorAll('input[name="comicTemplate"]').forEach(input => {
      input.addEventListener("change", () => setTemplate(input.value));
    });

    Object.values(templateFields).flat().forEach(({ inputId: id }) => {
      const el = $(id);
      el.addEventListener("input", () => {
        window.clearTimeout(el._renderTimer);
        el._renderTimer = window.setTimeout(render, 80);
      });
    });

    controls.forEach(id => {
      const el = $(id);
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });

    memeText.addEventListener("input", () => {
      window.clearTimeout(memeText._renderTimer);
      memeText._renderTimer = window.setTimeout(render, 120);
    });

    function getCanvasBlob() {
      render();
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas export failed"));
          }
        }, "image/png");
      });
    }

    $("copyImageBtn").addEventListener("click", async () => {
      const copyBtn = $("copyImageBtn");
      const originalText = copyBtn.lastChild.textContent;

      try {
        if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
          throw new Error("Clipboard image copy is not supported");
        }
        const blob = await getCanvasBlob();
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        copyBtn.lastChild.textContent = "已复制";
        window.setTimeout(() => {
          copyBtn.lastChild.textContent = originalText;
        }, 1400);
      } catch (error) {
        alert("复制图片失败。请在 HTTPS 或 localhost 页面使用，并确认浏览器允许访问剪切板。");
      }
    });

    $("downloadBtn").addEventListener("click", async () => {
      try {
        const blob = await getCanvasBlob();
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
      } catch (error) {
        alert("导出失败，请重试。");
      }
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

    window.memeGenerator = {
      setMode(mode) {
        return setMode(mode);
      },
      setTemplate(templateId) {
        return setTemplate(templateId);
      },
      setTemplateField(fieldId, value) {
        const field = (templateFields[state.templateId] || []).find(item => (
          item.fieldId === fieldId || item.inputId === fieldId
        ));
        if (!field) {
          throw new Error(`Unknown template field: ${fieldId}`);
        }
        $(field.inputId).value = String(value || "");
        render();
        return {
          fieldId,
          length: $(field.inputId).value.length
        };
      },
      setTemplateBox(boxId, patch) {
        const template = comicTemplates[state.templateId];
        const box = template && template.textBoxes && template.textBoxes[boxId];
        if (!box) {
          throw new Error(`Unknown template text box: ${boxId}`);
        }
        ["x", "y", "w", "h"].forEach(key => {
          if (patch && patch[key] !== undefined) {
            const value = Number(patch[key]);
            if (!Number.isFinite(value)) {
              throw new Error(`Template box ${key} must be a number`);
            }
            box[key] = value;
          }
        });
        render();
        return { boxId, box: { ...box } };
      },
      getTemplateBoxes() {
        const template = comicTemplates[state.templateId];
        return JSON.parse(JSON.stringify(template.textBoxes));
      },
      async loadImageDataUrl(dataUrl) {
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          throw new Error("loadImageDataUrl expects a data:image URL");
        }
        agentImageUrl.value = dataUrl;
        await loadImageFromSrc(dataUrl);
        return {
          width: canvas.width,
          height: canvas.height
        };
      },
      setText(text) {
        memeText.value = String(text || "");
        render();
        return {
          length: memeText.value.length
        };
      },
      exportPng() {
        render();
        const dataUrl = canvas.toDataURL("image/png");
        const comma = dataUrl.indexOf(",");
        return {
          base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
          width: canvas.width,
          height: canvas.height
        };
      },
      getState() {
        return {
          width: canvas.width,
          height: canvas.height,
          mode: state.mode,
          templateId: state.templateId,
          hasImage,
          textLength: memeText.value.length,
          templateFields: Object.fromEntries((templateFields[state.templateId] || []).map(({ fieldId, inputId }) => [
            fieldId,
            $(inputId).value
          ]))
        };
      }
    };

    syncModePanels();
    render();
