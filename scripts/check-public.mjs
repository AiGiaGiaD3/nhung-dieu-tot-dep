import fs from "node:fs/promises";
import path from "node:path";
const roots = [
  "src",
  "backend",
  "public",
  "scripts",
  "tests",
  "docs",
  ".github",
];
let count = 0;
async function walk(dir) {
  for (const x of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, x.name);
    if (x.isDirectory()) await walk(p);
    else {
      count++;
      if (
        /(\.env$|\.clasprc|\.clasp\.json|credentials|client_secret|ma-ca-nhan\.csv|google-token)/i.test(
          x.name,
        )
      )
        throw new Error("Tệp riêng tư trong source public: " + p);
      if (/\.(mjs|ts|js|html|json|yml|md)$/.test(p)) {
        const s = await fs.readFile(p, "utf8");
        if (
          /-----BEGIN (?:RSA )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|ya29\.[A-Za-z0-9_-]{30,}/.test(
            s,
          )
        )
          throw new Error("Phát hiện secret: " + p);
      }
    }
  }
}
for (const root of roots) await walk(root);
console.log(
  `Đã kiểm tra ${count} tệp nguồn; không phát hiện mẫu secret bị cấm. Không thay thế việc kiểm tra dữ liệu nhân sự thủ công.`,
);
