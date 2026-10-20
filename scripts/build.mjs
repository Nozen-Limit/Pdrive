import { readUi } from "./ui-source.mjs";
import { createHash } from "node:crypto";
import { mkdir, copyFile, writeFile, access, readFile } from "node:fs/promises";
import { build } from "esbuild";
await mkdir("docs", { recursive: true });
await mkdir("docs/assets", { recursive: true });
await mkdir("supabase/functions/_shared", { recursive: true });
for (const file of ["resource-file.js", "docx.js"])
  await copyFile("src/lib/" + file, "supabase/functions/_shared/" + file);
await copyFile("src/assets/school-desk.webp", "docs/assets/school-desk.webp");
await copyFile(
  "src/assets/school-workspace-v2.webp",
  "docs/assets/school-workspace-v2.webp",
);
await copyFile("src/assets/school-campus.png", "docs/assets/school-campus.png");
for (const file of [
  "index.html",
  "styles.css",
  "book-landing.css",
  "workspace.css",
  "appearance.css",
  "digital-bank.css",
  "workspace-ui.css",
])
  await copyFile("src/" + file, "docs/" + file);
try {
  await access("docs/config.js");
} catch {
  await copyFile("config.js", "docs/config.js");
}
await build({
  entryPoints: ["src/backend.js"],
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  outfile: "docs/backend.js",
});
await build({
  entryPoints: ["src/docx-preview.js"],
  bundle: true,
  minify: true,
  platform: "browser",
  outfile: "docs/docx-preview.js",
});
await writeFile("docs/.nojekyll", "");
console.log("Project Sikap built in docs/ for GitHub Pages.");

await build({
  entryPoints: ["src/landing-scene.js"],
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  outfile: "docs/landing-scene.js",
});

await build({
  entryPoints: ["src/head-desk.js"],
  bundle: true,
  minify: true,
  platform: "browser",
  format: "iife",
  outfile: "docs/head-desk.js",
});

// Ship dependent UI code together so cached files cannot load mismatched helpers.
await writeFile("docs/frontend.js", await readUi());
const assets = [
  "frontend.js",
  "backend.js",
  "styles.css",
  "book-landing.css",
  "workspace.css",
  "appearance.css",
  "digital-bank.css",
  "workspace-ui.css",
  "head-desk.js",
  "landing-scene.js",
  "docx-preview.js",
];
const hash = createHash("sha256");
for (const name of assets) hash.update(await readFile("docs/" + name));
const version = hash.digest("hex").slice(0, 12);
const html = await readFile("src/index.html", "utf8");
await writeFile(
  "docs/index.html",
  html.replace(
    /((?:src|href)=")([^"/]+\.(?:js|css))(")/g,
    (_, start, name, end) => start + name + "?v=" + version + end,
  ),
);
