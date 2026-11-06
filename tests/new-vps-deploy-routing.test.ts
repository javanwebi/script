import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fs.readFileSync("ops/deploy-new-vps.sh", "utf8");

function embeddedPython(anchor: string): string {
  const at = script.indexOf(anchor);
  assert.notEqual(at, -1, \`missing script anchor: \${anchor}\`);
  const open = script.indexOf("<<'PY'\n", at);
  assert.notEqual(open, -1, "missing Python heredoc");
  const start = open + "<<'PY'\n".length;
  const end = script.indexOf("\nPY", start);
  assert.notEqual(end, -1, "unterminated Python heredoc");
  return script.slice(start, end);
}

function fixture(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sanatpish-nginx-"));
  const paths = Object.entries(files).map(([name, content]) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, content);
    return file;
  });
  return { dir, paths };
}

function runPython(code: string, args: string[]) {
  return spawnSync("python3", ["-c", code, ...args], { encoding: "utf8" });
}

const repeated3012 = \`
location / { proxy_pass http://127.0.0.1:3012; }
location = /api/runtime { proxy_pass http://127.0.0.1:3012; }
location ^~ /api/ai/ { proxy_pass http://127.0.0.1:3012; }
location /supabase/ { proxy_pass http://127.0.0.1:8000; }
\`;

test("active upstream detection accepts repeated app routes when every route shares one port", () => {
  const code = embeddedPython('ACTIVE=$(python3 - "$SSL"');
  const f = fixture({ "https.conf": repeated3012, "http.conf": repeated3012, "ip.conf": repeated3012 });
  try {
    const result = runPython(code, f.paths);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "3012");
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("active upstream detection rejects mixed app ports before deployment", () => {
  const code = embeddedPython('ACTIVE=$(python3 - "$SSL"');
  const f = fixture({
    "https.conf": repeated3012,
    "http.conf": repeated3012.replace("3012; }\nlocation ^~", "3011; }\nlocation ^~"),
    "ip.conf": repeated3012
  });
  try {
    const result = runPython(code, f.paths);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MIXED_UPSTREAMS/);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("Nginx switch updates every app location but leaves non-app upstreams untouched", () => {
  const code = embeddedPython('python3 - "$ACTIVE" "$NEXT"');
  const f = fixture({ "https.conf": repeated3012, "http.conf": repeated3012, "ip.conf": repeated3012 });
  try {
    const result = runPython(code, ["3012", "3013", ...f.paths]);
    assert.equal(result.status, 0, result.stderr);
    for (const file of f.paths) {
      const content = fs.readFileSync(file, "utf8");
      assert.equal((content.match(/127\.0\.0\.1:3013;/g) || []).length, 3);
      assert.match(content, /127\.0\.0\.1:8000;/);
      assert.doesNotMatch(content, /127\.0\.0\.1:3012;/);
    }
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});

test("Nginx switch rejects mixed routes before writing any vhost", () => {
  const code = embeddedPython('python3 - "$ACTIVE" "$NEXT"');
  const f = fixture({
    "https.conf": repeated3012,
    "http.conf": repeated3012.replace("3012; }\nlocation ^~", "3011; }\nlocation ^~"),
    "ip.conf": repeated3012
  });
  try {
    const before = f.paths.map(file => fs.readFileSync(file, "utf8"));
    const result = runPython(code, ["3012", "3013", ...f.paths]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /NGINX_PRECONDITION_CHANGED/);
    assert.deepEqual(f.paths.map(file => fs.readFileSync(file, "utf8")), before);
  } finally {
    fs.rmSync(f.dir, { recursive: true, force: true });
  }
});
