import { documentXml, presentationCheck } from "./docx.js";
// File types a Digital Bank resource may use, by extension. The database
// (supabase/proposal-alignment.sql) allows exactly these MIME types.
export const RESOURCE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const resourceExtension = (mime) =>
  Object.keys(RESOURCE_TYPES).find((ext) => RESOURCE_TYPES[ext] === mime);
export async function validateResourceFile(file) {
  if (!file?.size || file.size > 20971520)
    throw Error("Choose a PDF, DOCX or PPTX file up to 20 MB.");
  if (!file.name || file.name.length > 240)
    throw Error("File name must be 1 to 240 characters.");
  const ext = file.name.split(".").pop().toLowerCase();
  if (!Object.hasOwn(RESOURCE_TYPES, ext))
    throw Error(
      "Only PDF, Word (DOCX) and PowerPoint (PPTX) files are supported.",
    );
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (ext === "pdf" && new TextDecoder().decode(bytes) !== "%PDF-")
    throw Error("This is not a valid PDF.");
  if (ext !== "pdf" && (bytes[0] !== 80 || bytes[1] !== 75))
    throw Error(`This is not a valid ${ext.toUpperCase()}.`);
  if (ext === "docx") {
    try {
      await documentXml(await file.arrayBuffer());
    } catch {
      throw Error("Choose a valid Word DOCX document.");
    }
  }
  if (ext === "pptx") {
    try {
      await presentationCheck(await file.arrayBuffer());
    } catch {
      throw Error("Choose a valid PowerPoint PPTX presentation.");
    }
  }
  return RESOURCE_TYPES[ext];
}
