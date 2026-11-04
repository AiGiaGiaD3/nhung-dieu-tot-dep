export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
export function fail(code, message) {
  throw new AppError(code, message);
}
export const MAX_TEXT = 500;
export const normalize = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export const normalizeCode = (s) =>
  String(s ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
export function emptyState() {
  return {
    version: 1,
    people: [],
    assignments: [],
    wishes: [],
    receipts: [],
    audit: [],
    settings: {
      title: "Những điều tốt đẹp",
      open: false,
      extraLimit: 2,
      opensAt: "",
      closesAt: "",
      expiresAt: "",
      round: 0,
    },
  };
}
export function pairing(ids, random = Math.random) {
  if (ids.length < 2) fail("SMALL", "Cần ít nhất 2 người để ghép.");
  if (new Set(ids).size !== ids.length)
    fail("DUPLICATE", "Danh sách có người trùng.");
  let shuffled;
  do {
    shuffled = [...ids];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  } while (shuffled.some((id, i) => id === ids[i]));
  return ids.map((sender, i) => ({ sender, recipient: shuffled[i] }));
}
export function parsePeople(tsv) {
  const lines = String(tsv).trim().split(/\r?\n/);
  const rows = [];
  const errors = [];
  const codes = new Set();
  lines.forEach((line, i) => {
    const parts = line.split("\t").map((x) => x.trim());
    if (i === 0 && /ma nhan vien|employee/i.test(normalize(parts[0]))) return;
    const [employee, name, department = ""] = parts;
    if (!employee || !name)
      errors.push(`Dòng ${i + 1}: cần mã nhân viên và họ tên.`);
    else if (
      employee.length > 40 ||
      name.length > 100 ||
      department.length > 100
    )
      errors.push(`Dòng ${i + 1}: dữ liệu quá dài.`);
    else if (codes.has(employee.toUpperCase()))
      errors.push(`Dòng ${i + 1}: trùng mã ${employee}.`);
    else {
      codes.add(employee.toUpperCase());
      rows.push({ employee: employee.toUpperCase(), name, department });
    }
  });
  if (rows.length > 500) errors.push("Mỗi lần nhập tối đa 500 người.");
  return { rows, errors };
}
export function matchPhoto(filename, people) {
  const stem = normalize(filename.replace(/\.[^.]+$/, ""));
  const exact = people.filter((p) => normalize(p.employee) === stem);
  return exact.length
    ? exact
    : people.filter((p) => normalize(p.name) === stem);
}
export function publicPerson(p) {
  return p
    ? {
        id: p.id,
        name: p.name,
        department: p.department,
        photo: p.photo || "",
        photoVersion: p.photoVersion || 0,
      }
    : null;
}
export function publicWish(w, s, mod = false) {
  const to = s.people.find((p) => p.id === w.recipient),
    from = s.people.find((p) => p.id === w.sender);
  const result = {
    id: w.id,
    recipientName: to?.name || "Đồng nghiệp",
    text: w.text,
    anonymous: w.anonymous,
    senderName: w.anonymous
      ? "Một người đồng nghiệp"
      : from?.name || "Đồng nghiệp",
    createdAt: w.createdAt,
  };
  return mod
    ? {
        ...result,
        senderId: w.sender,
        recipientId: w.recipient,
        actualSender: from?.name || "",
        hidden: w.hidden,
        kind: w.kind,
      }
    : result;
}
export function gate(s, now = Date.now()) {
  const a = s.settings;
  return (
    a.open &&
    (!a.opensAt || now >= Date.parse(a.opensAt)) &&
    (!a.closesAt || now < Date.parse(a.closesAt))
  );
}
export function active(s, now) {
  if (s.settings.expiresAt && now >= Date.parse(s.settings.expiresAt))
    fail(
      "EXPIRED",
      "Sự kiện đã kết thúc thời gian truy cập. Cảm ơn bạn đã cùng sẻ chia.",
    );
}
function person(s, id) {
  const p = s.people.find((x) => x.id === id && x.active);
  if (!p)
    fail(
      "AUTH",
      "Mã của bạn không còn hiệu lực. Vui lòng liên hệ ban tổ chức.",
    );
  return p;
}
function textField(value, max, label) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    [...value.trim()].length > max
  )
    fail("VALIDATION", `${label} cần từ 1 đến ${max} ký tự.`);
  return value.trim();
}
export const MUTATIONS = new Set([
  "send",
  "import",
  "pair",
  "settings",
  "moderate",
  "updatePerson",
  "removePerson",
  "rotateCode",
  "setPhoto",
  "seed",
  "cleanDemo",
  "reset",
]);
export function dispatch(s, action, payload = {}, ctx = {}) {
  s.receipts ||= [];
  const now = ctx.now ?? Date.now(),
    id = ctx.id || (() => String(now)),
    isMod = ctx.role === "mod";
  const d = payload || {};
  if (action === "health") return { schema: 1, title: s.settings.title };
  if (action === "wall") {
    active(s, now);
    const offset = Math.max(0, Number(d.offset) || 0),
      all = s.wishes.filter((w) => !w.hidden);
    return {
      version: s.version,
      total: all.length,
      wishes: all
        .slice()
        .reverse()
        .slice(offset, offset + 100)
        .map((w) => publicWish(w, s)),
      title: s.settings.title,
      open: gate(s, now),
    };
  }
  if (
    action === "me" ||
    action === "inbox" ||
    action === "directory" ||
    action === "send" ||
    action === "photo"
  ) {
    active(s, now);
    const me = person(s, ctx.personId);
    if (action === "me") {
      const assigned = s.assignments.find((a) => a.sender === me.id);
      return {
        person: publicPerson(me),
        recipient: publicPerson(
          s.people.find((p) => p.id === assigned?.recipient),
        ),
        round: s.settings.round,
        open: gate(s, now),
        extraLimit: s.settings.extraLimit,
        extraUsed: s.receipts.filter(
          (w) => w.sender === me.id && w.kind === "extra",
        ).length,
        sent: s.receipts.some(
          (w) =>
            w.sender === me.id &&
            w.kind === "main" &&
            w.round === s.settings.round,
        ),
      };
    }
    if (action === "inbox")
      return s.wishes
        .filter((w) => w.recipient === me.id)
        .slice()
        .reverse()
        .map((w) => publicWish(w, s));
    if (action === "directory")
      return s.people
        .filter((p) => p.active && p.id !== me.id)
        .map(publicPerson);
    if (action === "photo") return publicPerson(person(s, d.personId));
    if (action === "send") {
      const requestId = textField(d.requestId, 100, "Mã yêu cầu");
      const previous = s.wishes.find(
        (w) => w.requestId === requestId && w.sender === me.id,
      );
      if (previous) return publicWish(previous, s);
      if (
        s.receipts.some((r) => r.requestId === requestId && r.sender === me.id)
      )
        fail("DELETED", "Lời chúc đã gửi trước đó đã được ban tổ chức gỡ.");
      if (!gate(s, now))
        fail(
          "CLOSED",
          "Cổng gửi đang đóng. Bạn vẫn có thể đọc và lưu lời chúc.",
        );
      const text = textField(d.text, MAX_TEXT, "Lời chúc");
      if (typeof d.anonymous !== "boolean")
        fail("VALIDATION", "Vui lòng chọn cách ghi tên.");
      const kind =
        d.kind === "main"
          ? "main"
          : d.kind === "extra"
            ? "extra"
            : fail("VALIDATION", "Loại lời chúc không hợp lệ.");
      const recipient = person(s, d.recipientId);
      if (recipient.id === me.id)
        fail("SELF", "Hãy gửi lời chúc tới một đồng nghiệp khác.");
      if (kind === "main") {
        if (
          d.round !== s.settings.round ||
          !s.assignments.some(
            (a) => a.sender === me.id && a.recipient === recipient.id,
          )
        )
          fail(
            "PAIR_CHANGED",
            "Người được ghép đã thay đổi. Vui lòng mở lại phong thư.",
          );
        if (
          s.receipts.some(
            (w) =>
              w.sender === me.id &&
              w.kind === "main" &&
              w.round === s.settings.round,
          )
        )
          fail("ALREADY", "Bạn đã gửi lời chúc chính rồi.");
      } else {
        if (
          s.assignments.some(
            (a) => a.sender === me.id && a.recipient === recipient.id,
          )
        )
          fail(
            "MAIN_REQUIRED",
            "Đây là người được ghép chính. Hãy gửi qua phong thư của bạn.",
          );
        const extras = s.receipts.filter(
          (w) => w.sender === me.id && w.kind === "extra",
        );
        if (extras.length >= s.settings.extraLimit)
          fail("LIMIT", "Bạn đã dùng hết lượt gửi thêm.");
        if (extras.some((w) => w.recipient === recipient.id))
          fail("ALREADY", "Bạn đã gửi thêm cho đồng nghiệp này rồi.");
      }
      const wish = {
        id: id(),
        requestId,
        sender: me.id,
        recipient: recipient.id,
        text,
        anonymous: d.anonymous,
        kind,
        round: s.settings.round,
        hidden: false,
        createdAt: new Date(now).toISOString(),
        isDemo: !!me.isDemo,
      };
      s.wishes.push(wish);
      s.receipts.push({
        requestId,
        sender: me.id,
        recipient: recipient.id,
        kind,
        round: s.settings.round,
        isDemo: !!me.isDemo,
      });
      s.version++;
      return publicWish(wish, s);
    }
  }
  if (!isMod && action === "setPhoto") {
    const me = person(s, ctx.personId);
    if (d.personId !== me.id)
      fail("FORBIDDEN", "Bạn chỉ được thay ảnh của mình.");
  } else if (!isMod)
    fail("FORBIDDEN", "Phiên quản trị không hợp lệ hoặc đã hết hạn.");
  const audit = () => {
    s.version++;
    s.audit.push({
      action,
      target: d.id || d.personId || "",
      at: new Date(now).toISOString(),
    });
    s.audit = s.audit.slice(-2000);
  };
  if (action === "admin")
    return {
      ...s,
      people: s.people.map(({ codeHash, ...p }) => p),
      wishes: s.wishes.map((w) => publicWish(w, s, true)),
    };
  if (action === "import") {
    if (s.settings.open || s.assignments.length)
      fail(
        "PAIRED",
        "Đóng cổng và kết thúc vòng ghép trước khi thay danh sách.",
      );
    if (!Array.isArray(d.people) || !d.people.length || d.people.length > 500)
      fail("VALIDATION", "Danh sách không hợp lệ.");
    const used = new Set(s.people.map((p) => p.employee));
    const added = d.people.map((p) => {
      const employee = textField(p.employee, 40, "Mã nhân viên").toUpperCase();
      if (used.has(employee)) fail("DUPLICATE", `Trùng mã ${employee}.`);
      used.add(employee);
      if (!/^[a-f0-9]{64}$/.test(p.codeHash))
        fail("VALIDATION", "Mã truy cập không hợp lệ.");
      return {
        id: id(),
        employee,
        name: textField(p.name, 100, "Họ tên"),
        department: String(p.department || "").slice(0, 100),
        codeHash: p.codeHash,
        active: true,
        photo: "",
        isDemo: !!d.isDemo,
      };
    });
    s.people.push(...added);
    audit();
    return added.map(({ codeHash, ...p }) => p);
  }
  if (action === "pair") {
    if (s.settings.open) fail("OPEN", "Hãy đóng cổng trước khi ghép.");
    if (
      s.receipts.some(
        (w) => w.kind === "main" && w.round === s.settings.round,
      ) &&
      d.confirm !== "KẾT THÚC VÒNG CŨ"
    )
      fail(
        "HAS_WISHES",
        "Đã có lời chúc chính. Cần xác nhận kết thúc vòng cũ. Thư cũ vẫn giữ đúng người nhận.",
      );
    s.settings.round++;
    s.assignments = pairing(
      s.people.filter((p) => p.active).map((p) => p.id),
      ctx.random,
    );
    audit();
    return s.assignments;
  }
  if (action === "settings") {
    const next = { ...s.settings };
    if ("open" in d) next.open = !!d.open;
    if ("extraLimit" in d) {
      if (
        !Number.isInteger(d.extraLimit) ||
        d.extraLimit < 0 ||
        d.extraLimit > 20
      )
        fail("VALIDATION", "Số lời thêm phải từ 0 đến 20.");
      next.extraLimit = d.extraLimit;
    }
    for (const k of ["opensAt", "closesAt", "expiresAt"])
      if (k in d) {
        if (d[k] && !Number.isFinite(Date.parse(d[k])))
          fail("VALIDATION", "Ngày giờ không hợp lệ.");
        next[k] = d[k];
      }
    if (
      next.opensAt &&
      next.closesAt &&
      Date.parse(next.opensAt) >= Date.parse(next.closesAt)
    )
      fail("VALIDATION", "Giờ đóng phải sau giờ mở.");
    if (
      next.closesAt &&
      next.expiresAt &&
      Date.parse(next.expiresAt) < Date.parse(next.closesAt)
    )
      fail("VALIDATION", "Ngày kết thúc truy cập phải sau giờ đóng cổng.");
    if (
      next.open &&
      (!s.assignments.length ||
        s.assignments.length !== s.people.filter((p) => p.active).length)
    )
      fail("UNPAIRED", "Cần ghép đủ người trước khi mở cổng.");
    s.settings = next;
    audit();
    return next;
  }
  if (action === "moderate") {
    const w = s.wishes.find((w) => w.id === d.id);
    if (!w) fail("NOT_FOUND", "Lời chúc không còn tồn tại.");
    if (d.operation === "delete")
      s.wishes = s.wishes.filter((w) => w.id !== d.id);
    else if (["hide", "show"].includes(d.operation))
      w.hidden = d.operation === "hide";
    else fail("VALIDATION", "Thao tác không hợp lệ.");
    audit();
    return { ok: true };
  }
  if (action === "updatePerson") {
    const p = person(s, d.personId);
    p.name = textField(d.name, 100, "Họ tên");
    p.department = String(d.department || "").slice(0, 100);
    audit();
    return publicPerson(p);
  }
  if (action === "removePerson") {
    if (s.settings.open) fail("OPEN", "Hãy đóng cổng trước.");
    if (
      s.assignments.some(
        (a) => a.sender === d.personId || a.recipient === d.personId,
      ) ||
      s.wishes.some(
        (w) => w.sender === d.personId || w.recipient === d.personId,
      )
    )
      fail(
        "REFERENCED",
        "Người này đã thuộc vòng ghép hoặc có lời chúc. Không xoá để giữ nguyên thư đã gửi.",
      );
    s.people = s.people.filter((p) => p.id !== d.personId);
    audit();
    return { ok: true };
  }
  if (action === "rotateCode") {
    const p = person(s, d.personId);
    if (!/^[a-f0-9]{64}$/.test(d.codeHash))
      fail("VALIDATION", "Mã không hợp lệ.");
    p.codeHash = d.codeHash;
    audit();
    return { ok: true };
  }
  if (action === "setPhoto") {
    const p = person(s, d.personId);
    p.photo = String(d.photo || "");
    p.photoVersion = (p.photoVersion || 0) + 1;
    audit();
    return publicPerson(p);
  }
  if (action === "cleanDemo") {
    const ids = new Set(s.people.filter((p) => p.isDemo).map((p) => p.id));
    s.wishes = s.wishes.filter(
      (w) => !w.isDemo && !ids.has(w.sender) && !ids.has(w.recipient),
    );
    s.receipts = s.receipts.filter(
      (w) => !w.isDemo && !ids.has(w.sender) && !ids.has(w.recipient),
    );
    s.assignments = s.assignments.filter(
      (a) => !ids.has(a.sender) && !ids.has(a.recipient),
    );
    s.people = s.people.filter((p) => !p.isDemo);
    s.settings.open = false;
    audit();
    return { removed: ids.size };
  }
  if (action === "reset") {
    if (d.confirm !== "XOÁ TOÀN BỘ")
      fail("CONFIRM", "Nhập XOÁ TOÀN BỘ để xác nhận.");
    const fresh = emptyState();
    Object.keys(fresh).forEach((k) => (s[k] = fresh[k]));
    return { ok: true };
  }
  fail("UNKNOWN", "Thao tác không được hỗ trợ.");
}
