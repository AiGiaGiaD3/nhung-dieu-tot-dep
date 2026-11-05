import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs/promises";
import { createHash, createHmac, randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { build } from "esbuild";
import { gzipSync, gunzipSync } from "node:zlib";
const bundle = await build({
  entryPoints: ["backend/entry.mjs"],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  globalName: "B",
  alias: { crypto: "./scripts/crypto-stub.mjs" },
  target: "es2020",
  inject: ["scripts/gas-timers.mjs"],
});
function mock() {
  let cells = [],
    failure = false,
    locked = false,
    reads = 0;
  const p = new Map(),
    c = new Map(),
    files = new Map();
  const property = {
    getProperty: (k) => p.get(k) || null,
    setProperty: (k, v) => p.set(k, v),
    setProperties: (o) => Object.entries(o).forEach(([k, v]) => p.set(k, v)),
  };
  const signed = (b) => Array.from(b, (n) => (n > 127 ? n - 256 : n));
  const blob = (bytes, type = "text/plain") => ({
    getDataAsString: () => Buffer.from(bytes).toString(),
    getBytes: () => bytes,
    getContentType: () => type,
  });
  const sandbox = {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (content) => ({
        setMimeType: () => ({ getContent: () => content }),
      }),
    },
    console,
    Date,
    Math,
    JSON,
    Uint8Array,
    Int32Array,
    Error,
    TextEncoder,

    PropertiesService: { getScriptProperties: () => property },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => c.get(k),
        put: (k, v) => c.set(k, v),
        remove: (k) => c.delete(k),
      }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => "owner@example.test" }),
      getEffectiveUser: () => ({ getEmail: () => "owner@example.test" }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (_, s) => signed(createHash("sha256").update(s).digest()),
      computeHmacSha256Signature: (s, k) =>
        signed(createHmac("sha256", k).update(s).digest()),
      base64EncodeWebSafe: (v) =>
        Buffer.from(typeof v === "string" ? v : Uint8Array.from(v)).toString(
          "base64url",
        ),
      base64DecodeWebSafe: (v) => [...Buffer.from(v, "base64url")],
      base64Decode: (v) => [...Buffer.from(v, "base64")],
      base64Encode: (v) => Buffer.from(v).toString("base64"),
      newBlob: blob,
      gzip: (b) =>
        blob([...gzipSync(Buffer.from(b.getBytes()))], "application/x-gzip"),
      ungzip: (b) => {
        assert.equal(
          b.getContentType(),
          "application/x-gzip",
          "Apps Script requires gzip blob metadata",
        );
        return blob([...gunzipSync(Buffer.from(b.getBytes()))]);
      },
      getUuid: randomUUID,
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => ({ getSheetId: () => 1, getMaxRows: () => 1000 }),
      }),
    },
    DriveApp: {
      createFolder: () => ({ getId: () => "folder" }),
      getFolderById: () => ({
        createFile: (b) => {
          const id = randomUUID();
          files.set(id, { blob: b, trashed: false });
          return { getId: () => id };
        },
      }),
      getFileById: (id) => ({
        setTrashed: (v) => (files.get(id).trashed = v),
        getBlob: () => files.get(id).blob,
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }),
    },
    Sheets: {
      Spreadsheets: {
        Values: {
          get: () => {
            reads++;
            return { values: cells };
          },
        },
        batchUpdate: (body) => {
          if (failure)
            throw new Error(
              typeof failure === "string" ? failure : "network failure",
            );
          cells = body.requests
            .at(-1)
            .updateCells.rows.map((r) =>
              r.values.map((v) => v.userEnteredValue.stringValue),
            );
        },
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(bundle.outputFiles[0].text, sandbox);
  sandbox.B.bootstrap({
    sheetId: "sheet",
    secret: "a".repeat(64),
    verifier: bcrypt.hashSync("correct-password", 4),
  });
  const call = (action, payload = {}, token = "") =>
    sandbox.B.handle({ action, payload, token });
  return {
    call,
    post: (action, payload = {}, token = "") =>
      JSON.parse(
        sandbox.B.doPost({
          postData: { contents: JSON.stringify({ action, payload, token }) },
        }).getContent(),
      ),
    files,
    fail: (v) => (failure = v),
    lock: (v) => (locked = v),
    properties: p,
    cache: c,
    reads: () => reads,
  };
}
test("real backend auth, one atomic write, signed sessions and forgery rejection", () => {
  const m = mock();
  assert.throws(() => m.call("modLogin", { password: "wrong" }));
  const mod = m.call("modLogin", { password: "correct-password" }).token;
  const code = "ABCDEFGHJKLMNPQRSTUVWXYZ234";
  const codeHash = createHash("sha256").update(code).digest("hex");
  m.call(
    "import",
    {
      people: [
        { employee: "N1", name: "Người Một", codeHash },
        { employee: "N2", name: "Người Hai", codeHash: "b".repeat(64) },
      ],
    },
    mod,
  );
  m.call("pair", {}, mod);
  m.call("settings", { open: true }, mod);
  const auth = m.call("login", { code }).token;
  assert.throws(() => m.call("admin", {}, auth));
  assert.throws(() => m.call("me", {}, auth + "bad"));
  const me = m.call("me", {}, auth);
  const request = {
    requestId: "test-id",
    kind: "main",
    recipientId: me.recipient.id,
    round: me.round,
    text: "Một điều đẹp",
    anonymous: true,
  };
  m.fail(true);
  assert.throws(() => m.call("send", request, auth));
  m.fail(false);
  assert.equal(m.call("wall").total, 0);
  m.call("send", request, auth);
  m.call("send", request, auth);
  const wall = m.call("wall");
  assert.equal(wall.total, 1);
  assert.equal(wall.wishes[0].senderName, "Một người đồng nghiệp");
  assert(!("senderId" in wall.wishes[0]));
  m.call("moderate", { id: wall.wishes[0].id, operation: "hide" }, mod);
  assert.equal(m.call("wall").total, 0);
  m.call(
    "rotateCode",
    { personId: me.person.id, codeHash: "c".repeat(64) },
    mod,
  );
  assert.throws(() => m.call("me", {}, auth));
});

test("state cache reduces Sheet reads and revocation invalidates cached sessions", () => {
  const m = mock();
  const mod = m.call("modLogin", { password: "correct-password" }).token;
  const code = "ABCDEFGHJKLMNPQRSTUVWXYZ234";
  const people = m.call(
    "import",
    {
      people: [
        {
          employee: "C1",
          name: "Người mẫu",
          codeHash: createHash("sha256").update(code).digest("hex"),
        },
      ],
    },
    mod,
  );
  const t = m.call("login", { code }).token;
  const reads = m.reads();
  for (let i = 0; i < 100; i++) m.call("me", {}, t);
  assert.equal(m.reads(), reads);
  const oldKey = m.properties.get("STATE_CACHE_KEY");
  m.call(
    "rotateCode",
    { personId: people[0].id, codeHash: "c".repeat(64) },
    mod,
  );
  assert.notEqual(m.properties.get("STATE_CACHE_KEY"), oldKey);
  assert.throws(() => m.call("me", {}, t));
  m.cache.clear();
  assert.equal(m.call("admin", {}, mod).people.length, 1);
  assert.equal(m.reads(), reads + 1);
});
test("photo validation, failed write cleanup, authorization, lock busy", () => {
  const m = mock();
  const mod = m.call("modLogin", { password: "correct-password" }).token;
  m.call(
    "import",
    { people: [{ employee: "N1", name: "Ảnh", codeHash: "b".repeat(64) }] },
    mod,
  );
  const p = m.call("admin", {}, mod).people[0];
  assert.throws(() =>
    m.call(
      "setPhoto",
      { personId: p.id, photo: "data:image/svg+xml;base64,PHN2Zz4=" },
      mod,
    ),
  );
  assert.throws(() =>
    m.call(
      "setPhoto",
      { personId: p.id, photo: "data:image/jpeg;base64,YWJj" },
      mod,
    ),
  );
  const photo = "data:image/jpeg;base64,/9j/AA==";
  m.fail(true);
  assert.throws(() => m.call("setPhoto", { personId: p.id, photo }, mod));
  assert([...m.files.values()].every((f) => f.trashed));
  m.fail(false);
  m.call("setPhoto", { personId: p.id, photo }, mod);
  assert.equal(m.call("getPhoto", { personId: p.id }, mod), photo);
  m.lock(true);
  assert.throws(
    () => m.call("settings", { open: false }, mod),
    /nhiều lời chúc/,
  );
});
test("bootstrap not reachable through public dispatcher; password failures rate limited", () => {
  const m = mock();
  assert.throws(() => m.call("bootstrap", { secret: "x" }));
  for (let i = 0; i < 8; i++)
    assert.throws(() => m.call("modLogin", { password: "bad" }));
  assert.throws(
    () => m.call("modLogin", { password: "correct-password" }),
    /một phút/,
  );
});

test("temporary Sheets failure retries with the same wish id without duplicates", () => {
  const m = mock();
  const token = m.call("modLogin", { password: "correct-password" }).token;
  const code = "ABCDEFGHJKLMNPQRSTUVWXYZ234";
  m.call(
    "import",
    {
      people: [
        {
          employee: "R1",
          name: "Người Một",
          codeHash: createHash("sha256").update(code).digest("hex"),
        },
        { employee: "R2", name: "Người Hai", codeHash: "b".repeat(64) },
      ],
    },
    token,
  );
  m.call("pair", {}, token);
  m.call("settings", { open: true }, token);
  const person = m.call("login", { code }).token;
  const me = m.call("me", {}, person);
  const request = {
    requestId: "transient-retry",
    kind: "main",
    round: me.round,
    recipientId: me.recipient.id,
    text: "Một lời chúc được lưu đúng một lần",
    anonymous: false,
  };
  m.fail("The service is currently unavailable.");
  const failed = m.post("send", request, person);
  assert.equal(failed.error.code, "BUSY");
  assert(!failed.error.message.includes("service"));
  m.fail(false);
  const sent = m.post("send", request, person);
  const replay = m.post("send", request, person);
  assert.equal(sent.ok, true);
  assert.equal(replay.data.id, sent.data.id);
  assert.equal(m.call("wall").total, 1);
});

test("large committed state uses cache pieces and recovers a missing piece from Sheet", () => {
  const m = mock();
  const mod = m.call("modLogin", { password: "correct-password" }).token;
  const people = Array.from({ length: 500 }, (_, i) => ({
    employee: `BIG${i}`,
    name: randomBytes(50).toString("hex"),
    department: randomBytes(50).toString("hex"),
    codeHash: randomBytes(32).toString("hex"),
  }));
  m.call("import", { people }, mod);
  const key = m.properties.get("STATE_CACHE_KEY");
  const manifest = JSON.parse(m.cache.get(key));
  assert(manifest.chunks >= 2);
  for (let i = 0; i < manifest.chunks; i++)
    assert(m.cache.get(key + ":" + i).length <= 90000);
  const reads = m.reads();
  assert.equal(m.call("admin", {}, mod).people.length, 500);
  assert.equal(m.reads(), reads);
  m.cache.delete(key + ":0");
  assert.equal(m.call("admin", {}, mod).people[499].name, people[499].name);
  assert.equal(m.reads(), reads + 1);
  assert(m.cache.get(key + ":0"));
});
