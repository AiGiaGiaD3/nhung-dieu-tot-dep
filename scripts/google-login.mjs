import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Cần chọn file JSON OAuth Desktop đã tải từ Google Cloud.");
  let client;
  try {
    client = JSON.parse(await fs.readFile(input, "utf8")).installed;
  } catch {
    throw new Error("Không đọc được file JSON đã chọn.");
  }
  if (!client?.client_id || !client.client_secret || !client.project_id)
    throw new Error("File phải là OAuth client loại Desktop app.");
  if (client.project_id !== process.env.GOOGLE_CLOUD_PROJECT_ID)
    throw new Error("File OAuth không thuộc Google Cloud project đã cấu hình.");
  await fs.mkdir(".local", { recursive: true });
  const destination = path.resolve(".local/google-oauth.json");
  if (path.resolve(input) !== destination) await fs.copyFile(input, destination);
  let env = await fs.readFile(".env", "utf8");
  const line = `GOOGLE_CREDENTIALS_FILE="${destination.replaceAll("\\", "/")}"`;
  env = /^GOOGLE_CREDENTIALS_FILE=.*$/m.test(env)
    ? env.replace(/^GOOGLE_CREDENTIALS_FILE=.*$/m, () => line)
    : env.trimEnd() + "\n" + line + "\n";
  await fs.writeFile(".env", env, { mode: 0o600 });
  console.log("Đăng nhập bằng Gmail sở hữu dự án Google Cloud. Hoàn tất cấp quyền trong trình duyệt.");
  const result = spawnSync(process.execPath, [
    "node_modules/@google/clasp/build/src/index.js", "login", "--creds", destination,
    "--extra-scopes", "https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/drive",
  ], { stdio: "inherit", shell: false });
  if (result.error || result.status !== 0)
    throw new Error("Đăng nhập Google chưa hoàn tất. Giữ file JSON riêng trên máy và báo lỗi hiển thị.");
  console.log("Đã hoàn tất lệnh đăng nhập Google. Quay lại chat để kiểm tra và tiếp tục triển khai.");
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
