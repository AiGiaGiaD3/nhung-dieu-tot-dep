declare const __DEMO__: boolean;
export const DEMO = __DEMO__;
const URL = import.meta.env.VITE_BACKEND_URL || "";
const sessionKey = location.pathname.endsWith("mod.html")
  ? "ndtd-mod-session"
  : "ndtd-session";
export function token() {
  const x = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
  return x && x.expiresAt > Date.now() ? x.token : "";
}
export function saveSession(value: any) {
  sessionStorage.setItem(sessionKey, JSON.stringify(value));
}
export function logout() {
  sessionStorage.removeItem(sessionKey);
  location.href = "./";
}
export async function api(
  action: string,
  payload: any = {},
  auth = token(),
): Promise<any> {
  if (DEMO) {
    const { demoCall } = await import("./demo");
    return demoCall(action, payload, auth);
  }
  if (!URL)
    throw new Error(
      "Trang chưa được kết nối với sự kiện. Vui lòng liên hệ ban tổ chức.",
    );
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(URL, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ action, payload, token: auth }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok)
        throw new Error("Kết nối đang gián đoạn. Vui lòng thử lại.");
      const result = await response.json();
      if (result.ok) return result.data;
      const e = new Error(
        result.error?.message || "Chưa thực hiện được thao tác.",
      );
      if (result.error?.code !== "BUSY")
        throw Object.assign(e, { permanent: true, code: result.error?.code });
      throw e;
    } catch (e) {
      last = e;
      if ((e as any).permanent) throw e;
      if (attempt < 3)
        await new Promise((r) =>
          setTimeout(r, 800 * 2 ** attempt + Math.random() * 700),
        );
    }
  }
  throw last;
}
