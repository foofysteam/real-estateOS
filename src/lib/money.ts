// All money in Sales OS is whole integer rupees.

const UNIT_MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  l: 1e5,
  lakh: 1e5,
  lac: 1e5,
  cr: 1e7,
  crore: 1e7,
};

const RUPEES_PATTERN = /^\s*([\d.,]+)\s*(l|lakh|lac|cr|crore|k)?\s*$/i;

/** Parse "45L", "1.2 crore", "45,00,000" or a number into whole rupees; null when unparseable. */
export function parseRupees(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input) : null;
  }
  const match = RUPEES_PATTERN.exec(input);
  if (!match || !/\d/.test(match[1])) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  const multiplier = match[2] ? UNIT_MULTIPLIERS[match[2].toLowerCase()] : 1;
  return Math.round(amount * multiplier);
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "₹45,00,000" — Indian digit grouping. */
export function formatRupees(rupees: number): string {
  return `₹${rupeeFormatter.format(rupees)}`;
}

const SHORT_UNITS: ReadonlyArray<[number, string]> = [
  [1e7, "Cr"],
  [1e5, "L"],
  [1e3, "K"],
];

/** "₹45L", "₹1.2Cr", "₹50K" — one decimal, trailing ".0" dropped. */
export function formatRupeesShort(rupees: number): string {
  for (const [size, suffix] of SHORT_UNITS) {
    if (Math.abs(rupees) >= size) {
      return `₹${(rupees / size).toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return formatRupees(rupees);
}
