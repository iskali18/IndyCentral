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
Venue: Custom venue name (rarely needed)
Series: Optional Series Name
Display Dates: Nov. 21–Dec. 24
Recurrence: Wed–Sun
Display Time: 2 PM–close
Schedule Note: Special hours Nov. 25 and Dec. 21–24 · Closed Nov. 26
_Hidden Closed Dates: Nov 26
```

**The standard set for a normal event is just: description text, `Categories`,
`Official URL`, and `Display Dates`/`Display Time` only when the automatic
computation gets it wrong.** Everything below that is a rare-case override —
most events will never use `Venue`, `Recurrence`, `Schedule Note`, or
`_Hidden Closed Dates` at all. Not extra ticketing/admission detail — that's
handled by whatever the description text or the `Official URL` link
already covers, not a dedicated field.

### Fields that show up on the page

- `Categories` — one or more of: Concerts & Music, Festivals, Arts & Culture,
  Fall & Halloween, Holiday, Family, Food & Drink (separated by `|`).
  Rendered as colored badges.
- `Official URL` — the event's CTA link. If omitted, no CTA is shown.
- `Venue` — overrides the venue name shown on the site. By default, the
  site uses everything before the first comma in the Calendar event's
  Location field, plus the city from the address. For example,
  "Nickel Plate District Amphitheater, 6 Municipal Dr, Fishers, IN 46038,
  USA" shows as "Nickel Plate District Amphitheater, Fishers". The city is
  the part just before the state ("IN" or "IN 46038"). It's left off when
  the venue name already includes it ("Indianapolis Zoo"), or when the
  Location has no state in it. A `Venue:` line is shown exactly as typed,
  with no city added, so type the city yourself if you want one there.
  Only add this line if the default produces the wrong result.
- `Series` — ties multiple Calendar entries together with a shared series
  name, shown as its own line in that event's metadata (e.g. "Indianapolis
  Symphony Orchestra Film Series"). Only use this for a multi-leg /
  non-contiguous run (e.g. a film series). A continuous single-run event
  stays one Calendar entry with no `Series` line.
- `Map URL` — a Google Maps link for the venue, shown by making the venue
  name in the metadata line clickable. For a venue that recurs often
  (a theater, a park), add it to `src/lib/venues.ts` once instead — that
  file is checked first, and this line is only a fallback for a one-off
  venue not worth adding there. For a multi-venue event (a festival
  across several theaters), separate the venues with " · " in `Venue:` —
  each one is looked up in `venues.ts` independently, so a combined
  string still links whichever of its venues are already in that file
  (`Map URL` itself only applies when there's a single venue).
- `Display Dates` — overrides the date badge's text. Only needed on the
  rare event where the Calendar's actual start/end wouldn't display
  correctly on its own (the badge is otherwise computed automatically).
  Put ONLY a plain date range here (e.g. "Nov. 21–Dec. 24") — never a
  weekday or schedule info; that belongs in `Recurrence` / `Display Time`.
- `Recurrence` — the "which days" part of the metadata line (e.g.
  "Wed–Sun", "Select nights"). For a single-day event or a short (2-3 day)
  span, this is derived automatically from the Calendar dates and usually
  doesn't need to be set. For a longer span that only runs certain days
  each week (e.g. a festival open Wed–Sun across a 5-week run), the
  Calendar's start/end alone can't express that — set this explicitly.
  To turn the automatic weekday range off entirely for a short event (e.g.
  when `Display Time` already spells out each day individually, like
  "Fri Oct 30, 7 PM · Sat Oct 31, 2 PM"), add the line with nothing after
  the colon — just `Recurrence:` — rather than leaving it out.
- `Display Time` — the time portion of the metadata line. Free text, so a
  genuinely complex schedule (different hours on different days) can just
  be written out in full here, e.g. "Wed–Thu. 4–9 PM · Fri–Sat. noon–9 PM
  · Sun. noon–8 PM" — it'll still combine correctly with Venue on one line.
- `Schedule Note` — a second, smaller line shown below the main metadata,
  for a short important detail that doesn't fit the normal fields: a
  holiday closure, special hours, or similar. Free text, shown as-is with
  a "Notice" badge in front of it.

### Fields that do NOT show up on the page

Any field name starting with `_` (underscore) never appears anywhere on
the page — it's internal data only. Right now there's one:

- `_Hidden Closed Dates` — comma-separated dates this event does NOT run,
  within its overall start/end range (e.g. "Nov 26" or "Dec 25, 2026" —
  year is optional, inferred from the event's own start year if left
  off). It only tells the site's date filter to correctly exclude that
  day, even though it falls inside the event's overall range. If you also
  want visitors to see the closure, say so separately in `Schedule Note`
  — the two fields don't read from each other. Must match the "Mon D"
  format exactly or it's skipped with a console warning.

## Editorial images on the Events page

Everything here is edited directly in `src/lib/editorialImages.ts`. Image
files go in `/public/images/editorial/`. None of it is tied to Calendar
data, and none of it affects filtering, sorting, or which events show up.

**Images between events.** Each entry needs: `src` (path under
`/public/images/editorial/`), `alt`, `beforeEventTitle` (the exact title of
the event/series it should appear above), and optionally `caption` and
`position` (which part of the photo stays in view when it's cropped, e.g.
`"center 30%"`). The image sits directly above the event it names, so it
reads as belonging with that event. If that event is filtered out, its
image is hidden with it. If it expires and drops off the site, the image
stops appearing too.

**Hero image.** `heroImage` in the same file is one optional wide photo
that becomes a full-width band at the top of the page. The "Indianapolis
Events" heading and intro sit on top of it in white, over a tint that keeps
them readable on any photo. It isn't attached to any event, so it always
shows regardless of filters. It takes `src`, `alt`, and optionally
`position` (which part of the photo stays in view) and `caption` (small
italic text in the bottom-right corner, handy for a photo credit). Leave it
`undefined` and the top of the page falls back to a plain heading and intro.

## Setup

1. Add environment variables (see `.env.example`): `GOOGLE_CALENDAR_ID`,
   `GOOGLE_CALENDAR_API_KEY`. Set these in Vercel, not in a committed file.
2. Deploy to Vercel (Astro preset, server output with ISR — already
   configured in `astro.config.mjs`).

## Notes

- The homepage (`/`) IS the full events listing — there's no separate
  marketing homepage yet. Things to Do, individual event pages, venue
  pages, etc. are intentionally not built. Once a second real section
  exists, the homepage can become a proper landing page again with its
  own hero and teasers into each section.
- Category validation and series "singleton" warnings (likely typos) log
  to the server console — check Vercel's function logs if events seem to
  be missing categories or you suspect a Series typo.
