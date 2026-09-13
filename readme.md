# IndyCentral

A curated guide to events and things to do in the Indianapolis metro area.

## How it works

- A private, dedicated Google Calendar is the event database. Every event
  entered into that Calendar (with the metadata format below) appears on
  the site automatically.
- The site fetches the Calendar through its API, expands recurring events,
  and expires past events automatically.
- Pages render on-demand and are cached at Vercel's edge for 30 minutes
  (ISR), so Calendar edits show up without a new deploy.

## Calendar event format

Normal Calendar fields: title, start/end date & time, location,
description.

Optional metadata lines at the END of the description:

```
Categories: Festivals | Fall & Halloween | Family
Official URL: https://example.com/event
Series: Optional Series Name
Display Dates: Oct. 1–25, 2026
Display Time: Thursdays–Sundays, 5–10 p.m.
```

- `Categories` — one or more of: Concerts & Music, Festivals, Arts & Culture,
  Fall & Halloween, Holiday, Family (separated by `|`).
- `Official URL` — the event's CTA link. If omitted, no CTA is shown.
- `Series` — ties multiple Calendar entries ("legs") together into one
  grouped display item. Only use this for multi-leg / non-contiguous
  events (e.g. a film series). A continuous single-run event stays one
  Calendar entry.
- `Display Dates` / `Display Time` — override the automatically computed
  date/time text. Required for events with a recurring pattern the site
  can't compute on its own (e.g. "Wed–Sun, Sept 23–Nov 1").

## Setup

1. Add environment variables (see `.env.example`): `GOOGLE_CALENDAR_ID`,
   `GOOGLE_CALENDAR_API_KEY`. Set these in Vercel, not in a committed file.
2. Deploy to Vercel (Astro preset, server output with ISR — already
   configured in `astro.config.mjs`).

## Notes

- Launch scope is Home (`/`) and Events (`/events/`) only. Things to Do,
  individual event pages, venue pages, etc. are intentionally not built
  yet.
- Category validation and series "singleton" warnings (likely typos) log
  to the server console — check Vercel's function logs if events seem to
  be missing categories or you suspect a Series typo.
