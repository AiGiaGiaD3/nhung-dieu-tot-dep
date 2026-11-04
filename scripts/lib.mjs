import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { google } from "googleapis";
import { FileCredentialStore } from "../node_modules/@google/clasp/build/src/auth/file_credential_store.js";
export async function readJSON(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export async function saveJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}
export function run(command, args, options = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    ...options,
    shell: false,
  });
  if (r.error || r.status !== 0)
    throw new Error(
      `Không chạy được ${path.basename(command)} ${args.slice(0, 2).join(" ")}. ${options.capture ? "Kiểm tra cài đặt và quyền đăng nhập." : ""}`,
    );
  return r.stdout?.trim() || "";
}
export const node = (file, args = []) => run(process.execPath, [file, ...args]);
export const clasp = (args) =>
  node("node_modules/@google/clasp/build/src/index.js", args);
export async function googleClient() {
  const store = new FileCredentialStore(
    path.join(os.homedir(), ".clasprc.json"),
  );
  const credential = await store.load("default");
  if (!credential)
    throw new Error(
      "Cần đăng nhập: npx clasp login --creds <file OAuth Desktop JSON> --extra-scopes https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive",
    );
  const file = process.env.GOOGLE_CREDENTIALS_FILE;
  if (!file)
    throw new Error(
      "Đặt GOOGLE_CREDENTIALS_FILE trong .env để xác minh OAuth cùng Google Cloud project.",
    );
  const own = await readJSON(file);
  const client = own?.installed || own?.web;
  if (!client || client.client_id !== credential.client_id)
    throw new Error(
      "clasp cần đăng nhập lại bằng OAuth Desktop client của dự án Google Cloud đã chọn.",
    );
  const auth = new google.auth.OAuth2(
    credential.client_id,
    credential.client_secret,
  );
  auth.setCredentials(credential);
  return {
    auth,
    script: google.script({ version: "v1", auth }),
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}
export async function ownerRun(name, args = []) {
  const local = await readJSON(".local/deployment.json");
  if (!local?.scriptId) throw new Error("Chưa có Apps Script project.");
  const { script } = await googleClient();
  try {
    const response = await script.scripts.run({
      scriptId: local.scriptId,
      requestBody: { function: name, parameters: args, devMode: true },
    });
    if (response.data.error) throw new Error("OWNER_EXECUTION");
    return response.data.response?.result;
  } catch {
    throw new Error(
      "Google chưa cho chạy hàm chủ sở hữu. Kiểm tra cùng Cloud project, API executable, scope và cấp quyền lần đầu trong Apps Script editor. Xem docs/DEPLOY.md.",
    );
  }
}
export async function call(action, payload = {}, token = "") {
  const state = await readJSON(".local/deployment.json", {});
  const url = process.env.BACKEND_URL || state.backendUrl;
  if (!url) throw new Error("Chưa có BACKEND_URL.");
  let last;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action, payload, token }),
        signal: AbortSignal.timeout(30000),
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.ok) {
        const e = new Error(result.error?.message || "Backend trả lỗi");
        e.code = result.error?.code;
        if (e.code !== "BUSY") e.permanent = true;
        throw e;
      }
      return result.data;
    } catch (e) {
      last = e;
      if (e.permanent) throw e;
      if (i < 4)
        await new Promise((r) =>
          setTimeout(r, 1000 * 2 ** i + Math.random() * 500),
        );
    }
  }
  throw last;
}
export async function modToken() {
  if (!process.env.MOD_PASSWORD)
    throw new Error("Cần MOD_PASSWORD trong .env cục bộ.");
  return (await call("modLogin", { password: process.env.MOD_PASSWORD })).token;
}
export function conciseError(e) {
  console.error(e?.message || "Thao tác chưa hoàn tất.");
  process.exitCode = 1;
}
