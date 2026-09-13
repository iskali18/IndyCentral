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
  topLine: string; // weekday or weekday range; "" when not computed (long span / Display Dates)
  bottomLine: string; // day/date range, or the raw Display Dates string
  inlineLabel: string; // compact single-line form used for series legs
}

// A single displayable item: either a standalone event or a grouped series.
export interface StandaloneItem {
  kind: "standalone";
  id: string;
  title: string;
  description: string;
  location: string;
  categories: Category[];
  officialUrl?: string;
  timeLabel: string | null;
  date: FormattedDate;
  sortKey: string; // startISO, used for chronological sort + month grouping
}

export interface SeriesLeg {
  id: string;
  title: string;
  description: string;
  location: string;
  categories: Category[];
  officialUrl?: string;
  timeLabel: string | null;
  date: FormattedDate;
  sortKey: string;
}

export interface SeriesGroupItem {
  kind: "series";
  seriesName: string; // display capitalization
  location: string; // taken from the earliest active/upcoming leg
  legs: SeriesLeg[]; // active/upcoming legs only, chronological
  categories: Category[]; // union across displayed legs
  sortKey: string; // next active leg's sortKey
}

export type DisplayItem = StandaloneItem | SeriesGroupItem;

export interface MonthGroup {
  label: string; // e.g. "October 2026"
  items: DisplayItem[];
}
