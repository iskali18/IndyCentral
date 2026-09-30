// Shape of the fields we actually use from a Google Calendar API event resource.
// (The real response has many more fields — we only type what we read.)
export interface RawCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

export const CANONICAL_CATEGORIES = [
  "Concerts & Music",
  "Festivals",
  "Arts & Culture",
  "Fall & Halloween",
  "Holiday",
  "Family",
  "Food & Drink",
] as const;

export type Category = (typeof CANONICAL_CATEGORIES)[number];

export interface ParsedMeta {
  categories: Category[];
  officialUrl?: string;
  series?: string;
  seriesNormalized?: string;
  displayDates?: string;
  displayTime?: string;
}

// A single Calendar entry after date parsing + metadata parsing, before
// grouping. This is either a standalone event or one leg of a series.
export interface ParsedEntry {
  id: string;
  title: string;
  description: string; // metadata lines stripped out
  location: string;
  categories: Category[];
  officialUrl?: string;
  series?: string; // normalized series name (display capitalization), if any
  displayTimeRaw?: string;
  // Resolved start/end instants used for sorting + expiration checks.
  // For all-day events these are date-only; startExclusiveEnd holds the
  // raw (exclusive) Google end.date so expiration checks stay correct
  // even though display uses an inclusive end date.
  isAllDay: boolean;
  startISO: string; // YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, Indianapolis local
  endISO: string; // inclusive end, for display/formatting
  endExclusiveISO: string; // raw Google end value, for expiration checks
  timeLabel: string | null; // formatted start time, or null if all-day/no time
}

export interface FormattedDate {
  topLine: string; // month abbreviation, all-caps, e.g. "SEP" — "" when Display Dates overrides
  bottomLine: string; // day / day-range, e.g. "26", "23–NOV 1"
}

// A single displayable event row. Every event uses this exact same shape —
// a multi-leg series is not a special case: each leg is just its own row,
// with the series name folded into the metadata line alongside the venue.
export interface StandaloneItem {
  kind: "standalone";
  id: string;
  title: string;
  description: string;
  location: string;
  venueParts: { text: string; href?: string; suffix?: string }[]; // one or more venues (multi-venue events join several); suffix is plain text after the name, e.g. ", Fishers"
  seriesName?: string; // e.g. "Indianapolis Symphony Orchestra Film Series", if this is one leg of a series
  categories: Category[];
  officialUrl?: string;
  timeLabel: string | null;
  recurrence: string; // e.g. "Wed–Sun", "Sat", "" if not applicable
  scheduleNote?: string; // e.g. "Special hours Nov. 25 and Dec. 21–24 · Closed Nov. 26"
  closedDates: string[]; // ISO dates (YYYY-MM-DD) this event does NOT run, within its overall range
  date: FormattedDate;
  sortKey: string; // startISO, used for chronological sort + month grouping
  endISO: string; // endInclusiveISO, used for date-range filtering
}

export type DisplayItem = StandaloneItem;

export interface MonthGroup {
  label: string; // e.g. "October 2026"
  items: DisplayItem[];
}
