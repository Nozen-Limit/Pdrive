import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhilippinePhone as normalize,
  formatPhilippinePhone as format,
} from "../src/lib/philippine-phone.js";
test("Philippine phone validation accepts mobile/landline formats and stores one international value", () => {
  for (const input of [
    "09123456789",
    "0912 345 6789",
    "+63 912 345 6789",
    "+639123456789",
  ])
    assert.equal(normalize(input), "+639123456789");
  assert.equal(normalize("(02) 8123 4567"), "+63281234567");
  assert.equal(format("09123456789"), "+63 912 345 6789");
  assert.equal(normalize(""), "");
  for (const input of [
    "123",
    "0912345678",
    "091234567890",
    "+1 202 555 0100",
    "phone: 09123456789",
    "09123456789 ext 1",
    "++639123456789",
    "11111111111",
  ])
    assert.throws(() => normalize(input), /valid Philippine/);
  assert.equal(
    format("old invalid value"),
    "old invalid value",
    "existing invalid values remain visible for correction",
  );
});
