import { test, expect } from "@playwright/test";

test.skip(
  !!process.env.LIVE_URL,
  "Controlled latency tests only use the local app.",
);

// Keep backend reads pending until the test releases them: navigation must
// finish without a response, even when several tabs are selected quickly.
const apiStub = `
export const DEMO = false;
const m = window.__adminTest = {
  valid: true, reads: 0, pending: [],
  state: { version: 1, people: [], wishes: [], receipts: [], assignments: [],
    settings: { open: false, round: 1, extraLimit: 2, opensAt: '', closesAt: '', expiresAt: '' } }
};
export function token() { return m.valid ? 'test-session' : ''; }
export function saveSession(value) { m.valid = !!value; }
export function logout() { m.valid = false; }
export async function api(action, payload = {}) {
  if (action === 'admin') {
    m.reads++;
    if (m.reads === 1) return structuredClone(m.state);
    return new Promise((resolve, reject) => m.pending.push({ resolve, reject }));
  }
  if (action === 'settings') {
    Object.assign(m.state.settings, payload);
    m.state.version++;
    return {};
  }
  throw new Error('Unexpected test request: ' + action);
}
`;

test.beforeEach(async ({ page }) => {
  await page.route(/\/src\/api\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: apiStub }),
  );
  await page.goto("/mod.html");
  await expect(
    page.getByRole("heading", { name: "Tổng quan", exact: true }),
  ).toBeVisible();
});

test("tabs open immediately, share one pending read and preserve settings being edited", async ({
  page,
}) => {
  const switched = await page.evaluate(() => {
    const labels = [
      "Người tham gia",
      "Ảnh chân dung",
      "Ghép người & mã QR",
      "Lời chúc",
      "Tổng quan",
      "Cài đặt sự kiện",
    ];
    return labels.map((label) => {
      const button = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-tab]"),
      ).find((b) => b.textContent === label)!;
      const start = performance.now();
      button.click();
      return {
        label,
        heading: document.querySelector("h1")?.textContent,
        ms: performance.now() - start,
      };
    });
  });
  for (const row of switched) {
    expect(row.heading).toBe(row.label);
    expect(row.ms).toBeLessThan(250);
  }
  expect(await page.evaluate(() => (window as any).__adminTest.reads)).toBe(2);
  await page.locator("#extra-limit").fill("9");
  await page.evaluate(() => {
    const m = (window as any).__adminTest;
    m.state.version++;
    m.state.settings.extraLimit = 4;
    m.pending[0].resolve(structuredClone(m.state));
  });
  await expect(page.locator("#refresh-admin")).toHaveText(
    "Có cập nhật · Làm mới",
  );
  await expect(page.locator("#extra-limit")).toHaveValue("9");
});

test("new wishes appear in the background and an older read cannot undo a saved change", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Lời chúc", exact: true }).click();
  await page.evaluate(() => {
    const m = (window as any).__adminTest;
    m.state.version++;
    m.state.wishes = [
      {
        id: "wish1",
        text: "Lời mới từ đồng nghiệp",
        actualSender: "Người gửi",
        recipientName: "Người nhận",
        anonymous: false,
      },
    ];
    m.pending[0].resolve(structuredClone(m.state));
  });
  await expect(page.getByText("Lời mới từ đồng nghiệp")).toBeVisible();
  await page
    .getByRole("button", { name: "Cài đặt sự kiện", exact: true })
    .click();
  await page.locator("#extra-limit").fill("7");
  await page.getByRole("button", { name: "Lưu cài đặt", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__adminTest.pending.length))
    .toBe(3);
  await page.evaluate(() => {
    const m = (window as any).__adminTest;
    m.pending[2].resolve(structuredClone(m.state));
  });
  await expect(page.getByText("Đã lưu cài đặt.")).toBeVisible();
  await page.evaluate(() => {
    const m = (window as any).__adminTest;
    const stale = structuredClone(m.state);
    stale.version--;
    stale.settings.extraLimit = 2;
    m.pending[1].resolve(stale);
  });
  await expect(page.locator("#extra-limit")).toHaveValue("7");
  // Check the cached state as well as the existing DOM.
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page
    .getByRole("button", { name: "Cài đặt sự kiện", exact: true })
    .click();
  await expect(page.locator("#extra-limit")).toHaveValue("7");
});

test("a revoked session clears the cached admin view", async ({ page }) => {
  await page
    .getByRole("button", { name: "Người tham gia", exact: true })
    .click();
  await page.evaluate(() => {
    (window as any).__adminTest.pending[0].reject(
      Object.assign(new Error("Phiên đã hết hạn"), { code: "AUTH" }),
    );
  });
  await expect(page.locator("#mod-login")).toBeVisible();
  await expect(page.locator(".admin-shell")).toHaveCount(0);
});
