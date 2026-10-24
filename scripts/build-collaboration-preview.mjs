// Local mock only. This does not change the published app or contact Supabase.
import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("docs/mock-assets", { recursive: true });
await copyFile(
  "mock/collaboration/index.html",
  "docs/collaboration-preview.html",
);
await copyFile(
  "mock/collaboration/styles.css",
  "docs/collaboration-preview.css",
);
for (const file of ["water-cycle.pptx", "water-cycle.pdf"])
  await copyFile(
    "mock/collaboration/assets/" + file,
    "docs/mock-assets/" + file,
  );
for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"])
  await copyFile(
    "node_modules/pdfjs-dist/build/" + file,
    "docs/mock-assets/" + file,
  );
await build({
  entryPoints: ["mock/collaboration/app.js"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: "docs/collaboration-preview.js",
  sourcemap: false,
});
console.log(
  "Local collaboration mock: http://127.0.0.1:4175/Pdrive/collaboration-preview.html",
);

const previewCss = await readFile("mock/collaboration/styles.css", "utf8");
await writeFile(
  "docs/collaboration-embedded.css",
  "#bank-collaboration-preview {\n" +
    previewCss.replace(/^html \{[\s\S]*?\}\s*/, "") +
    "\n}",
);
await copyFile(
  "node_modules/pdfjs-dist/LICENSE",
  "docs/mock-assets/PDFJS-LICENSE",
);
