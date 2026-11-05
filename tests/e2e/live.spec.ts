import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
import { call, modToken, readJSON, saveJSON } from "../../scripts/lib.mjs";
test.skip(
  !process.env.LIVE_URL,
  "Chỉ chạy khi có LIVE_URL thật và fixtures riêng.",
);
test("live Excel import, bulk portraits, pairing, participants, PNG and moderation", async ({
  page,
  context,
}) => {
  test.setTimeout(600000);
  context.setDefaultTimeout(45000);
  context.setDefaultNavigationTimeout(45000);
  const check = expect.configure({ timeout: 45000 });
  const errors: string[] = [];
  const monitor = (p: any) => {
    p.on("pageerror", (e: Error) => errors.push(e.message));
    p.on("console", (m: any) => {
      if (m.type() === "error") errors.push(m.text());
    });
  };
  monitor(page);
  context.on("page", monitor);
  const local = await readJSON(".local/deployment.json");
  // Tag only this test's imported fictional records for cleanDemo cleanup.
  // Requests still execute against the real backend; no responses are mocked.
  await context.route(local.backendUrl, async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      if (body?.action === "import") {
        body.payload.isDemo = true;
        await route.continue({ postData: JSON.stringify(body) });
        return;
      }
    }
    await route.continue();
  });
  const mod = await context.newPage();
  await mod.setViewportSize({ width: 1440, height: 1000 });
  await mod.goto("./mod.html");
  await mod.getByLabel("Mật khẩu quản trị").fill(process.env.MOD_PASSWORD!);
  await mod.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await check(mod.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  await mod
    .getByRole("button", { name: "Người tham gia", exact: true })
    .click();
  await mod.getByRole("button", { name: "Nhập từ Excel" }).click();
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
  await mod
    .getByLabel("Danh sách từ Excel")
    .fill(
      "Mã nhân viên\tHọ tên\tĐơn vị\n" +
        names
          .map(
            (name, i) =>
              `DEMO${String(i + 1).padStart(3, "0")}\t${name}\tDữ liệu thử nghiệm`,
          )
          .join("\n"),
    );
  await mod.getByRole("button", { name: "Kiểm tra danh sách" }).click();
  await mod.getByRole("button", { name: "Nhập 10 người" }).click();
  await check(mod.locator("#people-body tr")).toHaveCount(10);
  const fixtures = await mod.evaluate(() =>
    JSON.parse(sessionStorage.getItem("ndtd-issued")!),
  );
  await saveJSON(".local/fixtures.json", fixtures);
  const first = fixtures[0];
  await mod.getByRole("button", { name: "Ảnh chân dung", exact: true }).click();
  await mod.locator("#bulk-photos").setInputFiles(
    await Promise.all(
      names.map(async (name, i) => ({
        name: `${i % 2 ? name : "DEMO" + String(i + 1).padStart(3, "0")}.webp`,
        mimeType: "image/webp",
        buffer: await fs.readFile(`public/assets/avatar${i + 1}.webp`),
      })),
    ),
  );
  await check(mod.locator("[data-match]")).toHaveCount(10);
  await mod.getByRole("button", { name: "Áp dụng ảnh đã chọn" }).click();
  await check(mod.getByText("Đã cập nhật 10 ảnh.")).toBeVisible({
    timeout: 180000,
  });
  await mod.getByRole("button", { name: "Ghép người & mã QR" }).click();
  await mod.getByRole("button", { name: "Ghép ngẫu nhiên" }).click();
  await check(
    mod.getByText("Đã kiểm tra: không tự ghép, mỗi người nhận đúng một lần."),
  ).toBeVisible();
  const token = await modToken();
  const paired = await call("admin", {}, token);
  expect(paired.assignments).toHaveLength(10);
  expect(paired.assignments.every((a: any) => a.sender !== a.recipient)).toBe(
    true,
  );
  expect(new Set(paired.assignments.map((a: any) => a.recipient)).size).toBe(
    10,
  );
  expect(paired.people.every((p: any) => p.photo && p.isDemo)).toBe(true);
  const csv = mod.waitForEvent("download");
  await mod.getByRole("button", { name: "Xuất CSV mã cá nhân" }).click();
  expect((await csv).suggestedFilename()).toBe("ma-ca-nhan.csv");
  await mod.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await mod.getByRole("button", { name: "Mở cổng gửi" }).click();
  await check(mod.getByText("● Cổng gửi đang mở")).toBeVisible();
  await page.goto("./#code=" + first.code);
  await check(page.getByRole("button", { name: "Mở phong thư" })).toBeVisible();
  await page.getByRole("button", { name: "Mở phong thư" }).click();
  await check(
    page.getByRole("button", { name: "Viết lời chúc" }),
  ).toBeVisible();
  await check
    .poll(() =>
      page
        .locator(".avatar.large img")
        .evaluateAll((images) =>
          images.some((img) => (img as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await fs.mkdir("screenshots/live", { recursive: true });
  await page.screenshot({ path: "screenshots/live/mobile-390x844.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Viết lời chúc" }).click();
  await page
    .getByLabel("Bạn muốn nhắn gửi điều gì?")
    .fill("Lời chúc kiểm thử thật — cảm ơn bạn đã đồng hành.");
  await page.getByRole("button", { name: "Xem trước lời chúc" }).click();
  await page.getByRole("button", { name: "Gửi lời chúc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lời chúc đã đến nơi." }),
  ).toBeVisible({ timeout: 120000 });
  await mod.getByRole("button", { name: "Ghép người & mã QR" }).click();
  const recipientName = await mod
    .locator("tr")
    .filter({ has: mod.getByRole("cell", { name: first.name, exact: true }) })
    .first()
    .locator("td")
    .nth(1)
    .textContent();
  const recipient = fixtures.find((p: any) => p.name === recipientName);
  expect(recipient).toBeTruthy();
  const inbox = await context.newPage();
  await inbox.goto("./#code=" + recipient.code);
  await expect(inbox.getByRole("button", { name: "Mở phong thư" })).toBeVisible(
    { timeout: 30000 },
  );
  await inbox.getByRole("link", { name: "Hộp thư của tôi" }).click();
  await expect(
    inbox.getByText("Lời chúc kiểm thử thật — cảm ơn bạn đã đồng hành."),
  ).toBeVisible({ timeout: 30000 });
  await inbox
    .getByRole("button", { name: "Mở lời chúc từ " + first.name })
    .click();
  const download = inbox.waitForEvent("download");
  await inbox.getByRole("button", { name: "Lưu thiệp PNG" }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  await png.saveAs("screenshots/live/thiep-mau.png");
  const metadata = await sharp("screenshots/live/thiep-mau.png").metadata();
  expect(metadata.width).toBe(1080);
  expect(metadata.height).toBeGreaterThanOrEqual(1350);
  await page.getByRole("button", { name: "Trở về", exact: true }).click();
  await page.getByRole("button", { name: "Gửi thêm một điều tốt đẹp" }).click();
  await page.locator("[data-person]").first().click();
  await page
    .getByLabel("Bạn muốn nhắn gửi điều gì?")
    .fill("Ẩn danh kiểm thử <img src=x onerror=alert(1)>");
  await page.getByLabel("Gửi ẩn danh").check();
  await page.getByRole("button", { name: "Xem trước lời chúc" }).click();
  await page.getByRole("button", { name: "Gửi lời chúc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lời chúc đã đến nơi." }),
  ).toBeVisible({ timeout: 120000 });
  const wall = await context.newPage();
  await wall.setViewportSize({ width: 1920, height: 1080 });
  await wall.goto("./wall.html");
  await expect(
    wall.getByText("Lời chúc kiểm thử thật — cảm ơn bạn đã đồng hành."),
  ).toBeVisible({ timeout: 30000 });
  await fs.mkdir("screenshots/live", { recursive: true });
  await wall.screenshot({ path: "screenshots/live/wall-1920.png" });
  expect(
    await wall.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(1080);
  const publicFeed = await call("wall");
  const anonymous = publicFeed.wishes.find((w: any) =>
    w.text.startsWith("Ẩn danh kiểm thử"),
  );
  expect(anonymous).toBeTruthy();
  expect(anonymous.senderId).toBeUndefined();
  expect(anonymous.actualSender).toBeUndefined();
  expect(JSON.stringify(anonymous)).not.toContain(first.name);
  await mod.getByRole("button", { name: "Lời chúc", exact: true }).click();
  await mod
    .locator(".admin-wish")
    .filter({ hasText: "Lời chúc kiểm thử thật —" })
    .getByRole("button", { name: "Ẩn khỏi tường" })
    .click();
  await expect(
    wall.getByText("Lời chúc kiểm thử thật — cảm ơn bạn đã đồng hành."),
  ).toHaveCount(0, { timeout: 30000 });
  expect(errors).toEqual([]);
});
