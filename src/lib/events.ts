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
 * Fetches and processes the Calendar data for the homepage (the site's one
 * real page right now — see readme.md for the current launch scope).
 *
 * This does NOT need its own request-level cache: Vercel's ISR (configured
 * in astro.config.mjs) caches the rendered HTML at the edge for 30 minutes,
 * so most visits never re-run this function at all.
 */
export async function getEventsData(): Promise<EventsData> {
  const { entries, ok, error } = await fetchCalendarEvents();

  if (!ok) {
    return { ok: false, error, monthGroups: [], flatSorted: [] };
  }

  const { monthGroups, flatSorted } = runPipeline(entries);
  return { ok: true, monthGroups, flatSorted };
}
