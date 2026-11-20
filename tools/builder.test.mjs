import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("Codex import uses a working CLI model and preserves Vietnamese prompts", async () => {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const child = spawn(process.execPath, [fileURLToPath(new URL("builder.mjs", import.meta.url))], {
    env: { ...process.env, BUILDER_PORT: String(port), BUILDER_DRYRUN: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let inbox;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Builder did not start")), 5000);
      child.stdout.on("data", chunk => {
        if (chunk.toString().includes("listening on")) { clearTimeout(timeout); resolve(); }
      });
      child.once("error", error => { clearTimeout(timeout); reject(error); });
    });
    const url = `http://127.0.0.1:${port}`;
    const health = await (await fetch(`${url}/health`)).json();
    const result = await (await fetch(`${url}/build`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "Nội dung thử", sectionHash: `builder-regression-${process.pid}`,
        isNew: true, images: ["data:image/png;base64,aGVsbG8="] }),
    })).json();
    assert.equal(result.ok, true);
    inbox = result.inbox;
    const script = readFileSync(`${inbox}/run.ps1`, "utf8");
    assert.equal(health.model, "gpt-5.5");
    assert.match(script, /codex .*exec --model gpt-5\.5 /);
    assert.match(script, /model_reasoning_effort=.*high/);
    assert.match(script, /\$OutputEncoding = \[Console\]::OutputEncoding = .*UTF8Encoding/);
    assert.match(script, /Get-Content -Raw -Encoding UTF8 -LiteralPath/);
    assert.match(script, /--image '[^']+01\.png'/);
    assert.match(script, /Copy-Item -Path.*content\.before/);
    assert.match(script, /node tools\/build-site\.mjs/);
    assert.doesNotMatch(script, /Invoke-RestMethod|\/api\/content/);
    assert.match(readFileSync(`${inbox}/prompt.md`, "utf8"), /content\/vi\/builder-regression-/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    if (inbox) {
      const expected = fileURLToPath(new URL(`inbox/builder-regression-${process.pid}-`, import.meta.url));
      assert.ok(inbox.startsWith(expected), "only remove this test's inbox");
      rmSync(inbox, { recursive: true, force: true });
    }
  }
});
