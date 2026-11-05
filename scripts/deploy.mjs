import "dotenv/config";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  readJSON,
  saveJSON,
  run,
  node,
  clasp,
  googleClient,
  ownerRun,
  call,
  modToken,
  conciseError,
} from "./lib.mjs";
async function main() {
  const repo = process.env.GITHUB_REPO || "AiGiaGiaD3/nhung-dieu-tot-dep";
  if (!/^AiGiaGiaD3\/[a-z0-9-]+$/.test(repo))
    throw new Error(
      "Repo phải thuộc AiGiaGiaD3; tên chỉ gồm a-z, 0-9 và dấu gạch ngang.",
    );
  try {
    run("gh", ["auth", "status"], { capture: true });
  } catch {
    throw new Error(
      "Cần GitHub CLI và đăng nhập. Cài gh, chạy gh auth login, chọn AiGiaGiaD3 rồi chạy lại npm run deploy.",
    );
  }
  if (
    run("gh", ["api", "user", "--jq", ".login"], { capture: true }) !==
    "AiGiaGiaD3"
  )
    throw new Error("GitHub đang đăng nhập tài khoản khác AiGiaGiaD3.");
  if (!process.env.MOD_PASSWORD || process.env.MOD_PASSWORD.length < 14)
    throw new Error(
      "Đặt MOD_PASSWORD ngẫu nhiên tối thiểu 14 ký tự trong .env, không gửi qua chat.",
    );
  await googleClient();
  node("node_modules/typescript/bin/tsc", ["--noEmit"]);
  node("scripts/test-unit.mjs");
  node("scripts/build-backend.mjs");
  const clients = await googleClient();
  let state = await readJSON(".local/deployment.json", {});
  const config = await readJSON(".clasp.json");
  if (!state.sheetId) {
    if (config?.scriptId)
      throw new Error(
        "Có .clasp.json nhưng thiếu trạng thái. Phục hồi .local/deployment.json trước, không tự tạo tài nguyên mới.",
      );
    const result = await clients.sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "Những điều tốt đẹp — Dữ liệu riêng",
          timeZone: "Asia/Ho_Chi_Minh",
        },
      },
    });
    state.sheetId = result.data.spreadsheetId;
    await saveJSON(".local/deployment.json", state);
  }
  if (!state.scriptId) {
    if (config?.scriptId) state.scriptId = config.scriptId;
    else {
      clasp([
        "create-script",
        "--title",
        "Những điều tốt đẹp",
        "--parentId",
        state.sheetId,
        "--rootDir",
        "backend-build",
      ]);
      state.scriptId = (await readJSON(".clasp.json")).scriptId;
    }
    await saveJSON(".local/deployment.json", state);
  }
  if (process.env.CLOUD_LINK_CONFIRMED !== "1")
    throw new Error(
      `Cần thao tác Google một lần: mở https://script.google.com/home/projects/${state.scriptId}/settings → đổi Google Cloud project sang số trong GOOGLE_CLOUD_PROJECT_NUMBER; bật Apps Script/Sheets/Drive API. Sau khi hoàn tất, đặt CLOUD_LINK_CONFIRMED=1 trong .env. Xem docs/DEPLOY.md.`,
    );
  // create-script may write a default manifest into rootDir; rebuild before push.
  node("scripts/build-backend.mjs");
  clasp(["push", "--force"]);
  const version = await clients.script.projects.versions.create({
    scriptId: state.scriptId,
    requestBody: {
      description: "Những điều tốt đẹp " + new Date().toISOString(),
    },
  });
  const deploymentConfig = {
    versionNumber: version.data.versionNumber,
    manifestFileName: "appsscript",
    description: "Những điều tốt đẹp · Web app",
  };
  let dep;
  if (state.deploymentId) {
    dep = await clients.script.projects.deployments.update({
      scriptId: state.scriptId,
      deploymentId: state.deploymentId,
      requestBody: { deploymentConfig },
    });
  } else {
    const existing = await clients.script.projects.deployments.list({
      scriptId: state.scriptId,
    });
    const published = (existing.data.deployments || []).filter(
      (d) => d.deploymentConfig?.versionNumber,
    );
    if (published.length)
      throw new Error(
        "Đã có deployment nhưng thiếu ID local. Phục hồi ID đúng để giữ URL.",
      );
    dep = await clients.script.projects.deployments.create({
      scriptId: state.scriptId,
      requestBody: deploymentConfig,
    });
  }
  state.deploymentId = dep.data.deploymentId;
  const url = dep.data.entryPoints?.find((x) => x.webApp)?.webApp?.url;
  if (!url) {
    await saveJSON(".local/deployment.json", state);
    throw new Error(
      "Deployment chưa có Web app entry point. Kiểm tra manifest và quyền Anyone trong editor.",
    );
  }
  if (state.backendUrl && state.backendUrl !== url)
    throw new Error("URL backend thay đổi ngoài dự kiến; dừng để kiểm tra.");
  state.backendUrl = url;
  await saveJSON(".local/deployment.json", state);
  await ownerRun("bootstrap", [
    {
      sheetId: state.sheetId,
      secret: randomBytes(32).toString("hex"),
      verifier: bcrypt.hashSync(process.env.MOD_PASSWORD, 10),
    },
  ]);
  process.env.BACKEND_URL = state.backendUrl;
  state.publicUrl =
    process.env.PUBLIC_URL ||
    `https://aigiagiad3.github.io/${repo.split("/")[1]}/`;
  process.env.PUBLIC_URL = state.publicUrl;
  await saveJSON(".local/deployment.json", state);
  const health = await call("health");
  if (!health.initialized) throw new Error("Backend chưa khởi tạo thành công.");
  node("scripts/build.mjs");
  node("node_modules/@playwright/test/cli.js", ["test"]);
  let exists = true;
  try {
    run("gh", ["repo", "view", repo, "--json", "name"], { capture: true });
  } catch {
    exists = false;
  }
  if (!exists)
    run("gh", [
      "repo",
      "create",
      repo,
      "--public",
      "--description",
      "Ứng dụng tri ân 20/11 — Những điều tốt đẹp",
    ]);
  try {
    await fs.access(".git");
  } catch {
    run("git", ["init", "-b", "main"]);
  }
  let remote = "";
  try {
    remote = run("git", ["remote", "get-url", "origin"], { capture: true });
  } catch {}
  const expected = `https://github.com/${repo}.git`;
  if (remote && remote !== expected)
    throw new Error("Remote origin không trùng repo được chọn.");
  if (!remote) run("git", ["remote", "add", "origin", expected]);
  node("scripts/check-public.mjs");
  const paths = [
    ".gitignore",
    ".claspignore",
    ".prettierignore",
    ".github",
    ".env.example",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.js",
    "playwright.config.ts",
    "index.html",
    "wall.html",
    "mod.html",
    "privacy.html",
    "terms.html",
    "src",
    "backend",
    "public",
    "scripts",
    "tests",
    "docs",
    "README.md",
    "HUONG-DAN.md",
    "START-DEMO.ps1",
    "DANG-NHAP-GITHUB.ps1",
    "DANG-NHAP-GOOGLE.ps1",
    "DEPLOY.ps1",
  ];
  run("git", ["add", "--", ...paths]);
  const diff = run("git", ["diff", "--cached", "--name-only"], {
    capture: true,
  });
  if (diff) {
    const identity = JSON.parse(run("gh", ["api", "user"], { capture: true }));
    run("git", [
      "-c",
      `user.name=${identity.name || identity.login}`,
      "-c",
      `user.email=${identity.id}+${identity.login}@users.noreply.github.com`,
      "commit",
      "-m",
      "Build Những điều tốt đẹp event app",
    ]);
  }
  try {
    run("gh", ["api", `repos/${repo}/pages`], { capture: true });
  } catch {
    run("gh", [
      "api",
      "--method",
      "POST",
      `repos/${repo}/pages`,
      "-f",
      "build_type=workflow",
    ]);
  }
  run("gh", [
    "variable",
    "set",
    "BACKEND_URL",
    "--repo",
    repo,
    "--body",
    state.backendUrl,
  ]);
  run("gh", [
    "variable",
    "set",
    "PUBLIC_URL",
    "--repo",
    repo,
    "--body",
    state.publicUrl,
  ]);
  run("git", [
    "-c",
    "credential.helper=",
    "-c",
    "credential.helper=!gh auth git-credential",
    "push",
    "-u",
    "origin",
    "HEAD:main",
  ]);
  let workflow;
  const head = run("git", ["rev-parse", "HEAD"], { capture: true });
  for (let i = 0; i < 15; i++) {
    const rows = JSON.parse(
      run(
        "gh",
        [
          "api",
          `repos/${repo}/actions/runs?head_sha=${head}&per_page=5&nonce=${Date.now()}`,
        ],
        { capture: true },
      ),
    );
    workflow = rows.workflow_runs.find(
      (x) => x.head_sha === head && x.path === ".github/workflows/pages.yml",
    );
    if (workflow) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!workflow)
    throw new Error("Chưa tìm thấy workflow Pages cho commit hiện tại.");
  for (
    let attempt = 0;
    attempt < 60 && workflow.status !== "completed";
    attempt++
  ) {
    await new Promise((r) => setTimeout(r, 10000));
    workflow = JSON.parse(
      run(
        "gh",
        [
          "api",
          `repos/${repo}/actions/runs/${workflow.id}?nonce=${Date.now()}`,
        ],
        { capture: true },
      ),
    );
  }
  if (workflow.status !== "completed" || workflow.conclusion !== "success")
    throw new Error(`Pages chưa hoàn tất thành công. Xem ${workflow.html_url}`);
  const event = await call("admin", {}, await modToken());
  if (!event.people.length && !event.wishes.length && !event.assignments.length)
    node("scripts/manage.mjs", ["test-live"]);
  else
    console.log(
      "Sự kiện đã có dữ liệu: đã xác minh backend và quản trị; bỏ qua E2E có ghi fixture để giữ nguyên dữ liệu hiện có.",
    );
  node("scripts/manage.mjs", ["qr"]);
  console.log(
    `Hoàn tất triển khai: ${state.publicUrl}\nBức tường: ${state.publicUrl}wall.html\nMod: ${state.publicUrl}mod.html\nQR chung: dist/qr-chung.png`,
  );
}
main().catch(conciseError);
