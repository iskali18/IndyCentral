import type { FormattedDate } from "./types";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
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

function weekdayAbbr(ymd: YMD): string {
  return WEEKDAYS[new Date(ymd.y, ymd.m - 1, ymd.d).getDay()];
}

function monthAbbr(ymd: YMD): string {
  return MONTHS[ymd.m - 1];
}

function daysBetweenInclusive(a: YMD, b: YMD): number {
  const utcA = Date.UTC(a.y, a.m - 1, a.d);
  const utcB = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((utcB - utcA) / 86400000) + 1;
}

function sameMonth(a: YMD, b: YMD): boolean {
  return a.y === b.y && a.m === b.m;
}

/**
 * Computes the date display for one event span (standalone event or one
 * series leg). Returns both a "badge" form (topLine/bottomLine, used for
 * the prominent standalone date block, where month is omitted when it's
 * redundant with the page's month heading) and a single-line inlineLabel
 * (used for series legs, which are never grouped under their own month
 * heading — a leg can sit under a series card headed by a *different*
 * month than the leg itself, e.g. a February leg nested under a series
 * card headed "October" because that's when the *next* leg falls — so
 * the leg's own label always spells out its month).
 */
export function computeFormattedDate(
  startISO: string,
  endInclusiveISO: string,
  displayDatesOverride?: string
): FormattedDate {
  if (displayDatesOverride) {
    return {
      topLine: "",
      bottomLine: displayDatesOverride,
      inlineLabel: displayDatesOverride,
    };
  }

  const start = datePartOf(startISO);
  const end = datePartOf(endInclusiveISO);
  const days = daysBetweenInclusive(start, end);
  const crossMonth = !sameMonth(start, end);

  if (days <= 1) {
    const topLine = weekdayAbbr(start);
    const bottomLine = String(start.d);
    return {
      topLine,
      bottomLine,
      inlineLabel: `${topLine}, ${monthAbbr(start)} ${start.d}`,
    };
  }

  if (days <= 3) {
    const topLine = `${weekdayAbbr(start)}\u2013${weekdayAbbr(end)}`;
    const bottomLine = crossMonth
      ? `${monthAbbr(start)} ${start.d}\u2013${monthAbbr(end)} ${end.d}`
      : `${start.d}\u2013${end.d}`;
    const inlineBottom = crossMonth
      ? bottomLine
      : `${monthAbbr(start)} ${start.d}\u2013${end.d}`;
    return {
      topLine,
      bottomLine,
      inlineLabel: `${topLine}, ${inlineBottom}`,
    };
  }

  // Long span (>3 days), no recurring pattern — no weekday, just the range.
  const bottomLine = crossMonth
    ? `${monthAbbr(start)} ${start.d}\u2013${monthAbbr(end)} ${end.d}`
    : `${monthAbbr(start)} ${start.d}\u2013${end.d}`;
  return { topLine: "", bottomLine, inlineLabel: bottomLine };
}

export function monthGroupLabel(startISO: string): string {
  const { y, m } = datePartOf(startISO);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatClockTime(iso: string): string | null {
  // iso like "2026-10-30T19:00:00-04:00" — no timed component means all-day.
  const timePart = iso.split("T")[1];
  if (!timePart) return null;
  const [hStr, mStr] = timePart.split(":");
  let hour = Number(hStr);
  const min = Number(mStr);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}
