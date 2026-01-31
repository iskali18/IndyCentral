\# IndyCentral



A clean, auto-updating list of major concerts in the Indianapolis metro area.



\## How it works

\- Event data is fetched daily from Ticketmaster

\- A GitHub Action updates data/events.json

\- Vercel rebuilds automatically



\## Setup

1\. Add GitHub secret: TICKETMASTER\_API\_KEY

2\. Run the GitHub Action once

3\. Deploy to Vercel (Astro preset)



\## Notes

\- MVP uses Ticketmaster links only

\- Hotel and affiliate layers can be added later



