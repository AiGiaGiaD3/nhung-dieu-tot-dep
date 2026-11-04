import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
test.skip(!!process.env.LIVE_URL, "Demo suite must never mutate a live event.");
const shot = "screenshots";
test.beforeEach(async ({ page }) => {
  await mkdir(shot, { recursive: true });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});
test("participant named and anonymous wishes, recipient inbox, PNG, XSS, mobile screenshots", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.screenshot({
    path: path.join(shot, "01-trang-chao-390.png"),
    fullPage: true,
  });
  await page.goto("/#code=DEMO-01");
  await expect(
    page.getByRole("button", { name: "Mở phong thư" }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shot, "02-phong-thu-390.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mở phong thư" }).click();
  await expect(
    page.getByRole("heading", { name: "Trần Đức Huy" }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shot, "03-nguoi-dong-hanh-390.png"),
    fullPage: true,
  });
  await page.locator(".reveal-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shot, "mobile-390x844.png") });
  await page.getByRole("button", { name: "Viết lời chúc" }).click();
  await page
    .getByLabel("Bạn muốn nhắn gửi điều gì?")
    .fill("Cảm ơn bạn đã luôn đồng hành. Chúc bạn một ngày 20/11 thật ấm áp!");
  await page.screenshot({
    path: path.join(shot, "04-viet-loi-chuc-390.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Xem trước lời chúc" }).click();
  await page.getByRole("button", { name: "Gửi lời chúc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lời chúc đã đến nơi." }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shot, "05-gui-thanh-cong-390.png"),
    fullPage: true,
  });
  const recipient = await context.newPage();
  await recipient.goto("/#code=DEMO-02");
  await recipient.goto("/#inbox");
  await expect(
    recipient.getByText("Cảm ơn bạn đã luôn đồng hành.", { exact: false }),
  ).toBeVisible();
  await recipient
    .getByRole("button", { name: "Mở lời chúc từ Nguyễn Minh Anh" })
    .click();
  const dl = recipient.waitForEvent("download");
  await recipient.getByRole("button", { name: "Lưu thiệp PNG" }).click();
  const file = await dl;
  await file.saveAs(path.join(shot, "thiep-mau.png"));
  expect(await file.failure()).toBeNull();
  const metadata = await (await import("sharp"))
    .default(path.join(shot, "thiep-mau.png"))
    .metadata();
  expect(metadata.width).toBe(1080);
  expect(metadata.height).toBeGreaterThanOrEqual(1350);
  await page.getByRole("button", { name: "Trở về", exact: true }).click();
  await page.getByRole("button", { name: "Gửi thêm một điều tốt đẹp" }).click();
  await page.getByRole("button", { name: /Lê Thu Hà/ }).click();
  const malicious = '<img src=x onerror="window.__xss=1"> Cảm ơn bạn!';
  await page.getByLabel("Bạn muốn nhắn gửi điều gì?").fill(malicious);
  await page.getByLabel("Gửi ẩn danh").check();
  await page.getByRole("button", { name: "Xem trước lời chúc" }).click();
  await page.getByRole("button", { name: "Gửi lời chúc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lời chúc đã đến nơi." }),
  ).toBeVisible();
  const third = await context.newPage();
  await third.goto("/#code=DEMO-03");
  await third.goto("/#inbox");
  await expect(third.getByText(malicious)).toBeVisible();
  await expect(
    third.getByRole("button", { name: "Mở lời chúc từ Một người đồng nghiệp" }),
  ).toBeVisible();
  expect(await third.evaluate(() => (window as any).__xss)).toBeUndefined();
  await page.goto("/#inbox");
  await expect(
    page.getByRole("heading", { name: "Hộp thư của tôi." }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(shot, "06-hop-thu-390.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("mod imports Excel, bulk photos, pairs, exports QR, closes gate and hides wall wish", async ({
  page,
  context,
}) => {
  await page.goto("/mod.html");
  await page.getByLabel("Mật khẩu quản trị").fill("demo-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(shot, "08-mod-tong-quan-1440.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cài đặt sự kiện", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Xoá dữ liệu mẫu" }).click();
  await expect(page.getByText("Đã lưu cài đặt.")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Người tham gia", exact: true })
    .click();
  await page.getByRole("button", { name: "Nhập từ Excel" }).click();
  await page
    .getByLabel("Danh sách từ Excel")
    .fill(
      "Mã nhân viên\tHọ tên\tĐơn vị\nTEST01\tNguyễn An\tĐào tạo\nTEST02\tTrần Bình\tPhát triển\nTEST03\tLê Chi\tĐào tạo",
    );
  await page.getByRole("button", { name: "Kiểm tra danh sách" }).click();
  await page.getByRole("button", { name: "Nhập 3 người" }).click();
  await expect(page.locator("#people-body tr")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Ảnh chân dung", exact: true })
    .click();
  await page.locator("#bulk-photos").setInputFiles([
    {
      name: "TEST01.webp",
      mimeType: "image/webp",
      buffer: await (
        await import("node:fs/promises")
      ).readFile("public/assets/avatar1.webp"),
    },
    {
      name: "Trần Bình.webp",
      mimeType: "image/webp",
      buffer: await (
        await import("node:fs/promises")
      ).readFile("public/assets/avatar2.webp"),
    },
  ]);
  await expect(page.locator("[data-match]")).toHaveCount(2);
  await page.getByRole("button", { name: "Áp dụng ảnh đã chọn" }).click();
  await expect(page.getByText("Đã cập nhật 2 ảnh.")).toBeVisible();
  await page.getByRole("button", { name: "Ghép người & mã QR" }).click();
  await page.getByRole("button", { name: "Ghép ngẫu nhiên" }).click();
  await expect(
    page.getByText("Đã kiểm tra: không tự ghép, mỗi người nhận đúng một lần."),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ndtd-demo-v1")!),
  );
  expect(
    state.assignments.every((a: any) => a.sender !== a.recipient),
  ).toBeTruthy();
  expect(new Set(state.assignments.map((a: any) => a.recipient)).size).toBe(3);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV mã cá nhân" }).click();
  expect((await download).suggestedFilename()).toBe("ma-ca-nhan.csv");
  await page.evaluate(() => (window.print = () => {}));
  await page.getByRole("button", { name: "In QR cá nhân" }).click();
  await expect(page.locator(".print-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.getByRole("button", { name: "Mở cổng gửi" }).click();
  const codes = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("ndtd-issued")!),
  );
  const participant = await context.newPage();
  await participant.goto("/#code=" + encodeURIComponent(codes[0].code));
  await participant.getByRole("button", { name: "Mở phong thư" }).click();
  await participant.getByRole("button", { name: "Viết lời chúc" }).click();
  await participant
    .getByLabel("Bạn muốn nhắn gửi điều gì?")
    .fill("Lời chúc kiểm thử ẩn khỏi tường.");
  await participant.getByRole("button", { name: "Xem trước lời chúc" }).click();
  await participant
    .getByRole("button", { name: "Gửi lời chúc", exact: true })
    .click();
  await expect(
    participant.getByRole("heading", { name: "Lời chúc đã đến nơi." }),
  ).toBeVisible();
  const wall = await context.newPage();
  await wall.goto("/wall.html");
  await expect(
    wall.getByText("Lời chúc kiểm thử ẩn khỏi tường."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lời chúc", exact: true }).click();
  await page.getByRole("button", { name: "Ẩn khỏi tường" }).click();
  await expect(wall.getByText("Lời chúc kiểm thử ẩn khỏi tường.")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.getByRole("button", { name: "Đóng cổng gửi" }).click();
  await expect(page.getByText("● Cổng gửi đang đóng")).toBeVisible();
});
test("wall 1080p, desktop welcome, errors and reduced motion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(shot, "00-trang-chao-1440.png"),
    fullPage: true,
  });
  await page.goto("/wall.html");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.locator("#total")).toHaveText("3");
  await page.screenshot({
    path: path.join(shot, "07-buc-tuong-1920.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(1080);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByLabel("Mã cá nhân của bạn").fill("SAI");
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.locator("#login-error")).toContainText("chưa đúng");
  expect(errors).toEqual([]);
});
