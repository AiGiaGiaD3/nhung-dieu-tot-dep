import "dotenv/config";
import fs from "node:fs/promises";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import QRCode from "qrcode";
import {
  readJSON,
  saveJSON,
  call,
  modToken,
  ownerRun,
  googleClient,
  node,
  run,
  conciseError,
} from "./lib.mjs";
const names = [
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
const sha = (s) => createHash("sha256").update(s).digest("hex");
async function confirm(text) {
  if (!process.stdin.isTTY)
    throw new Error("Thao tác xoá cần chạy trong terminal tương tác.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const result = await rl.question(`Nhập ${text} để tiếp tục: `);
  rl.close();
  if (result !== text) throw new Error("Đã huỷ.");
}
async function seed(count = 10, withPhotos = true) {
  const token = await modToken(),
    state = await call("admin", {}, token);
  if (state.people.length || state.wishes.length)
    throw new Error("Seed chỉ được chạy khi sự kiện chưa có dữ liệu.");
  const entries = Array.from({ length: count }, (_, i) => {
    const code = randomBytes(20).toString("hex").toUpperCase();
    return {
      employee: "DEMO" + String(i + 1).padStart(3, "0"),
      name: i < 10 ? names[i] : `Đồng nghiệp mẫu ${i + 1}`,
      department: "Dữ liệu thử nghiệm",
      code,
      codeHash: sha(code),
    };
  });
  const people = await call(
    "import",
    { people: entries.map(({ code, ...p }) => p), isDemo: true },
    token,
  );
  const fixtures = people.map((p, i) => ({ ...p, code: entries[i].code }));
  await saveJSON(".local/fixtures.json", fixtures);
  for (let i = 0; i < (withPhotos ? Math.min(count, 10) : 0); i++) {
    const bytes = await sharp(`public/assets/avatar${i + 1}.webp`)
      .jpeg({ quality: 80 })
      .toBuffer();
    await call(
      "setPhoto",
      {
        personId: people[i].id,
        photo: "data:image/jpeg;base64," + bytes.toString("base64"),
      },
      token,
    );
  }
  await call("pair", {}, token);
  await call("settings", { open: true }, token);
  console.log(
    `Đã tạo ${count} người mẫu. Mã chỉ lưu trong .local/fixtures.json.`,
  );
  return fixtures;
}
async function main() {
  const cmd = process.argv[2];
  if (cmd === "seed") {
    await seed();
    return;
  }
  if (cmd === "clean") {
    const result = await call("cleanDemo", {}, await modToken());
    await fs.rm(".local/fixtures.json", { force: true });
    console.log(
      `Đã xoá ${result.removed} người mẫu và thư/ảnh liên quan; cổng đang đóng.`,
    );
    return;
  }
  if (cmd === "password") {
    if (!process.env.MOD_PASSWORD || process.env.MOD_PASSWORD.length < 14)
      throw new Error(
        "Đặt mật khẩu mới ít nhất 14 ký tự vào MOD_PASSWORD trong .env.",
      );
    await ownerRun("changePassword", [
      bcrypt.hashSync(process.env.MOD_PASSWORD, 10),
    ]);
    console.log("Đã đổi mật khẩu và thu hồi mọi phiên cũ.");
    return;
  }
  if (cmd === "qr") {
    const local = await readJSON(".local/deployment.json", {});
    const url = process.env.PUBLIC_URL || local.publicUrl;
    if (!url) throw new Error("Cần PUBLIC_URL thật trước khi in QR.");
    await fs.mkdir("dist", { recursive: true });
    await QRCode.toFile("dist/qr-chung.png", url, {
      width: 1400,
      margin: 4,
      errorCorrectionLevel: "M",
    });
    console.log("Đã lưu dist/qr-chung.png");
    return;
  }
  if (cmd === "reset") {
    await confirm("XOÁ TOÀN BỘ");
    const token = await modToken();
    await saveJSON(
      ".local/backup-before-reset.json",
      await call("admin", {}, token),
    );
    await call("reset", { confirm: "XOÁ TOÀN BỘ" }, token);
    console.log(
      "Đã reset dữ liệu và đưa ảnh vào Trash. Backup local không chứa mã truy cập; xem README để xoá vĩnh viễn.",
    );
    return;
  }
  if (cmd === "teardown") {
    await confirm("GỠ SỰ KIỆN");
    const local = await readJSON(".local/deployment.json", {});
    const info = await ownerRun("ownerInfo");
    await call("reset", { confirm: "XOÁ TOÀN BỘ" }, await modToken());
    const { script, drive } = await googleClient();
    const deployments = await script.projects.deployments.list({
      scriptId: local.scriptId,
    });
    for (const d of deployments.data.deployments || [])
      if (d.deploymentConfig?.versionNumber)
        await script.projects.deployments.delete({
          scriptId: local.scriptId,
          deploymentId: d.deploymentId,
        });
    for (const fileId of [info.sheetId, info.folderId])
      if (fileId)
        await drive.files.update({ fileId, requestBody: { trashed: true } });
    run("gh", [
      "api",
      "--method",
      "DELETE",
      `repos/${process.env.GITHUB_REPO || "AiGiaGiaD3/nhung-dieu-tot-dep"}/pages`,
    ]);
    console.log(
      "Đã gỡ Web app/Pages và đưa Sheet/ảnh vào Trash. Xem README để dọn Trash, backup và secret local.",
    );
    return;
  }
  if (cmd === "test-live") {
    const local = await readJSON(".local/deployment.json", {});
    process.env.LIVE_URL = process.env.PUBLIC_URL || local.publicUrl;
    if (!process.env.LIVE_URL) throw new Error("Chưa có URL website thật.");
    const token = await modToken(),
      before = await call("admin", {}, token);
    if (before.people.length || before.wishes.length)
      throw new Error(
        "Test live tự động chỉ chạy khi sự kiện trống; không thử trên dữ liệu người thật.",
      );
    try {
      node("node_modules/@playwright/test/cli.js", ["test", "live.spec.ts"]);
    } finally {
      await call("cleanDemo", {}, token);
      const after = await call("admin", {}, token);
      if (
        after.people.length ||
        after.wishes.length ||
        after.assignments.length
      )
        throw new Error(
          "Dọn dữ liệu test chưa sạch. Cần kiểm tra trước khi dùng thật.",
        );
      await fs.rm(".local/fixtures.json", { force: true });
    }
    console.log("Test live hoàn tất; đã xác nhận không còn dữ liệu mẫu.");
    return;
  }
  if (cmd === "load") {
    const count = Number(process.env.LOAD_USERS || 100);
    if (![100, 300].includes(count))
      throw new Error("LOAD_USERS chỉ nhận 100 hoặc 300.");
    const duration = process.env.LOAD_BURST === "1" ? 0 : 600000;
    console.log(
      `Bài tải ${count} người, ${duration ? "phân bố trong 10 phút" : "gửi đồng loạt"}, chỉ chạy trên sự kiện trống.`,
    );
    const fixtures = await seed(count, false);
    const token = await modToken();
    const report = {
      count,
      duration,
      startedAt: new Date().toISOString(),
      sourceRevision: run("git", ["rev-parse", "HEAD"], { capture: true }),
      results: [],
      reads: 0,
      readErrors: 0,
      readErrorCodes: {},
    };
    let poll = true;
    let readers = [];
    const startReaders = () =>
      Array.from({ length: count }, (_, i) =>
        (async () => {
          await new Promise((r) => setTimeout(r, i * 100));
          while (poll) {
            try {
              await call("wall");
              report.reads++;
            } catch (error) {
              report.readErrors++;
              const code = error.code || "NETWORK";
              report.readErrorCodes[code] =
                (report.readErrorCodes[code] || 0) + 1;
            }
            await new Promise((r) =>
              setTimeout(r, 15000 + Math.random() * 2000),
            );
          }
        })(),
      );
    const started = Date.now();
    try {
      const auth = new Array(fixtures.length);
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (cursor < fixtures.length) {
            const i = cursor++;
            const t = (await call("login", { code: fixtures[i].code })).token;
            auth[i] = { token: t, me: await call("me", {}, t) };
          }
        }),
      );
      console.log(
        `Đã chuẩn bị ${auth.length} phiên; bắt đầu gửi và đọc tường đồng thời.`,
      );
      readers = startReaders();
      await Promise.all(
        auth.map(async (a, i) => {
          await new Promise((r) =>
            setTimeout(r, duration ? (i * duration) / count : 0),
          );
          const begin = Date.now();
          try {
            const w = await call(
              "send",
              {
                kind: "main",
                round: a.me.round,
                recipientId: a.me.recipient.id,
                requestId: randomUUID(),
                text: `Lời chúc mẫu tải ${i + 1}`,
                anonymous: i % 2 === 0,
              },
              a.token,
            );
            report.results.push({ ok: true, id: w.id, ms: Date.now() - begin });
          } catch (e) {
            report.results.push({
              ok: false,
              code: e.code || "NETWORK",
              ms: Date.now() - begin,
            });
          }
          if (report.results.length % 25 === 0)
            console.log(
              `Đã kết thúc ${report.results.length}/${count} lượt gửi; thành công ${report.results.filter((r) => r.ok).length}.`,
            );
        }),
      );
      poll = false;
      await Promise.all(readers);
      const actual = await call("admin", {}, token);
      report.actual = actual.wishes.length;
      const times = report.results
        .filter((x) => x.ok)
        .map((x) => x.ms)
        .sort((a, b) => a - b);
      report.p50 = times[Math.floor(times.length * 0.5)];
      report.p95 = times[Math.floor(times.length * 0.95)];
      report.elapsedMs = Date.now() - started;
      report.pass =
        report.actual === count &&
        new Set(report.results.map((x) => x.id)).size === count &&
        report.results.every((x) => x.ok) &&
        report.readErrors === 0 &&
        (!duration ? Math.max(...times) <= 120000 : true);
      await saveJSON(".local/load-report.json", report);
      console.log(
        `Lưu .local/load-report.json. ${report.pass ? "Đạt đối soát dữ liệu" : "Chưa đạt"}; p95 ${report.p95}ms.`,
      );
      if (!report.pass) process.exitCode = 1;
    } finally {
      poll = false;
      await Promise.all(readers);
      await call("cleanDemo", {}, token);
      const after = await call("admin", {}, token);
      if (
        after.people.length ||
        after.wishes.length ||
        after.assignments.length ||
        after.receipts.length ||
        after.settings.open
      )
        throw new Error(
          "Dọn dữ liệu tải chưa sạch hoặc cổng còn mở; cần kiểm tra trước khi dùng thật.",
        );
      await fs.rm(".local/fixtures.json", { force: true });
      console.log("Đã đối soát sạch dữ liệu tải và đóng cổng gửi.");
    }
    return;
  }
  throw new Error("Lệnh không hợp lệ. Xem README.");
}
main().catch(conciseError);
