import type { FormattedDate } from "./types";

// Badge convention: all-caps, no periods — a typographic/graphic treatment.
const MONTHS_BADGE = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

export function datePartOf(iso: string): YMD {
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  return { y, m, d };
}

function sameMonth(a: YMD, b: YMD): boolean {
  return a.y === b.y && a.m === b.m;
}

function sameDay(a: YMD, b: YMD): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

/**
 * The date badge: pure dates only, nothing else. Always a two-line split —
 * start month on top, day (or day range, with the end month appended only
 * when the range crosses months) on the bottom. No weekday, no recurrence,
 * no schedule notes — those live in the metadata line instead.
 *
 * displayDatesOverride is a rare escape hatch for when the Calendar's own
 * start/end wouldn't display correctly on its own — it renders as a single
 * unsplit line, exactly as typed.
 */
export function computeBadgeDate(
  startISO: string,
  endInclusiveISO: string,
  displayDatesOverride?: string
): FormattedDate {
  if (displayDatesOverride) {
    return { topLine: "", bottomLine: displayDatesOverride };
  }

  const start = datePartOf(startISO);
  const end = datePartOf(endInclusiveISO);
  const topLine = MONTHS_BADGE[start.m - 1];

  if (sameDay(start, end)) {
    return { topLine, bottomLine: String(start.d) };
  }
  if (sameMonth(start, end)) {
    return { topLine, bottomLine: `${start.d}\u2013${end.d}` };
  }
  return { topLine, bottomLine: `${start.d}\u2013${MONTHS_BADGE[end.m - 1]} ${end.d}` };
}

export function monthGroupLabel(sortKey: string): string {
  const { y, m } = datePartOf(sortKey);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatClockTime(iso: string): string | null {
  // iso like "2026-10-30T19:00:00-04:00" — no timed component means all-day.
  const timePart = iso.split("T")[1];
  if (!timePart) return null;
  const [hStr, mStr] = timePart.split(":");
  const hour = Number(hStr);
  const min = Number(mStr);

  if (hour === 12 && min === 0) return "noon";
  if (hour === 0 && min === 0) return "midnight";

  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return min === 0 ? `${h12} ${ampm}` : `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}
