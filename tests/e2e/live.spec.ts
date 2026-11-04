import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test.skip(
  !process.env.LIVE_URL,
  "Chỉ chạy khi có LIVE_URL thật và fixtures riêng.",
);
test("live participants, anonymous response, private portrait, PNG and moderation", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  const fixtures = JSON.parse(
    await fs.readFile(".local/fixtures.json", "utf8"),
  );
  const first = fixtures[0];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./#code=" + first.code);
  await page.getByRole("button", { name: "Mở phong thư" }).click();
  await page.getByRole("button", { name: "Viết lời chúc" }).click();
  await page
    .getByLabel("Bạn muốn nhắn gửi điều gì?")
    .fill("Lời chúc kiểm thử thật — cảm ơn bạn đã đồng hành.");
  await page.getByRole("button", { name: "Xem trước lời chúc" }).click();
  await page.getByRole("button", { name: "Gửi lời chúc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lời chúc đã đến nơi." }),
  ).toBeVisible({ timeout: 120000 });
  const mod = await context.newPage();
  await mod.goto("./mod.html");
  await mod.getByLabel("Mật khẩu quản trị").fill(process.env.MOD_PASSWORD!);
  await mod.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(mod.getByRole("heading", { name: "Tổng quan" })).toBeVisible({
    timeout: 30000,
  });
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
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
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
