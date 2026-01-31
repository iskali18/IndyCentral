import json
import os
import re
from datetime import datetime, timedelta, timezone
import urllib.parse
import urllib.request

API_KEY = os.getenv("TICKETMASTER_API_KEY")

LAT = 39.7684
LON = -86.1581
RADIUS = 35
DAYS = 180

OUT_FILE = "data/events.json"
ALLOWLIST_FILE = "data/venues_allowlist.json"


def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    return text.strip("-")


def load_allowlist():
    try:
        with open(ALLOWLIST_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except:
        return set()


def fetch():
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=DAYS)

    url = (
        "https://app.ticketmaster.com/discovery/v2/events.json?"
        + urllib.parse.urlencode({
            "apikey": API_KEY,
            "latlong": f"{LAT},{LON}",
            "radius": RADIUS,
            "unit": "miles",
            "classificationName": "music",
            "sort": "date,asc",
            "startDateTime": now.isoformat(),
            "endDateTime": end.isoformat(),
            "size": 200
        })
    )

    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())


def main():
    if not API_KEY:
        raise RuntimeError("Missing TICKETMASTER_API_KEY")

    allowlist = load_allowlist()
    raw = fetch()
    events = []

    for e in raw.get("_embedded", {}).get("events", []):
        venue = e["_embedded"]["venues"][0]["name"]

        if allowlist and venue not in allowlist:
            continue

        name = e["name"]
        date = e["dates"]["start"].get("localDate", "")
        city = e["_embedded"]["venues"][0]["city"]["name"]
        state = e["_embedded"]["venues"][0]["state"]["stateCode"]

        events.append({
            "id": e["id"],
            "name": name,
            "dateDisplay": date,
            "dateLocal": e["dates"]["start"].get("dateTime"),
            "city": city,
            "state": state,
            "venueName": venue,
            "url": e["url"],
            "slug": slugify(f"{name}-{venue}-{date}")
        })

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "market": {
            "label": "Indianapolis, IN metro",
            "lat": LAT,
            "lon": LON,
            "radiusMiles": RADIUS,
            "daysAhead": DAYS
        },
        "count": len(events),
        "events": events
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)


if __name__ == "__main__":
    main()
