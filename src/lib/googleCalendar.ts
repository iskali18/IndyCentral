import type { RawCalEvent } from "./types";

const TIME_ZONE = "America/Indiana/Indianapolis";

// How far back/forward we fetch. This is intentionally wider than "today
// onward" for two reasons:
//  1. A multi-day event that started before today but hasn't ended yet
//     (e.g. a festival running Sept 26–Nov 1, viewed on Oct 15) still
//     needs to show up. Google's timeMin filters by an event's END time,
//     not its start time, so timeMin = now already handles this — but
//     only if we don't ALSO restrict the start side too tightly.
//  2. The series "singleton typo" check needs to see a series' already-
//     expired legs too, to tell a real typo (only ever one entry) apart
//     from a series that's naturally wound down to its last leg. So we
//     fetch a window that includes recent past events, then filter
//     expired ones out ourselves later in the pipeline — not at the
//     Google API level.
const PAST_WINDOW_DAYS = 365;
const FUTURE_WINDOW_DAYS = 730;

function isoWithOffsetPlaceholder(d: Date): string {
  // Google's timeMin/timeMax require an RFC3339 timestamp with an offset.
  // We just use UTC ("Z") here — it only defines the fetch window, not
  // how individual event times are displayed (that's controlled by the
  // timeZone param below, which the API applies to each event's start/end).
  return d.toISOString();
}

export interface GoogleCalendarFetchResult {
  entries: RawCalEvent[];
  ok: boolean;
  error?: string;
}

export async function fetchCalendarEvents(): Promise<GoogleCalendarFetchResult> {
  const calendarId = import.meta.env.GOOGLE_CALENDAR_ID;
  const apiKey = import.meta.env.GOOGLE_CALENDAR_API_KEY;

  if (!calendarId || !apiKey) {
    return {
      entries: [],
      ok: false,
      error: "Missing GOOGLE_CALENDAR_ID or GOOGLE_CALENDAR_API_KEY environment variable.",
    };
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() - PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + FUTURE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const entries: RawCalEvent[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      );
      url.searchParams.set("key", apiKey);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("timeZone", TIME_ZONE);
      url.searchParams.set("timeMin", isoWithOffsetPlaceholder(timeMin));
      url.searchParams.set("timeMax", isoWithOffsetPlaceholder(timeMax));
      url.searchParams.set("maxResults", "2500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString());

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          entries: [],
          ok: false,
          error: `Google Calendar API ${res.status} ${res.statusText}: ${body.slice(0, 500)}`,
        };
      }

      const data = await res.json();
      for (const item of data.items ?? []) {
        if (item.status === "cancelled") continue;
        entries.push({
          id: item.id,
          summary: item.summary,
          description: item.description,
          location: item.location,
          start: item.start ?? {},
          end: item.end ?? {},
        });
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return { entries, ok: true };
  } catch (err) {
    return {
      entries: [],
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error fetching Google Calendar.",
    };
  }
}

export { TIME_ZONE };
