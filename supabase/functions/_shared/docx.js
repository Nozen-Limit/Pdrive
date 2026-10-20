import { ZipReader, Uint8ArrayReader, configure } from "@zip.js/zip.js";
configure({ useWebWorkers: false });
export const DOCUMENT_XML_LIMIT = 5 * 1024 * 1024;
export async function documentXml(input) {
  if (input.byteLength > 20 * 1024 * 1024)
    throw Error("Document exceeds 20 MB.");
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(input)));
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000);
  try {
    let documentEntry,
      contentTypes = false,
      count = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      if (++count > 3000) throw Error("Too many files in this document.");
      if (entry.filename === "[Content_Types].xml") contentTypes = true;
      if (entry.filename === "word/document.xml") documentEntry = entry;
    }
    if (!documentEntry || !contentTypes)
      throw Error("This is not a Word DOCX document.");
    if (
      documentEntry.encrypted ||
      documentEntry.uncompressedSize > DOCUMENT_XML_LIMIT
    )
      throw Error("Document text is too large or encrypted.");
    const chunks = [];
    let total = 0;
    await documentEntry.getData(
      new WritableStream({
        write(chunk) {
          total += chunk.byteLength;
          if (total > DOCUMENT_XML_LIMIT)
            throw Error("Document text exceeds the preview limit.");
          chunks.push(chunk);
        },
      }),
      { signal: controller.signal, checkSignature: true },
    );
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const xml = new TextDecoder().decode(bytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw Error("Unsupported document XML.");
    return xml;
  } finally {
    clearTimeout(timer);
    await reader.close();
  }
}
