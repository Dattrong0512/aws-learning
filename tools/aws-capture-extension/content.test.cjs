const assert = require("node:assert/strict");
const { chooseCaptureRect } = require("./content.js");

const viewport = { width: 1900, height: 1000 };
assert.deepEqual(
  chooseCaptureRect(viewport, false, [{ left: 188, top: 176, width: 1296, height: 622 }]),
  { left: 188, top: 176, width: 1296, height: 622 }
);
assert.deepEqual(chooseCaptureRect(viewport, true, []), { left: 0, top: 0, width: 1900, height: 1000 });
assert.deepEqual(chooseCaptureRect(viewport, false, []), { left: 0, top: 0, width: 1900, height: 1000 });
console.log("AWS capture frame checks passed");
