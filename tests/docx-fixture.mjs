import { ZipWriter, Uint8ArrayWriter, TextReader } from "@zip.js/zip.js";
export async function docxFixture(
  xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Lesson text</w:t></w:r></w:p></w:body></w:document>',
) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  });
  await writer.add("[Content_Types].xml", new TextReader("<Types/>"));
  await writer.add("word/document.xml", new TextReader(xml));
  return writer.close();
}
