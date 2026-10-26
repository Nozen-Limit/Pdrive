import { copyFile } from "node:fs/promises";
import { build } from "esbuild";
await copyFile("config.js", "app/config.js");
await build({
  entryPoints: ["src/docx-preview.js"],
  bundle: true,
  minify: true,
  platform: "browser",
  outfile: "app/docx-preview.js",
});
