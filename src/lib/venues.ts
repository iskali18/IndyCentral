// Known venues -> Google Maps link. Keyed by the venue name exactly as it
// appears on the site (i.e. after the "Venue:" override or the default
// comma-split simplification of the Calendar location — see eventParser.ts).
//
// Add a venue here once; every event at that venue picks up the map link
// automatically, no matter how many times it recurs. For a one-off venue
// that isn't worth adding here, put a "Map URL:" line directly in that
// specific Calendar event's description instead — the site checks this
// file first, and only falls back to a per-event "Map URL:" line for
// venues not listed here.

export const VENUE_MAP_LINKS: Record<string, string> = {
  // "Hilbert Circle Theatre": "https://maps.app.goo.gl/REPLACE_ME",
};
