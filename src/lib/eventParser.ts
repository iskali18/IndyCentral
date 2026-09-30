import type { RawCalEvent, Category, DisplayItem, StandaloneItem } from "./types";
import { CANONICAL_CATEGORIES } from "./types";
import {
  computeBadgeDate,
  formatClockTime,
  datePartOf,
  monthGroupLabel,
} from "./dateFormat";
import { TIME_ZONE } from "./googleCalendar";

import { VENUE_MAP_LINKS } from "./venues";

const META_KEYS = [
  "Categories",
  "Official URL",
  "Series",
  "Display Dates",
  "Display Time",
  "Venue",
  "Recurrence",
  "Schedule Note",
  "_Hidden Closed Dates",
  "Map URL",
] as const;

interface RawMeta {
  Categories?: string;
  "Official URL"?: string;
  Series?: string;
  "Display Dates"?: string;
  "Display Time"?: string;
  Venue?: string;
  Recurrence?: string;
  "Schedule Note"?: string;
  "_Hidden Closed Dates"?: string;
  "Map URL"?: string;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Google Calendar's description field is not plain text. Depending on how
// it was entered, it can contain: <br> tags instead of real line breaks,
// paragraphs wrapped in <p>/<div>, auto-linkified URLs as <a href="...">,
// stray formatting <span>/<b>/<font> wrappers, and leftover &nbsp;/&amp;
// entities (sometimes trailing at the very end of the text). Any one of
// these left unhandled can make a metadata line silently fail to match —
// so the whole description is normalized down to clean, plain,
// newline-separated text in one pass BEFORE any line-based parsing.
function normalizeCalendarDescription(raw: string): string {
  let s = raw;
  // Block-level boundaries -> real newlines.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li)>/gi, "\n");
  s = s.replace(/<(p|div|li|ul|ol)[^>]*>/gi, "");
  // Links -> just the URL (covers "Official URL:" and any other link;
  // auto-linkified text and the href are identical in the normal case).
  s = s.replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>.*?<\/a>/gi, "$1");
  // Any remaining tags (span, b, i, u, font, etc.) — drop the tag, keep
  // whatever text is inside it.
  s = s.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(s);
}

function parseMetadata(description: string): { meta: RawMeta; cleanedDescription: string } {
  const normalized = normalizeCalendarDescription(description || "");
  const lines = normalized.split(/\r?\n/);
  const meta: RawMeta = {};
  let cutIndex = lines.length;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === "") {
      cutIndex = i;
      continue;
    }
    const match = line.match(
      /^(Categories|Official URL|Series|Display Dates|Display Time|Venue|Recurrence|Schedule Note|Map URL|_Hidden Closed Dates)\s*:\s*(.*)$/i
    );
    if (match) {
      const key = META_KEYS.find((k) => k.toLowerCase() === match[1].toLowerCase())!;
      (meta as Record<string, string>)[key] = match[2].trim();
      cutIndex = i;
    } else {
      break;
    }
  }

  const cleaned = lines.slice(0, cutIndex).join("\n").trim();
  return { meta, cleanedDescription: cleaned };
}

// Parses "_Hidden Closed Dates: Nov 26, Dec 25" into ["2026-11-26", "2026-12-25"].
// Requires a strict "Mon D" or "Mon D, YYYY" format (year inferred from the
// event's own start year if omitted) — this field drives the date filter
// directly, so it needs to be reliably machine-readable, unlike the free-text
// "Schedule Note" field used for display.
const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function parseClosedDates(raw: string | undefined, eventTitle: string, startISO: string): string[] {
  if (!raw) return [];
  const defaultYear = datePartOf(startISO).y;
  const result: string[] = [];

  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const match = part.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
    const month = match ? MONTH_NAMES[match[1].toLowerCase()] : undefined;
    if (!match || !month) {
      console.warn(
        [
          "Invalid IndyCentral _Hidden Closed Dates entry:",
          `Event: "${eventTitle}"`,
          `Entry: "${part}"`,
          'Expected a format like "Nov 26" or "Dec 25, 2026".',
        ].join("\n")
      );
      continue;
    }
    const year = match[3] ? Number(match[3]) : defaultYear;
    const day = Number(match[2]);
    result.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }

  return result;
}

function validateCategories(raw: string | undefined, eventTitle: string, startISO: string): Category[] {
  if (!raw) return [];
  const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
  const valid: Category[] = [];

  for (const part of parts) {
    const match = CANONICAL_CATEGORIES.find((c) => c === part);
    if (match) {
      valid.push(match);
    } else {
      console.warn(
        [
          "Invalid IndyCentral event category:",
          `Event: "${eventTitle}"`,
          `Start: ${startISO.split("T")[0]}`,
          `Category: "${part}"`,
          "Expected one of:",
          CANONICAL_CATEGORIES.join(", "),
        ].join("\n")
      );
    }
  }
  return valid;
}

const MONTH_WORD_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\b/gi;

// A Display Dates override should reduce to nothing but month names, day
// numbers, and basic punctuation once those are stripped out. Anything left
// over — a weekday name, "closed", "special hours", etc. — means schedule
// or exception info got left in a field that's supposed to be dates only.
function looksLikePureDateRange(s: string): boolean {
  const stripped = s
    .replace(MONTH_WORD_PATTERN, "")
    .replace(/[0-9]/g, "")
    .replace(/[\s,.;\-\u2013\u2014]/g, "");
  return stripped.length === 0;
}

function warnIfDisplayDatesLooksLikeRecurrence(title: string, startISO: string, displayDates: string | undefined) {
  if (!displayDates || looksLikePureDateRange(displayDates)) return;
  console.warn(
    [
      "Possible IndyCentral Display Dates mistake:",
      `Event: "${title}"`,
      `Start: ${startISO.split("T")[0]}`,
      `Display Dates: "${displayDates}"`,
      "This has more than just dates in it (a weekday, a closure note,",
      "special hours, etc).",
      'Display Dates should be pure dates only (e.g. "Oct. 1\u201325" or',
      '"Nov. 21\u2013Dec. 24") \u2014 put weekday patterns in "Recurrence:" and',
      'exceptions/closures in "Schedule Note:" instead.',
    ].join("\n")
  );
}

// ── Resolve start/end from a raw Calendar entry ────────────────────────────
interface ResolvedDates {
  isAllDay: boolean;
  startISO: string;
  endInclusiveISO: string; // adjusted for all-day exclusive end
  endExclusiveISO: string; // raw Google value, used for expiration checks
}

function resolveDates(entry: RawCalEvent): ResolvedDates {
  const isAllDay = !!entry.start.date && !entry.start.dateTime;

  if (isAllDay) {
    const startISO = entry.start.date!;
    const endExclusiveISO = entry.end.date ?? entry.start.date!;
    // Google's all-day end.date is exclusive — subtract one day for display.
    const { y, m, d } = datePartOf(endExclusiveISO);
    const inclusive = new Date(Date.UTC(y, m - 1, d - 1));
    const endInclusiveISO = inclusive.toISOString().split("T")[0];
    return { isAllDay: true, startISO, endInclusiveISO, endExclusiveISO };
  }

  const startISO = entry.start.dateTime!;
  const endExclusiveISO = entry.end.dateTime ?? entry.start.dateTime!;
  return { isAllDay: false, startISO, endInclusiveISO: endExclusiveISO, endExclusiveISO };
}

function currentIndyISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

interface FullEntry {
  id: string;
  title: string;
  description: string;
  location: string;
  venueParts: { text: string; href?: string; suffix?: string }[];
  categories: Category[];
  officialUrl?: string;
  seriesRaw?: string;
  seriesNormalized?: string;
  seriesDisplay?: string;
  displayDates?: string;
  displayTime?: string;
  recurrenceOverride?: string;
  scheduleNote?: string;
  closedDates: string[];
  isAllDay: boolean;
  startISO: string;
  endInclusiveISO: string;
  endExclusiveISO: string;
}

export interface PipelineResult {
  monthGroups: { label: string; items: DisplayItem[] }[];
  flatSorted: DisplayItem[];
}

// A venue string can be a single venue or several joined with " · " (e.g. a
// multi-venue festival: "Alamo Drafthouse Cinema · Newfields · ..."). Each
// individual venue gets its own independent lookup, so a combined string
// still picks up map links for whichever of its venues are in venues.ts.
// Pulls the city out of a Google-style Location, e.g.
// "Nickel Plate District Amphitheater, 6 Municipal Dr, Fishers, IN 46038, USA"
// -> "Fishers". The city is the piece just before the state ("IN" or
// "IN 46038"). If there's no state in the Location (a hand-typed "Carter
// Green, Carmel", say), no city is returned.
function cityFromLocation(location: string): string | undefined {
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  const stateIndex = parts.findIndex((p, i) => i >= 2 && /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p));
  if (stateIndex === -1) return undefined;
  const city = parts[stateIndex - 1];
  if (!city || /^\d/.test(city)) return undefined; // a street address, not a city
  return city;
}

function resolveVenueParts(
  simplifiedVenue: string,
  mapUrlOverride: string | undefined,
  city?: string
): { text: string; href?: string; suffix?: string }[] {
  const names = simplifiedVenue
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);

  if (names.length <= 1) {
    // Add the city after the venue name, unless the name already has it
    // ("Indianapolis Zoo" stays as is).
    const showCity = city && !simplifiedVenue.toLowerCase().includes(city.toLowerCase());
    return [{
      text: simplifiedVenue,
      href: VENUE_MAP_LINKS[simplifiedVenue] || mapUrlOverride || undefined,
      suffix: showCity ? `, ${city}` : undefined,
    }];
  }
  // A per-event "Map URL:" override doesn't make sense across several
  // different venues at once, so it only applies in the single-venue case.
  return names.map((name) => ({ text: name, href: VENUE_MAP_LINKS[name] || undefined }));
}

export function runPipeline(rawEntries: RawCalEvent[]): PipelineResult {
  // ── Parse metadata + validate categories ─────────────────────────────────
  const parsed: FullEntry[] = rawEntries.map((raw) => {
    const { meta, cleanedDescription } = parseMetadata(raw.description || "");
    const dates = resolveDates(raw);
    const categories = validateCategories(meta.Categories, raw.summary || "Untitled event", dates.startISO);
    warnIfDisplayDatesLooksLikeRecurrence(raw.summary || "Untitled event", dates.startISO, meta["Display Dates"]);

    // Google Calendar locations are typically "Venue Name, Street, City, ST
    // ZIP, Country" (from Places autocomplete). Default to just the venue
    // name; a "Venue:" metadata line overrides this for the rare case where
    // that heuristic doesn't produce the right result.
    const simplifiedVenue = meta.Venue || (raw.location || "").split(",")[0].trim();
    // The city comes from the Location only when there's no "Venue:" line.
    // A "Venue:" line is shown exactly as typed.
    const city = meta.Venue ? undefined : cityFromLocation(raw.location || "");
    const venueParts = resolveVenueParts(simplifiedVenue, meta["Map URL"], city);

    return {
      id: raw.id,
      title: raw.summary || "Untitled event",
      description: cleanedDescription,
      location: simplifiedVenue,
      venueParts,
      categories,
      officialUrl: meta["Official URL"] || undefined,
      seriesRaw: meta.Series || undefined,
      seriesNormalized: undefined,
      seriesDisplay: undefined,
      displayDates: meta["Display Dates"] || undefined,
      displayTime: meta["Display Time"] || undefined,
      // Preserve the distinction between "not set" (undefined, so it
      // auto-computes below) and "set but empty" (an explicit way to
      // suppress the auto-computed value entirely — see runPipeline).
      recurrenceOverride: meta.Recurrence,
      scheduleNote: meta["Schedule Note"] || undefined,
      closedDates: parseClosedDates(meta["_Hidden Closed Dates"], raw.summary || "Untitled event", dates.startISO),
      ...dates,
    };
  });

  // ── Normalize Series values, preserving first-seen display casing ────────
  const seriesDisplayByKey = new Map<string, string>();
  for (const e of parsed) {
    if (!e.seriesRaw) continue;
    const normalized = e.seriesRaw.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();
    if (!seriesDisplayByKey.has(key)) seriesDisplayByKey.set(key, normalized);
    e.seriesNormalized = key;
    e.seriesDisplay = seriesDisplayByKey.get(key);
  }

  // ── Singleton series warning (against the FULL fetched dataset) ──────────
  const seriesCounts = new Map<string, number>();
  for (const e of parsed) {
    if (!e.seriesNormalized) continue;
    seriesCounts.set(e.seriesNormalized, (seriesCounts.get(e.seriesNormalized) || 0) + 1);
  }
  for (const e of parsed) {
    if (!e.seriesNormalized) continue;
    if (seriesCounts.get(e.seriesNormalized) === 1) {
      console.warn(
        [
          "Possible IndyCentral series typo or unnecessary Series value:",
          `Event: "${e.title}"`,
          `Start: ${e.startISO.split("T")[0]}`,
          `Series: "${e.seriesDisplay}"`,
          "Only 1 active/upcoming Calendar entry uses this normalized Series value.",
        ].join("\n")
      );
    }
  }

  // ── Remove expired entries ────────────────────────────────────────────────
  const now = currentIndyISO();
  const active = parsed.filter((e) => e.endExclusiveISO > now);

  // ── Format dates ───────────────────────────────────────────────────────────
  const withDates = active.map((e) => ({
    ...e,
    badgeDate: computeBadgeDate(e.startISO, e.endInclusiveISO, e.displayDates),
    // An explicit empty "Recurrence:" line means "suppress the auto-computed
    // weekday range" — useful when Display Time already spells out each
    // day individually and a "Fri–Sun" prefix would just be redundant.
    recurrence: e.recurrenceOverride || "",
    timeLabel: e.displayTime || (e.isAllDay ? null : formatClockTime(e.startISO)),
  }));

  // ── Build display items ───────────────────────────────────────────────────
  // Every entry becomes the exact same row shape — a multi-leg series isn't
  // a special case, it's just several rows that happen to share a series
  // name, which gets folded into the metadata line alongside the venue.
  const displayItems: DisplayItem[] = withDates.map((e) => ({
    kind: "standalone",
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    venueParts: e.venueParts,
    seriesName: e.seriesDisplay,
    categories: e.categories,
    officialUrl: e.officialUrl,
    timeLabel: e.timeLabel,
    recurrence: e.recurrence,
    scheduleNote: e.scheduleNote,
    closedDates: e.closedDates,
    date: e.badgeDate,
    sortKey: e.startISO,
    endISO: e.endInclusiveISO,
  }));

  // ── Sort everything chronologically ───────────────────────────────────────
  displayItems.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  // ── Group into dynamic month headings ─────────────────────────────────────
  const monthGroups: { label: string; items: DisplayItem[] }[] = [];
  for (const item of displayItems) {
    const label = monthGroupLabel(item.sortKey);
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      monthGroups.push({ label, items: [item] });
    }
  }

  return { monthGroups, flatSorted: displayItems };
}
