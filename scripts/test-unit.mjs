import { spawnSync } from "node:child_process";
const r = spawnSync(
  process.execPath,
  ["--test", "tests/core.test.mjs", "tests/backend.test.mjs"],
  { stdio: "inherit" },
);
process.exit(r.status ?? 1);
