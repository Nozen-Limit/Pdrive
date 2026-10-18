import { documentXml } from "./lib/docx.js";
let latest = 0;
window.previewDocx = async (url, target) => {
  const request = ++latest;
  target.textContent = "Loading document text…";
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    if (!url || url === "#") throw Error("File unavailable");
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw Error("File unavailable");
    const xml = await documentXml(await response.arrayBuffer()),
      doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length)
      throw Error("Invalid document XML");
    const paragraphs = [...doc.getElementsByTagNameNS("*", "p")].map((p) =>
      [...p.getElementsByTagNameNS("*", "t")]
        .map((t) => t.textContent)
        .join(""),
    );
    if (request === latest && target.isConnected)
      target.textContent =
        paragraphs.join("\n\n") ||
        "No readable text. Download the original document to view it.";
  } catch {
    if (request === latest && target.isConnected)
      target.textContent =
        "Text preview unavailable. Download the original document to open it in Word.";
  } finally {
    clearTimeout(timer);
  }
};
