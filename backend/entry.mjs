import {
  dispatch,
  emptyState,
  normalizeCode,
  MUTATIONS,
  fail,
  active,
} from "../src/core.mjs";
import { compareSync } from "bcryptjs";
const props = () => PropertiesService.getScriptProperties();
const cache = () => CacheService.getScriptCache();
function hash(s) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    s,
    Utilities.Charset.UTF_8,
  )
    .map((n) => (n & 255).toString(16).padStart(2, "0"))
    .join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function sign(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(
      s,
      props().getProperty("SESSION_SECRET"),
    ),
  ).replace(/=+$/, "");
}
function issue(data, seconds) {
  const expiresAt = Date.now() + seconds * 1000;
  const body = Utilities.base64EncodeWebSafe(
    JSON.stringify({
      ...data,
      expiresAt,
      epoch: props().getProperty("AUTH_EPOCH"),
    }),
    Utilities.Charset.UTF_8,
  ).replace(/=+$/, "");
  return { token: body + "." + sign(body), expiresAt };
}
function verify(token, s) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!safeEqual(sign(body), sig)) throw 0;
    const claims = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString(),
    );
    if (
      claims.expiresAt < Date.now() ||
      claims.epoch !== props().getProperty("AUTH_EPOCH")
    )
      throw 0;
    if (
      claims.role === "participant" &&
      !s.people.some(
        (p) =>
          p.id === claims.personId &&
          p.active &&
          p.codeHash === claims.codeHash,
      )
    )
      throw 0;
    return claims;
  } catch {
    fail(
      "AUTH",
      "Phiên đã hết hạn hoặc mã đã được thu hồi. Vui lòng đăng nhập lại.",
    );
  }
}
function cacheState(key, state) {
  try {
    const encoded = Utilities.base64Encode(
      Utilities.gzip(Utilities.newBlob(JSON.stringify(state))).getBytes(),
    );
    if (encoded.length < 90000) cache().put(key, encoded, 600);
    else {
      const count = Math.ceil(encoded.length / 90000);
      if (count > 20) return;
      for (let i = 0; i < count; i++)
        cache().put(
          key + ":" + i,
          encoded.slice(i * 90000, (i + 1) * 90000),
          600,
        );
      // Publish the manifest only after all pieces are present.
      cache().put(key, JSON.stringify({ chunks: count }), 600);
    }
  } catch (error) {
    /* Cache is optional; the committed Sheet is authoritative. */
    try {
      props().setProperty(
        "CACHE_DIAGNOSTIC",
        String(error.message).slice(0, 500),
      );
    } catch {}
  }
}
function cachedState(key) {
  let encoded = cache().get(key);
  if (!encoded) return null;
  if (encoded.startsWith("{")) {
    const count = JSON.parse(encoded).chunks;
    if (!Number.isInteger(count) || count < 1 || count > 20) return null;
    const chunks = [];
    for (let i = 0; i < count; i++) {
      const chunk = cache().get(key + ":" + i);
      if (!chunk) return null;
      chunks.push(chunk);
    }
    encoded = chunks.join("");
  }
  return JSON.parse(
    Utilities.ungzip(
      Utilities.newBlob(
        Utilities.base64Decode(encoded),
        "application/x-gzip",
        "state.json.gz",
      ),
    ).getDataAsString(),
  );
}
function readState() {
  const sheetId = props().getProperty("SHEET_ID");
  if (!sheetId) fail("UNINITIALIZED", "Sự kiện chưa được khởi tạo.");
  const key = props().getProperty("STATE_CACHE_KEY") || "state:initial";
  try {
    const cached = cachedState(key);
    if (cached) return cached;
  } catch (error) {
    /* Missing/evicted/corrupt cache falls back to the Sheet. */
    try {
      props().setProperty(
        "CACHE_DIAGNOSTIC",
        "decode: " + String(error.message).slice(0, 450),
      );
    } catch {}
  }
  const values =
    Sheets.Spreadsheets.Values.get(sheetId, "'Data'!A:B").values || [];
  if (!values.length) return emptyState();
  const s = emptyState();
  for (const row of values) {
    if (row.length < 2) continue;
    const [kind, json] = row;
    const value = JSON.parse(json);
    if (kind === "meta") {
      s.version = value.version;
      s.settings = value.settings;
    } else if (
      ["people", "wishes", "receipts", "assignments", "audit"].includes(kind)
    )
      s[kind].push(value);
  }
  cacheState(key, s);
  return s;
}
function writeState(s) {
  const rows = [
    ["meta", JSON.stringify({ version: s.version, settings: s.settings })],
  ];
  for (const kind of ["people", "wishes", "receipts", "assignments", "audit"])
    for (const value of s[kind]) rows.push([kind, JSON.stringify(value)]);
  const total = Math.max(
    rows.length,
    Number(props().getProperty("ROW_COUNT") || 0),
  );
  const sid = Number(props().getProperty("DATA_TAB_ID"));
  const requests = [];
  const grid = Number(props().getProperty("GRID_ROWS") || 1000);
  if (total > grid)
    requests.push({
      appendDimension: {
        sheetId: sid,
        dimension: "ROWS",
        length: total - grid,
      },
    });
  requests.push({
    updateCells: {
      range: {
        sheetId: sid,
        startRowIndex: 0,
        startColumnIndex: 0,
        endColumnIndex: 2,
      },
      rows: rows.map((r) => ({
        values: r.map((v) => ({ userEnteredValue: { stringValue: v } })),
      })),
      fields: "userEnteredValue",
    },
  });
  Sheets.Spreadsheets.batchUpdate(
    { requests },
    props().getProperty("SHEET_ID"),
  );
  const stateKey = "state:" + Utilities.getUuid();
  // Warm the complete committed snapshot before readers can discover its key.
  cacheState(stateKey, s);
  props().setProperties({
    ROW_COUNT: String(rows.length),
    GRID_ROWS: String(Math.max(grid, total)),
    STATE_CACHE_KEY: stateKey,
  });
  cache().remove("wall");
}
function limited(key, max) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) fail("BUSY", "Hệ thống đang bận, vui lòng thử lại.");
  try {
    const k = "RATE_" + key;
    // Use a fast, best-effort global counter for high-entropy participant codes;
    // preserve durable rate limiting for the moderator's password.
    const transient = key === "LOGIN";
    const raw = JSON.parse(
        (transient ? cache().get(k) : props().getProperty(k)) || "null",
      ),
      now = Date.now();
    const value =
      raw && now < raw.until ? raw : { count: 0, until: now + 60000 };
    if (value.count >= max)
      fail("RATE", "Bạn đã thử nhiều lần. Vui lòng chờ một phút.");
    value.count++;
    if (transient) cache().put(k, JSON.stringify(value), 60);
    else props().setProperty(k, JSON.stringify(value));
  } finally {
    lock.releaseLock();
  }
}
function validateImage(data) {
  if (typeof data !== "string" || data.length > 210000)
    fail("IMAGE", "Ảnh nén tối đa 150KB.");
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    data,
  );
  if (!match) fail("IMAGE", "Chỉ nhận ảnh JPG, PNG hoặc WebP.");
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 150 * 1024) fail("IMAGE", "Ảnh nén tối đa 150KB.");
  const u = bytes.map((n) => n & 255);
  const valid =
    match[1] === "jpeg"
      ? u[0] === 255 && u[1] === 216 && u[2] === 255
      : match[1] === "png"
        ? u[0] === 137 && u[1] === 80 && u[2] === 78 && u[3] === 71
        : u[0] === 82 &&
          u[1] === 73 &&
          u[2] === 70 &&
          u[3] === 70 &&
          u[8] === 87 &&
          u[9] === 69 &&
          u[10] === 66 &&
          u[11] === 80;
  if (!valid) fail("IMAGE", "Nội dung tệp ảnh không hợp lệ.");
  return Utilities.newBlob(bytes, "image/" + match[1], "portrait." + match[1]);
}
function trash(fileId) {
  if (fileId && !fileId.startsWith("assets/"))
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch {
      /* Committed records remain authoritative; cleanup can be retried by owner. */
    }
}
function owner() {
  if (
    Session.getActiveUser().getEmail() !==
      Session.getEffectiveUser().getEmail() ||
    !Session.getActiveUser().getEmail()
  )
    fail("FORBIDDEN", "Chỉ chủ tài khoản được chạy thao tác này.");
}
export function bootstrap(config) {
  owner();
  if (
    !config ||
    !/^[a-f0-9]{64}$/.test(config.secret) ||
    !/^\$2[aby]\$/.test(config.verifier)
  )
    fail("CONFIG", "Cấu hình khởi tạo không hợp lệ.");
  const p = props();
  if (p.getProperty("SHEET_ID"))
    return { initialized: true, sheetId: p.getProperty("SHEET_ID") };
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  let tab = spreadsheet.getSheetByName("Data");
  if (!tab) tab = spreadsheet.insertSheet("Data");
  const folder = DriveApp.createFolder("Những điều tốt đẹp — Ảnh riêng");
  p.setProperties({
    SHEET_ID: config.sheetId,
    DATA_TAB_ID: String(tab.getSheetId()),
    GRID_ROWS: String(tab.getMaxRows()),
    FOLDER_ID: folder.getId(),
    MOD_VERIFIER: config.verifier,
    SESSION_SECRET: config.secret,
    AUTH_EPOCH: String(Date.now()),
  });
  writeState(emptyState());
  return {
    initialized: true,
    sheetId: config.sheetId,
    folderId: folder.getId(),
  };
}
export function changePassword(verifier) {
  owner();
  if (!/^\$2[aby]\$/.test(verifier)) fail("CONFIG", "Verifier không hợp lệ.");
  props().setProperties({
    MOD_VERIFIER: verifier,
    AUTH_EPOCH: String(Date.now()),
  });
  return { ok: true };
}
export function ownerInfo() {
  owner();
  const encodedState = cache().get(
    props().getProperty("STATE_CACHE_KEY") || "state:initial",
  );
  let stateCacheReadable = false,
    stateCacheError = "";
  if (encodedState) {
    try {
      stateCacheReadable = !!cachedState(
        props().getProperty("STATE_CACHE_KEY") || "state:initial",
      );
    } catch (error) {
      stateCacheError = String(error.message).slice(0, 500);
    }
  }
  return {
    sheetId: props().getProperty("SHEET_ID"),
    folderId: props().getProperty("FOLDER_ID"),
    lastError: props().getProperty("LAST_ERROR"),
    cacheDiagnostic: props().getProperty("CACHE_DIAGNOSTIC"),
    stateCacheReadable,
    stateCacheError,
    stateCachePresent: !!cache().get(
      props().getProperty("STATE_CACHE_KEY") || "state:initial",
    ),
  };
}
export function handle(req) {
  const { action, payload = {}, token = "" } = req || {};
  if (typeof action !== "string") fail("VALIDATION", "Yêu cầu không hợp lệ.");
  if (action === "health")
    return {
      schema: 1,
      title: "Những điều tốt đẹp",
      initialized: !!props().getProperty("SHEET_ID"),
    };
  if (action === "wall" && !payload.offset) {
    const cached = cache().get("wall");
    if (cached) {
      const c = JSON.parse(cached);
      if (!c.expiresAt || Date.now() < Date.parse(c.expiresAt)) return c.result;
      fail("EXPIRED", "Sự kiện đã kết thúc thời gian truy cập.");
    }
  }
  if (action === "modLogin") {
    limited("MOD", 8);
    const password = payload.password;
    if (
      typeof password !== "string" ||
      password.length > 200 ||
      !compareSync(password, props().getProperty("MOD_VERIFIER") || "")
    )
      fail("AUTH", "Mật khẩu chưa đúng.");
    return issue({ role: "mod" }, 3600);
  }
  let s = readState();
  if (action === "login") {
    active(s, Date.now());
    const code = normalizeCode(payload.code);
    if (code.length < 20 || code.length > 80)
      fail("AUTH", "Mã cá nhân chưa đúng.");
    limited("LOGIN", 400);
    const codeHash = hash(code),
      p = s.people.find((p) => p.active && p.codeHash === codeHash);
    if (!p) fail("AUTH", "Mã cá nhân chưa đúng. Vui lòng kiểm tra lại.");
    return issue({ role: "participant", personId: p.id, codeHash }, 43200);
  }
  if (action === "wall") {
    const result = dispatch(s, action, payload, {});
    if (!payload.offset) {
      const serialized = JSON.stringify({
        result,
        expiresAt: s.settings.expiresAt,
      });
      if (serialized.length < 85000) cache().put("wall", serialized, 10);
    }
    return result;
  }
  const ctx = { ...verify(token, s), id: () => Utilities.getUuid() };
  if (ctx.role === "participant") active(s, Date.now());
  if (action === "getPhoto") {
    if (ctx.role !== "mod")
      dispatch(s, "photo", { personId: payload.personId }, ctx);
    const p = s.people.find((p) => p.id === payload.personId && p.active);
    if (!p) fail("NOT_FOUND", "Không có người này.");
    if (!p.photo) return "";
    const blob = DriveApp.getFileById(p.photo).getBlob();
    return (
      "data:" +
      blob.getContentType() +
      ";base64," +
      Utilities.base64Encode(blob.getBytes())
    );
  }
  let createdFile = "",
    oldFiles = [];
  let actualPayload = { ...payload };
  if (action === "setPhoto") {
    const p = s.people.find((p) => p.id === payload.personId && p.active);
    if (!p || (ctx.role !== "mod" && ctx.personId !== p.id))
      fail("FORBIDDEN", "Không được thay ảnh của người khác.");
    if (payload.photo) {
      const blob = validateImage(payload.photo);
      createdFile = DriveApp.getFolderById(props().getProperty("FOLDER_ID"))
        .createFile(blob)
        .getId();
    }
    actualPayload.photo = createdFile;
  }
  if (!MUTATIONS.has(action)) return dispatch(s, action, actualPayload, ctx);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    trash(createdFile);
    fail("BUSY", "Có nhiều lời chúc đang được gửi. Vui lòng chờ một chút.");
  }
  let result,
    committed = false;
  try {
    s = readState();
    const fresh = { ...verify(token, s), id: ctx.id };
    if (action === "setPhoto") {
      const p = s.people.find((p) => p.id === payload.personId);
      if (p?.photo) oldFiles.push(p.photo);
    }
    if (action === "cleanDemo" || action === "reset") {
      if (fresh.role !== "mod") fail("FORBIDDEN", "Cần quyền quản trị.");
      oldFiles = s.people
        .filter((p) => action === "reset" || p.isDemo)
        .map((p) => p.photo)
        .filter(Boolean);
    }
    result = dispatch(s, action, actualPayload, fresh);
    writeState(s);
    committed = true;
  } finally {
    lock.releaseLock();
    if (!committed) trash(createdFile);
  }
  oldFiles.forEach(trash);
  return result;
}
export function doPost(e) {
  try {
    if (!e?.postData || e.postData.contents.length > 300000)
      fail("VALIDATION", "Yêu cầu quá lớn hoặc không hợp lệ.");
    return json({ ok: true, data: handle(JSON.parse(e.postData.contents)) });
  } catch (err) {
    if (!err.code) {
      try {
        props().setProperty(
          "LAST_ERROR",
          JSON.stringify({
            at: new Date().toISOString(),
            message: String(err.message).slice(0, 700),
          }),
        );
      } catch {}
    }
    // Quota contention is retryable; never include provider diagnostics in public JSON.
    if (
      !err.code &&
      /quota|too many|rate limit|service invoked too many|service (?:is )?(?:currently |temporarily )?unavailable|internal error|backend error|timed? out|timeout|network failure|service error/i.test(
        String(err.message),
      )
    ) {
      err.code = "BUSY";
      err.message =
        "Có nhiều truy cập cùng lúc. Vui lòng chờ một chút rồi thử lại.";
    }
    return json({
      ok: false,
      error: {
        code: err.code || "SERVER",
        message: err.code
          ? err.message
          : "Chưa thể kết nối với sự kiện. Vui lòng thử lại sau.",
      },
    });
  }
}
export function doGet() {
  return json({ ok: true, data: { title: "Những điều tốt đẹp", schema: 1 } });
}
function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
