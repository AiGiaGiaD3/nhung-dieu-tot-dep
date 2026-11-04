import { build } from "esbuild";
import { mkdir, copyFile, appendFile } from "node:fs/promises";
await mkdir("backend-build", { recursive: true });
await build({
  entryPoints: ["backend/entry.mjs"],
  bundle: true,
  platform: "browser",
  format: "iife",
  globalName: "EventBackend",
  target: "es2020",
  inject: ["scripts/gas-timers.mjs"],
  outfile: "backend-build/Code.gs",
  external: ["crypto"],
  alias: { crypto: "./scripts/crypto-stub.mjs" },
  logLevel: "warning",
});
await appendFile(
  "backend-build/Code.gs",
  "\nfunction doGet(e){return EventBackend.doGet(e)}\nfunction doPost(e){return EventBackend.doPost(e)}\nfunction bootstrap(c){return EventBackend.bootstrap(c)}\nfunction changePassword(v){return EventBackend.changePassword(v)}\nfunction ownerInfo(){return EventBackend.ownerInfo()}\n",
);
await copyFile("backend/appsscript.json", "backend-build/appsscript.json");
