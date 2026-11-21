import assert from "node:assert/strict";

const origin = "http://127.0.0.1:3000";
const timeout = ms => AbortSignal.timeout(ms);

async function json(path, maxMs = 12000) {
  const response = await fetch(origin + path, { signal: timeout(maxMs), cache: "no-store" });
  const type = response.headers.get("content-type") || "";
  assert.ok(response.ok, `FORZA_CANARY_HTTP_${response.status}: ${path}`);
  assert.ok(type.toLowerCase().includes("application/json"), `FORZA_CANARY_NON_JSON: ${path}: ${type}`);
  return response.json();
}

async function waitFor(label, path, predicate, maxMs = 120000) {
  const deadline = Date.now() + maxMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await json(path, 12000);
      if (predicate(last)) {
        console.log(label + "_READY");
        return last;
      }
    } catch (error) {
      last = { error: String(error?.message || error).slice(0, 120) };
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error(label + "_NOT_READY " + JSON.stringify(last));
}

const health = await json("/api/health");
assert.equal(health.status, "ok", "FORZA_CANARY_APP_HEALTH_FAILED");
assert.equal(health.database, "ok", "FORZA_CANARY_DATABASE_CONNECTIVITY_FAILED");
if (process.env.SANATPISH_RELEASE_SHA) {
  assert.equal(health.revision, process.env.SANATPISH_RELEASE_SHA, "FORZA_CANARY_WRONG_RELEASE_REVISION");
}
console.log("FORZA_CANARY_APP_HEALTH_OK revision=" + String(health.revision || "unknown"));

const stt = await waitFor(
  "FORZA_DIBA_STT",
  "/api/ai/forza-stt-info",
  value => value.serverSttConfigured === true &&
    value.serverSttProvider === "diba" &&
    value.serverSttReady === true
);
assert.equal(stt.reason, "configured", "FORZA_DIBA_STT_CONFIGURATION_REASON_UNEXPECTED");

const voice = await waitFor(
  "FORZA_PRIVATE_NIMA",
  "/api/ai/forza-voice-info",
  value => value.ready === true &&
    value.voice === "piper-nima-gyro-medium" &&
    value.incrementalSpeech === true,
  90000
);

const privateHealthResponse = await fetch("http://forza-voice:8080/health", {
  signal: timeout(8000),
  cache: "no-store",
});
assert.ok(privateHealthResponse.ok, "FORZA_PRIVATE_NIMA_HEALTH_HTTP_FAILED");
const privateHealth = await privateHealthResponse.json();
assert.equal(privateHealth.voice, "piper-nima-gyro-medium", "FORZA_PRIVATE_NIMA_WRONG_VOICE");

const browserModel = await fetch(origin + "/forza-runtime/stt/diba-stt-fa-small-c244182d.tar.gz", {
  method: "HEAD",
  signal: timeout(15000),
});
assert.ok(browserModel.ok, "FORZA_DIBA_BROWSER_MODEL_MISSING");
const modelBytes = Number(browserModel.headers.get("content-length") || 0);
assert.ok(modelBytes > 50_000_000, "FORZA_DIBA_BROWSER_MODEL_SIZE_INVALID: " + modelBytes);

const voskScript = await fetch(origin + "/forza-runtime/stt/vosk.js", {
  method: "HEAD",
  signal: timeout(15000),
});
assert.ok(voskScript.ok, "FORZA_VOSK_BROWSER_RUNTIME_MISSING");
const voskBytes = Number(voskScript.headers.get("content-length") || 0);
assert.ok(voskBytes > 1_000_000, "FORZA_VOSK_BROWSER_RUNTIME_SIZE_INVALID: " + voskBytes);
console.log("FORZA_BROWSER_DIBA_ASSETS_OK modelBytes=" + modelBytes + " voskBytes=" + voskBytes);

// Two sequential private TTS turns deliberately exercise the reported
// "first reply works, second reply is silent" failure without calling the LLM.
// Audio remains in process memory and is never written to disk.
for (let index = 1; index <= 2; index += 1) {
  const response = await fetch(origin + "/api/ai/forza-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "audio/wav" },
    body: JSON.stringify({
      text: index === 1 ? "سلام، صدای فورزا را بررسی کن." : "بله، بفرما.",
      turnId: "forza-deploy-canary-" + Date.now() + "-" + index,
    }),
    signal: timeout(75000),
    cache: "no-store",
  });
  assert.ok(response.ok, "FORZA_TTS_TURN_" + index + "_HTTP_" + response.status);
  assert.ok((response.headers.get("content-type") || "").toLowerCase().includes("audio/wav"),
    "FORZA_TTS_TURN_" + index + "_BAD_CONTENT_TYPE");
  assert.equal(response.headers.get("x-forza-voice"), "piper-nima-gyro-medium",
    "FORZA_TTS_TURN_" + index + "_WRONG_VOICE");
  const wav = Buffer.from(await response.arrayBuffer());
  assert.ok(wav.length > 44 && wav.toString("ascii", 0, 4) === "RIFF" &&
    wav.toString("ascii", 8, 12) === "WAVE", "FORZA_TTS_TURN_" + index + "_INVALID_WAV");
  console.log("FORZA_TTS_SEQUENTIAL_TURN_OK index=" + index + " bytes=" + wav.length);
}

console.log("FORZA_ONLY_CANARY_OK stt=diba voice=" + voice.voice +
  " incrementalSpeech=" + voice.incrementalSpeech +
  " databaseWrites=0 llmRequests=0 audioFiles=0");
