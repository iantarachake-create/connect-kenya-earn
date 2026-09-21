// Kenyan phone helpers. Accepts 0111385747, 0711385747, +254111385747,
// 254711385747 and 711385747 / 111385747.
export function normalizeKenyanPhone(input: string): string | null {
  const digits = (input ?? "").replace(/[^\d]/g, "");
  let local = "";
  if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^[17]\d{8}$/.test(digits)) local = digits;
  else return null;
  return `254${local}`;
}

/** 0-prefixed local format, e.g. 0111385747 — what Kenyan providers display. */
export function toLocalKenyanPhone(input: string): string | null {
  const intl = normalizeKenyanPhone(input);
  return intl ? `0${intl.slice(3)}` : null;
}

export const KENYAN_PHONE_HINT = "Use 0111385747, 0711385747 or +254111385747";
