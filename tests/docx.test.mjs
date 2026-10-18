import { test } from "node:test";
import assert from "node:assert/strict";
import { documentXml, DOCUMENT_XML_LIMIT } from "../src/lib/docx.js";
import { docxFixture } from "./docx-fixture.mjs";
test("DOCX preview reads real document text and rejects invalid, huge and entity-bearing archives", async () => {
  assert.match(await documentXml(await docxFixture()), /Lesson text/);
  await assert.rejects(documentXml(new Uint8Array([80, 75, 3, 4, 1])), /./);
  await assert.rejects(
    documentXml(
      await docxFixture('<!DOCTYPE test [<!ENTITY x "bad">]><test>&x;</test>'),
    ),
    /Unsupported/,
  );
  await assert.rejects(
    documentXml(await docxFixture("x".repeat(DOCUMENT_XML_LIMIT + 1))),
    /too large/,
  );
});
