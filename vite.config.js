import { defineConfig } from "vite";
export default defineConfig(({ mode }) => {
  if (mode === "demo") process.env.VITE_PUBLIC_URL = "http://127.0.0.1:4173/";
  return {
    base: "./",
    define: { __DEMO__: JSON.stringify(mode === "demo") },
    build: {
      rollupOptions: {
        input: {
          main: "index.html",
          wall: "wall.html",
          mod: "mod.html",
          privacy: "privacy.html",
          terms: "terms.html",
        },
      },
    },
    server: {
      port: 4173,
      strictPort: true,
      watch: {
        ignored: [
          "**/screenshots/**",
          "**/test-results/**",
          "**/.local/**",
          "**/backend-build/**",
        ],
      },
    },
  };
});
