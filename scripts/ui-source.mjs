import { readFile } from "node:fs/promises";
export const uiSources = [
  "school-workflow.js",
  "ui/appearance.js",
  "ui/auth.js",
  "ui/profile.js",
  "ui/accounts.js",
  "ui/modules.js",
  "ui/notes.js",
  "ui/reports.js",
  "frontend.js",
];
export async function readUi() {
  return (
    await Promise.all(
      uiSources.map((path) =>
        readFile(new URL("../src/" + path, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
}
