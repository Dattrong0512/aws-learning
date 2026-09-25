function chooseCaptureRect(viewport, fullscreen, candidates) {
  const full = { left: 0, top: 0, width: viewport.width, height: viewport.height };
  if (fullscreen) return full;
  const visible = candidates.map((rect) => {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewport.width, rect.right ?? rect.left + rect.width);
    const bottom = Math.min(viewport.height, rect.bottom ?? rect.top + rect.height);
    return { left, top, width: right - left, height: bottom - top };
  }).filter((rect) => rect.width >= 320 && rect.height >= 180);
  return visible.sort((a, b) => b.width * b.height - a.width * a.height)[0] || full;
}

async function cropScreenshot(dataUrl, rect) {
  const image = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scaleX = image.width / window.innerWidth;
  const scaleY = image.height / window.innerHeight;
  const sx = Math.max(0, Math.round(rect.left * scaleX));
  const sy = Math.max(0, Math.round(rect.top * scaleY));
  const sw = Math.min(image.width - sx, Math.round(rect.width * scaleX));
  const sh = Math.min(image.height - sy, Math.round(rect.height * scaleY));
  if (sx === 0 && sy === 0 && sw === image.width && sh === image.height) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  image.close();
  return canvas.toDataURL("image/png");
}

function showCaptureStatus(text, failed = false) {
  document.getElementById("aws-learning-capture-status")?.remove();
  const status = document.createElement("div");
  status.id = "aws-learning-capture-status";
  status.textContent = text;
  Object.assign(status.style, {
    position: "fixed", right: "18px", bottom: "18px", zIndex: "2147483647",
    padding: "10px 14px", borderRadius: "8px", color: "white",
    background: failed ? "#b42318" : "#067647", font: "600 14px system-ui",
    boxShadow: "0 4px 16px #0005"
  });
  document.documentElement.appendChild(status);
  setTimeout(() => status.remove(), 2200);
}

function isEditable(target) {
  return target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "");
}

if (typeof location !== "undefined" && /(^|\.)udemy\.com$/.test(location.hostname)) {
  document.addEventListener("keydown", async (event) => {
    if (event.code !== "Backquote" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || isEditable(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const videos = [...document.querySelectorAll("video")]
        .filter((video) => video.offsetWidth && video.offsetHeight)
        .map((video) => video.getBoundingClientRect());
      const rect = chooseCaptureRect(
        { width: window.innerWidth, height: window.innerHeight },
        !!document.fullscreenElement,
        videos
      );
      const captured = await chrome.runtime.sendMessage({ type: "aws-learning-capture" });
      if (!captured?.ok) throw new Error(captured?.error || "Không chụp được màn hình");
      const dataUrl = await cropScreenshot(captured.dataUrl, rect);
      const delivered = await chrome.runtime.sendMessage({ type: "aws-learning-deliver", dataUrl });
      if (!delivered?.ok) throw new Error(delivered?.error || "Không gửi được ảnh");
      showCaptureStatus(`✓ Đã lưu vào Nhập ảnh · tổng ${delivered.count} ảnh`);
    } catch (error) {
      showCaptureStatus(`✕ ${error.message}`, true);
    }
  }, true);
}

if (typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "aws-learning-import" || !/^data:image\/png;base64,/.test(message.dataUrl || "")) return;
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => finish({ ok: false, error: "AWS Learning không phản hồi" }), 10000);
    function finish(result) {
      clearTimeout(timeout);
      window.removeEventListener("message", onAdded);
      sendResponse(result);
    }
    function onAdded(event) {
      const data = event.data;
      if (event.source === window && data?.source === "aws-learning-page" && data.type === "capture-added" && data.requestId === requestId) finish(data);
    }
    window.addEventListener("message", onAdded);
    window.postMessage({ source: "aws-learning-capture-extension", type: "capture", requestId, dataUrl: message.dataUrl }, location.origin);
    return true;
  });
}

if (typeof module !== "undefined") module.exports = { chooseCaptureRect };
