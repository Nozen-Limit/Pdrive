import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "app",
  base: "/Pdrive/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
  },
  build: {
    outDir: "../docs",
    emptyOutDir: true,
    assetsDir: "react-assets",
    manifest: true,
  },
});
