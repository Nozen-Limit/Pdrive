import { documentXml } from "./docx.js";
export async function validateResourceFile(file) {
  if (!file?.size || file.size > 20971520)
    throw Error("Choose a PDF or DOCX up to 20 MB.");
  if (!file.name || file.name.length > 240)
    throw Error("File name must be 1 to 240 characters.");
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "docx"].includes(ext))
    throw Error("Only PDF and DOCX files are supported.");
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (ext === "pdf" && new TextDecoder().decode(bytes) !== "%PDF-")
    throw Error("This is not a valid PDF.");
  if (ext === "docx") {
    if (bytes[0] !== 80 || bytes[1] !== 75)
      throw Error("This is not a valid DOCX.");
    try {
      await documentXml(await file.arrayBuffer());
    } catch {
      throw Error("Choose a valid Word DOCX document.");
    }
  }
  return ext === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
