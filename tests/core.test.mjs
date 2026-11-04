import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import {
  emptyState,
  dispatch,
  pairing,
  parsePeople,
  matchPhoto,
  publicWish,
} from "../src/core.mjs";
const mod = { role: "mod", id: randomUUID };
const hash = (s) => createHash("sha256").update(s).digest("hex");
function fixture(n = 10) {
  const s = emptyState();
  dispatch(
    s,
    "import",
    {
      people: Array.from({ length: n }, (_, i) => ({
        employee: `NV${i}`,
        name: `Người ${i}`,
        codeHash: hash(String(i)),
      })),
    },
    mod,
  );
  dispatch(s, "pair", {}, mod);
  dispatch(s, "settings", { open: true }, mod);
  return s;
}
function send(s, i = 0, overrides = {}) {
  const a = s.assignments[i];
  return dispatch(
    s,
    "send",
    {
      recipientId: a.recipient,
      text: "Cảm ơn bạn!",
      anonymous: false,
      kind: "main",
      round: s.settings.round,
      requestId: randomUUID(),
      ...overrides,
    },
    { personId: a.sender, id: randomUUID },
  );
}
test("pairing is bijective, has no fixed point for even and odd lists", () => {
  for (const n of [2, 3, 10, 100, 300])
    for (let r = 0; r < 100; r++) {
      const ids = Array.from({ length: n }, (_, i) => String(i));
      const a = pairing(ids);
      assert.equal(new Set(a.map((x) => x.recipient)).size, n);
      assert(a.every((x) => x.sender !== x.recipient));
    }
  assert.throws(() => pairing(["a"]));
  assert.throws(() => pairing(["a", "a"]));
});
test("TSV import reports duplicate and missing values; ambiguous photo is not chosen", () => {
  const p = parsePeople(
    "Mã nhân viên\tHọ tên\tĐơn vị\nNV1\tNguyễn An\tĐào tạo\nNV1\tKhác\nNV2",
  );
  assert.equal(p.rows.length, 1);
  assert.equal(p.errors.length, 2);
  const people = [
    { employee: "NV1", name: "Nguyễn An" },
    { employee: "NV2", name: "Nguyễn An" },
  ];
  assert.equal(matchPhoto("Nguyen An.jpg", people).length, 2);
  assert.equal(matchPhoto("NV1.png", people).length, 1);
});
test("retry uses original committed wish, even after gate closes", () => {
  const s = fixture();
  const key = randomUUID(),
    one = send(s, 0, { requestId: key });
  dispatch(s, "settings", { open: false }, mod);
  const two = send(s, 0, { requestId: key });
  assert.equal(one.id, two.id);
  assert.equal(s.wishes.length, 1);
  assert.throws(() => send(s, 1), /đóng/);
});
test("authorization: inbox belongs to caller; forged recipient fails; mod-only protected", () => {
  const s = fixture();
  send(s);
  const a = s.assignments[0];
  assert.equal(
    dispatch(s, "inbox", { personId: a.recipient }, { personId: a.sender })
      .length,
    0,
  );
  assert.equal(dispatch(s, "inbox", {}, { personId: a.recipient }).length, 1);
  assert.throws(() => dispatch(s, "admin", {}, { personId: a.sender }));
  assert.throws(() => send(s, 1, { recipientId: s.assignments[1].sender }));
  assert.throws(() => send(s, 1, { round: 99 }));
});
test("anonymous payload exposes no author; mod sees attribution", () => {
  const s = fixture();
  send(s, 0, { anonymous: true });
  const publicData = dispatch(s, "wall").wishes[0];
  assert.equal(publicData.senderName, "Một người đồng nghiệp");
  for (const k of [
    "senderId",
    "sender",
    "actualSender",
    "employee",
    "codeHash",
  ])
    assert(!Object.hasOwn(publicData, k));
  assert.equal(
    dispatch(s, "admin", {}, mod).wishes[0].senderId,
    s.assignments[0].sender,
  );
  assert(!("codeHash" in dispatch(s, "admin", {}, mod).people[0]));
});
test("extra limits, duplicate extra recipient, main recipient cannot bypass main", () => {
  const s = fixture();
  const sender = s.people[0].id,
    main = s.assignments[0].recipient;
  const others = s.people.filter((p) => p.id !== sender && p.id !== main);
  const data = {
    kind: "extra",
    anonymous: false,
    text: "Chúc bạn vui",
    round: s.settings.round,
  };
  const ctx = { personId: sender, id: randomUUID };
  for (let i = 0; i < 2; i++)
    dispatch(
      s,
      "send",
      { ...data, recipientId: others[i].id, requestId: randomUUID() },
      ctx,
    );
  assert.throws(
    () =>
      dispatch(
        s,
        "send",
        { ...data, recipientId: others[2].id, requestId: randomUUID() },
        ctx,
      ),
    /hết lượt/,
  );
  assert.throws(
    () =>
      dispatch(
        s,
        "send",
        { ...data, recipientId: main, requestId: randomUUID() },
        ctx,
      ),
    /chính/,
  );
});
test("hide preserves inbox; delete removes inbox; cache version changes", () => {
  const s = fixture();
  const w = send(s);
  const v = s.version;
  dispatch(s, "moderate", { id: w.id, operation: "hide" }, mod);
  assert(s.version > v);
  assert.equal(dispatch(s, "wall").wishes.length, 0);
  assert.equal(
    dispatch(s, "inbox", {}, { personId: s.assignments[0].recipient }).length,
    1,
  );
  dispatch(s, "moderate", { id: w.id, operation: "show" }, mod);
  assert.equal(dispatch(s, "wall").wishes.length, 1);
  dispatch(s, "moderate", { id: w.id, operation: "delete" }, mod);
  assert.equal(
    dispatch(s, "inbox", {}, { personId: s.assignments[0].recipient }).length,
    0,
  );
});
test("re-pair needs closed gate and explicit old-round confirmation", () => {
  const s = fixture();
  send(s);
  assert.throws(() => dispatch(s, "pair", {}, mod), /đóng/);
  dispatch(s, "settings", { open: false }, mod);
  assert.throws(() => dispatch(s, "pair", {}, mod), /kết thúc vòng cũ/);
  const old = s.wishes[0].recipient;
  dispatch(s, "pair", { confirm: "KẾT THÚC VÒNG CŨ" }, mod);
  assert.equal(s.wishes[0].recipient, old);
});
test("expiration and invalid content are enforced server-side", () => {
  const s = fixture();
  assert.throws(() => send(s, 0, { text: " " }));
  assert.throws(() => send(s, 0, { text: "x".repeat(501) }));
  assert.throws(() => send(s, 0, { anonymous: "true" }));
  dispatch(s, "settings", { expiresAt: "2000-01-01T00:00:00Z" }, mod);
  assert.throws(() => dispatch(s, "wall"), /kết thúc/);
  assert.throws(() => send(s), /kết thúc/);
});
test("participant cannot overwrite another portrait; reset needs exact phrase", () => {
  const s = fixture();
  assert.throws(() =>
    dispatch(
      s,
      "setPhoto",
      { personId: s.people[1].id, photo: "x" },
      { personId: s.people[0].id },
    ),
  );
  assert.throws(() => dispatch(s, "reset", {}, mod));
});
test("sample cleanup preserves real participant and real wishes", () => {
  const s = fixture();
  s.people[0].isDemo = true;
  send(s, 0);
  dispatch(s, "cleanDemo", {}, mod);
  assert.equal(s.people.length, 9);
  assert.equal(s.wishes.length, 0);
  assert.equal(s.settings.open, false);
});
test("deletion does not restore sending quota or resurrect an idempotent request", () => {
  const s = fixture();
  const requestId = randomUUID(),
    w = send(s, 0, { requestId });
  dispatch(s, "moderate", { id: w.id, operation: "delete" }, mod);
  assert.throws(() => send(s, 0, { requestId }), /đã được ban tổ chức gỡ/);
  assert.throws(() => send(s, 0), /đã gửi lời chúc chính/);
  assert.equal(s.receipts.length, 1);
  assert.equal(s.wishes.length, 0);
  assert(!("text" in s.receipts[0]));
});
