import { createRoot } from "react-dom/client";
import { App } from "./App";
const root = createRoot(document.getElementById("root")!);
// Layout previews with example data exist only while developing; the
// published build drops this branch and HomePreview with it.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("preview"))
  void import("./HomePreview").then(({ HomePreview }) =>
    root.render(<HomePreview />),
  );
else root.render(<App />);
