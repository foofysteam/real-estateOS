import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/** Normalise a free-form phone number to E.164, or null when it is not a valid number. */
export function normalizePhone(raw: string, defaultRegion: CountryCode = "IN"): string | null {
  const parsed = parsePhoneNumberFromString(raw, defaultRegion);
  return parsed?.isValid() ? parsed.number : null;
}

/** WhatsApp click-to-chat link; wa.me wants the number without the leading "+". */
export function toWaLink(e164: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}`;
}

export function toTelLink(e164: string): string {
  return `tel:${e164}`;
}
