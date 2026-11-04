import "dotenv/config";
import { build } from "vite";
import "./build-backend.mjs";
const url = process.env.BACKEND_URL,
  site = process.env.PUBLIC_URL;
if (
  !url ||
  !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)
)
  throw new Error(
    "BACKEND_URL phải là Web app URL thật. Dùng npm run build:demo để xem thử.",
  );
if (!site?.startsWith("https://")) throw new Error("Cần PUBLIC_URL (HTTPS).");
process.env.VITE_BACKEND_URL = url;
process.env.VITE_PUBLIC_URL = site.replace(/\/?$/, "/");
await build({ mode: "production" });
