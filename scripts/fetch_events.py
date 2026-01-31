import json
import os
import re
from datetime import datetime, timedelta, timezone
import urllib.parse
import urllib.request
from urllib.error import HTTPError

API_KEY = (os.getenv("TICKETMASTER_API_KEY") or "").strip()

LAT = float(os.getenv("INDY_LAT", "39.7684"))
LON = float(os.getenv("INDY_LON", "-86.1581"))
RADIUS = int(os.getenv("RADIUS_MILES", "35"))
DAYS = int(os.getenv("DAYS_AHEAD", "180"))

OUT_FILE = "data/events.json"
ALLOWLIST_FILE = "data/venues_allowlist.json"


def tm_utc_z(dt: datetime) -> str:
    """Ticketmaster wants UTC timestamps like 2026-01-30T12:34:56Z."""
    dt = dt.astimezone(timezone.utc).replace(microsecond=0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")[:90] or "event"


def load_allowlist() -> set[str]:
    try:
        with open(ALLOWLIST_FILE, "r", encoding="utf-8") as f:
            items = json.load(f)
            return {str(x).strip() for x in items if str(x).strip()}
    except FileNotFoundError:
        return set()
    except Exception:
        return set()


def build_url(start_utc: datetime, end_utc: datetime) -> str:
    base = "https://app.ticketmaster.com/discovery/v2/events.json"
    params = {
        "apikey": API_KEY,
        "latlong": f"{LAT},{LON}",
        "radius": str(RADIUS),
        "unit": "miles",
        "classificationName": "music",
        "sort": "date,asc",
        "size": "200",
        "startDateTime": tm_utc_z(start_utc),
        "endDateTime": tm_utc_z(end_utc),
    }
    return base + "?" + urllib.parse.urlencode(params)


def fetch() -> dict:
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=DAYS)
    url = build_url(now, end)

    req = urllib.request.Request(url, headers={"User-Agent": "IndyCentralMVP/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        # Print response body for debugging (Ticketmaster usually returns JSON explaining the issue)
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = "(no response body)"
        raise RuntimeError(f"Ticketmaster HTTP {e.code} {e.reason}\nURL: {url}\nBODY:\n{body}") from e


def main():
    if not API_KEY:
        raise RuntimeError("Missing TICKETMASTER_API_KEY (GitHub Secret name must be exactly TICKETMASTER_API_KEY).")

    allowlist = load_allowlist()

    raw = fetch()
    events_out = []

    for e in raw.get("_embedded", {}).get("events", []):
        venues = e.get("_embedded", {}).get("venues", [])
        if not venues:
            continue
        venue_obj = venues[0]
        venue_name = venue_obj.get("name", "").strip()

        # Strict MVP filter: if allowlist file has entries, only include those venues.
        if allowlist and venue_name not in allowlist:
            continue

        name = e.get("name", "Event")
        start = (e.get("dates", {}) or {}).get("start", {}) or {}
        local_date = start.get("localDate", "") or ""
        local_time = start.get("localTime", "") or ""
        date_time_utc = start.get("dateTime", "") or ""

        if local_date and local_time:
            date_display = f"{local_date} {local_time}"
        else:
            date_display = local_date or date_time_utc or ""

        city = (venue_obj.get("city") or {}).get("name", "") or ""
        state = (venue_obj.get("state") or {}).get("stateCode", "") or ""

        url = e.get("url", "") or ""
        event_id = str(e.get("id", "") or "")

        slug_base = slugify(f"{name}-{venue_name}-{local_date}")
        slug = f"{slug_base}-{event_id[-6:]}" if event_id else slug_base

        events_out.append({
            "id": event_id,
            "name": name,
            "url": url,
            "dateLocal": date_time_utc or local_date,
            "dateDisplay": date_display,
            "city": city,
            "state": state,
            "venueName": venue_name,
            "venueUrl": venue_obj.get("url"),
            "venueId": venue_obj.get("id"),
            "slug": slug,
            "source": "ticketmaster"
        })

    output = {
        "generatedAt": tm_utc_z(datetime.now(timezone.utc)),
        "market": {
            "label": "Indianapolis, IN metro",
            "lat": LAT,
            "lon": LON,
            "radiusMiles": RADIUS,
            "daysAhead": DAYS
        },
        "count": len(events_out),
        "events": events_out
    }

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
