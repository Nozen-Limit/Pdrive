import { parsePhoneNumberWithError } from "libphonenumber-js/max";

function parse(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    if (text.length > 40 || !/^[+\d\s().-]+$/.test(text)) throw Error();
    const phone = parsePhoneNumberWithError(text, {
      defaultCountry: "PH",
      extract: false,
    });
    if (phone.country !== "PH" || !phone.isValid() || phone.ext) throw Error();
    return phone;
  } catch {
    throw Error(
      "Enter a valid Philippine phone number, such as 0912 345 6789 or (02) 8123 4567.",
    );
  }
}
export function normalizePhilippinePhone(value) {
  return parse(value)?.number || "";
}
export function formatPhilippinePhone(value) {
  try {
    return parse(value)?.formatInternational() || "";
  } catch {
    return String(value ?? "");
  }
}
