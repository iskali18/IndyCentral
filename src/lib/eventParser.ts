import type {
  RawCalEvent,
  Category,
  DisplayItem,
  StandaloneItem,
  SeriesGroupItem,
  SeriesLeg,
} from "./types";
import { CANONICAL_CATEGORIES } from "./types";
import { computeFormattedDate, formatClockTime, datePartOf, monthGroupLabel } from "./dateFormat";
import { TIME_ZONE } from "./googleCalendar";

const META_KEYS = ["Categories", "Official URL", "Series", "Display Dates", "Display Time", "Venue"] as const;

interface RawMeta {
  Categories?: string;
  "Official URL"?: string;
  Series?: string;
  "Display Dates"?: string;
  "Display Time"?: string;
  Venue?: string;
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
    const match = line.match(/^(Categories|Official URL|Series|Display Dates|Display Time|Venue)\s*:\s*(.*)$/i);
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
          "Concerts & Music, Festivals, Arts & Culture,",
          "Fall & Halloween, Holiday, Family",
        ].join("\n")
      );
    }
  }
  return valid;
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
  categories: Category[];
  officialUrl?: string;
  seriesRaw?: string;
  seriesNormalized?: string;
  seriesDisplay?: string;
  displayDates?: string;
  displayTime?: string;
  isAllDay: boolean;
  startISO: string;
  endInclusiveISO: string;
  endExclusiveISO: string;
}

export interface PipelineResult {
  monthGroups: { label: string; items: DisplayItem[] }[];
  flatSorted: DisplayItem[];
}

export function runPipeline(rawEntries: RawCalEvent[]): PipelineResult {
  // ── Parse metadata + validate categories ─────────────────────────────────
  const parsed: FullEntry[] = rawEntries.map((raw) => {
    const { meta, cleanedDescription } = parseMetadata(raw.description || "");
    const dates = resolveDates(raw);
    const categories = validateCategories(meta.Categories, raw.summary || "Untitled event", dates.startISO);

    // Google Calendar locations are typically "Venue Name, Street, City, ST
    // ZIP, Country" (from Places autocomplete). Default to just the venue
    // name; a "Venue:" metadata line overrides this for the rare case where
    // that heuristic doesn't produce the right result.
    const simplifiedVenue = meta.Venue || (raw.location || "").split(",")[0].trim();

    return {
      id: raw.id,
      title: raw.summary || "Untitled event",
      description: cleanedDescription,
      location: simplifiedVenue,
      categories,
      officialUrl: meta["Official URL"] || undefined,
      seriesRaw: meta.Series || undefined,
      seriesNormalized: undefined,
      seriesDisplay: undefined,
      displayDates: meta["Display Dates"] || undefined,
      displayTime: meta["Display Time"] || undefined,
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
    formattedDate: computeFormattedDate(e.startISO, e.endInclusiveISO, e.displayDates),
    timeLabel: e.displayTime || (e.isAllDay ? null : formatClockTime(e.startISO)),
  }));

  // ── Group by normalized Series ────────────────────────────────────────────
  const standalones = withDates.filter((e) => !e.seriesNormalized);
  const seriesMap = new Map<string, typeof withDates>();
  for (const e of withDates) {
    if (!e.seriesNormalized) continue;
    if (!seriesMap.has(e.seriesNormalized)) seriesMap.set(e.seriesNormalized, []);
    seriesMap.get(e.seriesNormalized)!.push(e);
  }

  const displayItems: DisplayItem[] = [];

  for (const e of standalones) {
    const item: StandaloneItem = {
      kind: "standalone",
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      categories: e.categories,
      officialUrl: e.officialUrl,
      timeLabel: e.timeLabel,
      date: e.formattedDate,
      sortKey: e.startISO,
    };
    displayItems.push(item);
  }

  for (const [, legsRaw] of seriesMap) {
    const legs = [...legsRaw].sort((a, b) => (a.startISO < b.startISO ? -1 : a.startISO > b.startISO ? 1 : 0));
    const seriesLegs: SeriesLeg[] = legs.map((leg) => ({
      id: leg.id,
      title: leg.title,
      description: leg.description,
      location: leg.location,
      categories: leg.categories,
      officialUrl: leg.officialUrl,
      timeLabel: leg.timeLabel,
      date: leg.formattedDate,
      sortKey: leg.startISO,
    }));

    const categoryUnion: Category[] = [];
    for (const leg of seriesLegs) {
      for (const c of leg.categories) {
        if (!categoryUnion.includes(c)) categoryUnion.push(c);
      }
    }

    const group: SeriesGroupItem = {
      kind: "series",
      seriesName: legs[0].seriesDisplay!,
      location: seriesLegs[0].location,
      legs: seriesLegs,
      categories: categoryUnion,
      sortKey: seriesLegs[0].sortKey,
    };
    displayItems.push(group);
  }

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
