const IST = "Asia/Kolkata";

const ymdFormat = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** The IST calendar day containing `now`, as [start, end) instants. IST has no DST, so a day is always 24 h. */
export function istDayBounds(now: Date): { start: Date; end: Date } {
  const ymd = ymdFormat.format(now); // en-CA formats as YYYY-MM-DD
  const start = new Date(`${ymd}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Wall-clock time in IST, e.g. "5:30 pm". Built from parts so server and browser render the same string. */
export function formatIstTime(d: Date): string {
  const parts = timeFormat.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

const dayMonthFormat = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short" });

/** IST date and time, e.g. "23 Oct, 3:30 pm". Built from parts for the same reason as formatIstTime. */
export function formatIstDateTime(d: Date): string {
  const parts = dayMonthFormat.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")}, ${formatIstTime(d)}`;
}
