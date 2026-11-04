import { dispatch, emptyState, normalizeCode } from "./core.mjs";
import { hash, makeCode } from "./security";
const KEY = "ndtd-demo-v1";
export const demoNames = [
  "Nguyễn Minh Anh",
  "Trần Đức Huy",
  "Lê Thu Hà",
  "Phạm Hoàng Nam",
  "Võ Ngọc Mai",
  "Đặng Quốc Bảo",
  "Bùi Khánh Linh",
  "Đỗ Tuấn Kiệt",
  "Ngô Thanh Trúc",
  "Hồ Bích Ngọc",
];
export const demoCode = (i: number) => `DEMO-${String(i + 1).padStart(2, "0")}`;
export async function seed() {
  const s = emptyState() as any;
  s.settings.open = true;
  s.settings.round = 1;
  for (let i = 0; i < 10; i++)
    s.people.push({
      id: `p${i + 1}`,
      employee: `NV${String(i + 1).padStart(3, "0")}`,
      name: demoNames[i],
      department: i % 2 ? "Phát triển năng lực" : "Đào tạo kinh doanh",
      codeHash: await hash(normalizeCode(demoCode(i))),
      photo: `assets/avatar${i + 1}.webp`,
      active: true,
      isDemo: true,
    });
  s.assignments = s.people.map((p: any, i: number) => ({
    sender: p.id,
    recipient: s.people[(i + 1) % 10].id,
  }));
  const texts = [
    "Cảm ơn bạn vì luôn kiên nhẫn lắng nghe và biến những điều khó thành thật dễ hiểu. Chúc bạn luôn giữ được niềm vui trên hành trình gieo tri thức!",
    "Mỗi buổi học cùng bạn đều mang đến một góc nhìn mới. Chúc bạn một ngày 20/11 thật ấm áp, với thật nhiều yêu thương.",
    "Cảm ơn vì những lần đồng hành, những lời động viên đúng lúc. Những điều tốt đẹp bạn trao đi luôn ở lại trong chúng mình.",
  ];
  s.wishes = texts.map((text, i) => ({
    id: `sample${i}`,
    sender: `p${i + 4}`,
    recipient: "p1",
    text,
    anonymous: i === 1,
    kind: "extra",
    requestId: `seed${i}`,
    round: 1,
    hidden: false,
    isDemo: true,
    createdAt: new Date(Date.now() - i * 120000).toISOString(),
  }));
  s.receipts = s.wishes.map((w: any) => ({
    sender: w.sender,
    recipient: w.recipient,
    kind: w.kind,
    round: w.round,
    requestId: w.requestId,
    isDemo: true,
  }));
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
export async function demoCall(action: string, p: any, token: string) {
  return navigator.locks.request(KEY, async () => {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") || (await seed());
    if (action === "login") {
      const codeHash = await hash(normalizeCode(p.code));
      const who = s.people.find(
        (x: any) => x.codeHash === codeHash && x.active,
      );
      if (!who) throw new Error("Mã cá nhân chưa đúng. Bạn kiểm tra lại nhé.");
      return {
        token: `demo:${who.id}:${codeHash}`,
        expiresAt: Date.now() + 86400000,
      };
    }
    if (action === "modLogin") {
      if (p.password !== "demo-mat-khau")
        throw new Error("Mật khẩu demo chưa đúng.");
      return { token: "demo:mod", expiresAt: Date.now() + 3600000 };
    }
    const [, , codeHash] = token.split(":");
    const personId = token.split(":")[1];
    if (
      token &&
      token !== "demo:mod" &&
      !s.people.some((x: any) => x.id === personId && x.codeHash === codeHash)
    )
      throw new Error("Phiên đã bị thu hồi.");
    if (action === "getPhoto") {
      if (token !== "demo:mod") dispatch(s, "photo", p, { personId });
      const target = s.people.find((x: any) => x.id === p.personId);
      if (!target) throw new Error("Không tìm thấy người tham gia.");
      return target.photo || "";
    }
    const result = dispatch(s, action, p, {
      role: token === "demo:mod" ? "mod" : "participant",
      personId,
      id: () => crypto.randomUUID(),
    });
    localStorage.setItem(KEY, JSON.stringify(s));
    return result;
  });
}
export async function resetDemo() {
  await navigator.locks.request(KEY, seed);
}
