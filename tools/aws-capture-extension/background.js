const STUDY_URL = "http://localhost:8788";
const STUDY_MATCHES = ["http://localhost:8788/*", "http://127.0.0.1:8788/*"];

const waitForTab = async (tabId, nextLoad = false) => {
  if (!nextLoad && (await chrome.tabs.get(tabId)).status === "complete") return;
  return new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    reject(new Error("AWS Learning không tải xong"));
  }, 10000);
  function onUpdated(id, info) {
    if (id !== tabId || info.status !== "complete") return;
    clearTimeout(timeout);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    resolve();
  }
  chrome.tabs.onUpdated.addListener(onUpdated);
  });
};

async function deliverCapture(dataUrl) {
  let [tab] = await chrome.tabs.query({ url: STUDY_MATCHES });
  if (!tab) {
    tab = await chrome.tabs.create({ url: STUDY_URL, active: false });
    await waitForTab(tab.id);
  }
  let reloaded = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: "aws-learning-import", dataUrl });
    } catch {}
    if (result?.ok) return result;
    if (result) throw new Error(result.error || "AWS Learning không lưu được ảnh");
    if (!reloaded) {
      reloaded = true;
      const loaded = waitForTab(tab.id, true);
      await chrome.tabs.reload(tab.id);
      await loaded;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Không gửi được ảnh sang AWS Learning");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "aws-learning-capture") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" })
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "aws-learning-deliver") {
    deliverCapture(message.dataUrl)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
