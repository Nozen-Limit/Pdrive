import { ZipReader, Uint8ArrayReader, configure } from "@zip.js/zip.js";
import { validateResourceFile } from "../../src/lib/resource-file.js";
import { limits } from "./model.js";
configure({ useWebWorkers: false });
export function fileType(file) {
  return file?.name?.split(".").pop().toLowerCase() || "";
}
async function mediaDuration(file) {
  const url = URL.createObjectURL(file),
    element = document.createElement(
      fileType(file) === "mp4" ? "video" : "audio",
    );
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            Error(
              "The recording could not be read. Try an MP4 with H.264/AAC or a standard MP3.",
            ),
          ),
        10000,
      );
      element.preload = "metadata";
      element.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(element.duration);
      };
      element.onerror = () => {
        clearTimeout(timer);
        reject(
          Error(
            "This browser cannot play this recording. Try an MP4 with H.264/AAC or a standard MP3.",
          ),
        );
      };
      element.src = url;
    });
  } finally {
    element.removeAttribute("src");
    element.load();
    URL.revokeObjectURL(url);
  }
}
export async function inspectFile(file, durationReader = mediaDuration) {
  const type = fileType(file);
  if (!["pdf", "docx", "pptx", "mp4", "mp3"].includes(type))
    throw Error("Choose a PDF, DOCX, PPTX, MP4 or MP3 file.");
  const maxMB =
    type === "mp4"
      ? limits.videoMB
      : type === "mp3"
        ? limits.audioMB
        : limits.documentMB;
  if (!file.size || file.size > maxMB * 1024 * 1024)
    throw Error(
      `${type.toUpperCase()} files must be greater than zero and no larger than ${maxMB} MB.`,
    );
  if (file.name.length > 240)
    throw Error("Use a file name of up to 240 characters.");
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (["pdf", "docx"].includes(type)) await validateResourceFile(file);
  if (type === "pptx") {
    const reader = new ZipReader(
      new Uint8ArrayReader(new Uint8Array(await file.arrayBuffer())),
    );
    try {
      const entries = await reader.getEntries();
      if (
        entries.length > 3000 ||
        !entries.some((e) => e.filename === "ppt/presentation.xml") ||
        !entries.some((e) => e.filename === "[Content_Types].xml") ||
        entries.some(
          (e) => e.encrypted || /vbaProject\.bin$/i.test(e.filename),
        ) ||
        entries.reduce((sum, e) => sum + e.uncompressedSize, 0) >
          100 * 1024 * 1024
      )
        throw Error();
    } catch {
      throw Error("Choose a valid, unencrypted PPTX without macros.");
    } finally {
      await reader.close();
    }
  }
  if (type === "mp4" && new TextDecoder().decode(header.slice(4, 8)) !== "ftyp")
    throw Error("This file does not appear to be an MP4.");
  if (
    type === "mp3" &&
    !(
      new TextDecoder().decode(header.slice(0, 3)) === "ID3" ||
      (header[0] === 255 && (header[1] & 224) === 224)
    )
  )
    throw Error("This file does not appear to be an MP3.");
  let duration = null;
  if (["mp4", "mp3"].includes(type)) {
    duration = await durationReader(file);
    const minutes = type === "mp4" ? limits.videoMinutes : limits.audioMinutes;
    if (!Number.isFinite(duration) || duration <= 0 || duration > minutes * 60)
      throw Error(
        `${type === "mp4" ? "Videos" : "Audio recordings"} must be no longer than ${minutes} minutes.`,
      );
  }
  return { name: file.name, type, bytes: file.size, duration };
}
export async function readPackage(form, registerUrl) {
  const data = new FormData(form),
    file = data.get("resource_file");
  if (!file?.size) throw Error("Choose a resource file.");
  const attachment = await inspectFile(file);
  if (attachment.type === "pptx") {
    const pdf = data.get("review_pdf");
    if (!pdf?.size || fileType(pdf) !== "pdf")
      throw Error("Attach the PDF review copy that matches this PPTX.");
    const preview = await inspectFile(pdf);
    attachment.preview = { ...preview, url: registerUrl(pdf) };
  }
  if (["mp4", "mp3"].includes(attachment.type)) {
    if (!data.has("permission"))
      throw Error("Confirm that you have permission to share this recording.");
    attachment.permission = true;
    attachment.transcript = String(data.get("transcript") || "").trim();
    const caption = data.get("captions");
    if (attachment.type === "mp4" && caption?.size) {
      if (
        fileType(caption) !== "vtt" ||
        caption.size > 1024 * 1024 ||
        !(await caption.text()).replace(/^\uFEFF/, "").startsWith("WEBVTT")
      )
        throw Error(
          "Captions must be a WebVTT file up to 1 MB, beginning with WEBVTT.",
        );
      attachment.caption = {
        name: caption.name,
        url: registerUrl(
          new Blob([await caption.text()], { type: "text/vtt" }),
        ),
      };
    }
  }
  attachment.url = registerUrl(file);
  return attachment;
}
