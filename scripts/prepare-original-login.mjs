import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
const output = "app/public/original-login";
await mkdir(output + "/assets", { recursive: true });
for (const name of [
  "styles.css",
  "book-landing.css",
  "workspace.css",
  "appearance.css",
  "digital-bank.css",
  "workspace-ui.css",
])
  await copyFile("src/" + name, output + "/" + name);
for (const name of [
  "school-campus.png",
  "school-desk.webp",
  "school-workspace-v2.webp",
])
  await copyFile("src/assets/" + name, output + "/assets/" + name);
const appearance = await readFile("src/ui/appearance.js", "utf8");
const original = (await readFile("src/ui/auth.js", "utf8")).replace(
  /\r\n/g,
  "\n",
);
const originalLoad =
  /async function load\(\) \{[\s\S]*?\n\}\n\nfunction resetPage/;
if (!originalLoad.test(original))
  throw Error("Original login handoff could not be located");
const auth = original.replace(
  originalLoad,
  `async function load() {
  window.parent.postMessage({type: "sikap:authenticated", recovered: wasRecovery}, location.origin);
}\n\nfunction resetPage`,
);
await build({
  stdin: {
    contents: `
    window.sikapBackend = window.parent.sikapBackend;
    const wasRecovery = window.sikapBackend.recovery;
    const $ = selector => document.querySelector(selector);
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
    const ico = name => '<span class="material-symbols-rounded" aria-hidden="true">' + name + '</span>';
    let authMode = "login", busy = false, view = "dashboard", dirty = false, data = null, detail = null;
    const api = (path, options) => window.sikapBackend.api(path, options);
    const toast = value => { const node = $("#toast"); node.textContent = value; node.classList.add("show"); setTimeout(() => node.classList.remove("show"), 3500); };
    ${appearance}
    ${auth}
    Object.assign(window, {schoolLogin, setAuthMode, togglePassword, passwordHelp, resendConfirmation, resetPassword, setAppearance});
    if (window.sikapBackend.recovery && !window.sikapBackend.recoveryError) resetPage();
    else login(window.sikapBackend.recoveryError || "");
  `,
    sourcefile: "original-login-entry.js",
    resolveDir: process.cwd(),
  },
  bundle: true,
  minify: true,
  platform: "browser",
  outfile: output + "/auth.js",
});
await build({
  entryPoints: ["src/landing-scene.js"],
  bundle: true,
  minify: true,
  platform: "browser",
  outfile: output + "/landing-scene.js",
});
const originalHtml = await readFile("src/index.html", "utf8");
await writeFile(
  output + "/index.html",
  originalHtml
    .replace(
      /    <script src="docx-preview.js"><\/script>\s*<script src="config.js"><\/script>\s*<script src="backend.js"><\/script>\s*<script src="frontend.js"><\/script>/,
      '    <script src="auth.js"></script>',
    )
    .replace(/\s*<script defer src="head-desk.js"><\/script>/, ""),
);
