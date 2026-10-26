import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "vite";
// docs is generated output. Preserve the public Supabase connection before Vite
// replaces it; database contents and storage objects are never part of this build.
const output = resolve("docs");
if (output !== join(process.cwd(), "docs"))
  throw Error("Unexpected output directory");
let config;
try {
  config = await readFile("docs/config.js", "utf8");
} catch {
  config = await readFile("config.js", "utf8");
}
await import("./prepare-app.mjs");
await build();
await writeFile("docs/config.js", config);
await copyFile("app/docx-preview.js", "docs/docx-preview.js");
await copyFile("node_modules/pdfjs-dist/LICENSE", "docs/PDFJS-LICENSE");
await writeFile("docs/.nojekyll", "");
await mkdir("supabase/functions/_shared", { recursive: true });
for (const name of ["resource-file.js", "docx.js"])
  await copyFile("src/lib/" + name, "supabase/functions/_shared/" + name);
console.log("React / TypeScript Project SIKAP built in docs/.");
