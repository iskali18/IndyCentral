import { fetchCalendarEvents } from "./googleCalendar";
import { runPipeline } from "./eventParser";
import type { DisplayItem, MonthGroup } from "./types";

export interface EventsData {
  ok: boolean;
  error?: string;
  monthGroups: MonthGroup[];
  flatSorted: DisplayItem[];
}

/**
 * The one shared entry point both `/` and `/events/` call to get processed
 * event data — same fetch, same parsing/grouping/sorting logic, so the two
 * pages can never disagree about what's active or how it's grouped.
 *
 * This does NOT need its own request-level cache: Vercel's ISR (configured
 * in astro.config.mjs) caches each page's rendered HTML at the edge for 30
 * minutes, so most visits never re-run this function at all. Only a cache
 * miss/expiry triggers a fresh call — and each page render is its own
 * request, so there's nothing to usefully share in-process between them.
 */
export async function getEventsData(): Promise<EventsData> {
  const { entries, ok, error } = await fetchCalendarEvents();

  if (!ok) {
    return { ok: false, error, monthGroups: [], flatSorted: [] };
  }

  const { monthGroups, flatSorted } = runPipeline(entries);
  return { ok: true, monthGroups, flatSorted };
}

/** Homepage preview: next 4–6 display items, series legs limited to 2. */
export function homepagePreview(flatSorted: DisplayItem[], maxItems = 6): DisplayItem[] {
  return flatSorted.slice(0, maxItems).map((item) => {
    if (item.kind === "standalone") return item;
    return { ...item, legs: item.legs.slice(0, 2) };
  });
}
