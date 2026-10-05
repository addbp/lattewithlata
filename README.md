# Latte with Lata

**Real Conversations. Built on Purpose.**

The website for Latte with Lata: a podcast cafe where mission-driven leaders sit down for candid, unhurried conversation, hosted by Lata Singh.

It is a multi-page site with a working table-booking system and a staff CRM. There is no framework and no bundler: plain HTML, CSS and ES modules, a small Node server with zero npm dependencies, and GSAP 3.13 and Splide 4 vendored locally.

## Run it locally

Full site, including bookings, the contact form, newsletter sign-ups and the CRM (needs Node 18 or newer):

```bash
node server.cjs 5178
```

Then open http://localhost:5178/. On first start the server prints an admin token and saves it to `data/admin-token.txt`; use it to sign in at http://localhost:5178/admin.html. Set `ADMIN_TOKEN` in the environment to choose your own.

Optional sample data for trying the CRM (every record is fictional and marked `demo: true`):

```bash
node server.cjs --seed
node server.cjs --reset
```

Static preview only, without bookings or forms:

```bash
node serve.cjs 5178
```

Run the API test suite:

```bash
node test/api.test.cjs
```

## Pages

| Page | What it is |
|---|---|
| `index.html` | Home |
| `cafe.html` | The cafe: story, values, the room, gallery, FAQs, visit |
| `menu.html` | Full menu with dietary filter and category navigation |
| `podcast.html` | The show, the four pillars, how recording nights work, the host |
| `episodes.html` | All episodes with pillar filters and show notes |
| `events.html` | Thursday recording nights with live seats left |
| `contact.html` | Find us, contact form, privacy summary, photo credits |
| `book.html` | Book a table or a recording-night seat, manage or cancel a booking |
| `admin.html` | Staff CRM: today's bookings, customers, messages, subscribers, settings, activity, CSV export |

## Booking system and CRM

- Availability from opening hours, 30-minute slots, 90-minute sittings, per-slot capacity and blocked dates.
- Bookings get a reference such as `LWL-7K4QXM`; guests can look up and cancel (not within 2 hours).
- Thursday recording nights take RSVPs against a seat limit.
- Every booking, message and sign-up builds a customer record with visits, covers, no-shows, tags and notes.
- Staff sign in with a token; the session is an HttpOnly, SameSite=Strict cookie.
- Rate limiting, a honeypot field, request-size limits and a strict Content-Security-Policy protect the public forms.

The full API is documented in `API.md`.

## How the site is put together

| Path | What it is |
|---|---|
| `sections/NN-name.html` | Home-page fragments, the source of truth for home markup |
| `pages/<page>/NN-name.html` | Fragments for each landing page, the booking page and the CRM |
| `build-site.cjs` | Assembles every `.html` page from its fragments: `node build-site.cjs` (or name pages, e.g. `node build-site.cjs menu book`) |
| `server.cjs`, `lib/` | Static files plus the JSON API and the file datastore |
| `css/tokens.css`, `css/base.css`, `css/fonts.css` | Brand tokens, shared layout and type roles, Creato Display faces |
| `css/pages/`, `js/pages/` | Landing-page styles and scripts; `_shell.css` is the shared page and form kit |
| `css/sections/`, `js/sections/`, `js/core.js`, `js/carousel.js` | Home-page sections and shared motion helpers |
| `js/admin/`, `css/admin.css` | The CRM |
| `content/site.json`, `content/pages.json` | All copy; `COPY.md` and `COPY-PAGES.md` are the readable versions and list every placeholder |
| `assets/brand/` | Logo marks and lockups, Creato Display fonts, host photo |
| `data/` | Runtime data, created by the server; never committed |

Do not hand-edit the generated `.html` files at the root. Edit the fragment, then run `node build-site.cjs`.

## Deploying

The booking system needs a Node host (for example a small VPS, Render, Railway or Fly.io) with a persistent disk for `data/`. A static host such as GitHub Pages can serve the pages, but the booking, contact and newsletter forms will show a call-or-email notice instead of working.

GitHub Pages: every push to `main` publishes the public pages to the `gh-pages` branch (`.github/workflows/pages.yml`, without the CRM). In the repo's Settings, Pages, choose "Deploy from a branch", `gh-pages`, `/ (root)`. Do not serve `main` directly: Jekyll would drop `css/pages/_shell.css`.

When deploying behind a proxy, set `TRUST_PROXY` to the number of proxies in front of the server, and set a strong `ADMIN_TOKEN`.

`data/` holds personal data (bookings, customer records, messages, subscribers). It is excluded from git. Back it up, restrict access to it, and follow the retention note in `API.md`.

## Before going live

These are placeholders in the current build and need real values:

- Address, phone, email, opening hours, menu items and prices, episodes, guests and upcoming recording nights are sample content (`content/COPY.md` and `content/COPY-PAGES.md` list them all).
- Podcast platform and social links are `#`.
- No confirmation emails are sent; messages are written to `data/outbox.json` (the swap-in point for an email provider is described in `API.md`).
- The privacy summary on the contact page is a template for legal review.
- The host's pull quote on the podcast page needs Lata's sign-off.
- Four event photos show real performers at a distance; replace them with the cafe's own photos.

## Brand

- Typeface: Creato Display (SIL Open Font License), self-hosted.
- Colours: espresso `#502506`, caramel `#81532e`, white `#ffffff`.
- Mark: the cup-with-LATA logo in brown, white and black variants.

Full token sheet and usage rules are in `BRAND.md` and `LOGO-USAGE.md`.

## Photo and video credits

Photography and the hero podcast clip ("Guerrilla on air – Fatti d'arte teaser", CC BY-SA 4.0, cut and colour-graded for this site) come from Wikimedia Commons under CC0, CC BY and CC BY-SA licences. Attribution is required for the CC BY and CC BY-SA items; every file, author, licence and a ready-to-paste credit line is in `ASSETS.md`, and the contact page lists them. The photo of Lata Singh and the logo files are the property of Latte with Lata.

Latte with Lata is a personal platform and is independent of any employer or institution.

Site by Agora Data Driven.
