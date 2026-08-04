# On God No Capital Investments

A very serious-looking website for a not-at-all-serious situation: Brandon renting a room
to a friend. Black, gold, and red — Scarface mansion energy, private-equity-firm copy, for
a portfolio of exactly one room.

## ⚠️ Read this before you rely on it

This is a **static site with no server** — it's built to drop straight onto GitHub Pages.
All payment data lives in the browser's `localStorage`, per browser, per device.

That means: **if Brandon confirms a payment on his phone, the tenant won't see it update
on their own laptop.** Each device keeps its own separate ledger. For a fully shared,
always-in-sync ledger between two people on two devices, you'd need a real backend (even
something small like Firebase Firestore — the same stack used for the Claws by Kait
booking system — would do it cleanly). This version is set up so that's a clean drop-in
later if you want it; for now, treat it as a **shared-device or "screenshot it and move
on" tool**, or have Brandon and the tenant use the *same* browser/profile when they want
the numbers to match.

Also worth knowing:
- Passwords are plain-text convenience locks stored in a config object, not real
  authentication. Fine for keeping this between two friends, not fine for anything that
  actually needs to be secure.
- Clearing browser data (or using a private/incognito window) wipes the ledger for that
  browser.

## What's in the box

```
index.html         Home page — the "firm"
portal.html         Choose Administrator or Tenant access
admin.html           Brandon's console — confirm payments, manage the ledger, edit settings
renter.html          Tenant view — read-only history + "Print Payment History"
css/style.css        Design system (black / gold / red, Playfair Display + Cormorant Garamond)
js/data.js            localStorage data layer (config + payment records)
js/app.js              Session auth helpers
js/admin.js             Admin page logic
js/renter.js             Tenant page logic
CNAME                     Custom domain file for GitHub Pages (ongodnocap.com)
```

## Default passwords

Set in `js/data.js` under `DEFAULT_CONFIG` — change these before sharing the link:

- **Administrator (Brandon):** `scarface`
- **Tenant:** `nocap`

You can also change both from inside the Administrator Console once you're logged in
(Firm Settings → Administrator password / Tenant password) — that just rewrites the same
config in `localStorage`, so it only affects the browser you're using at the time.

## First run

The site seeds a few demo months automatically the first time either portal is opened, so
it isn't empty. To start clean instead, open the browser console on any page and run:

```js
localStorage.removeItem("ognc_payments_v1");
localStorage.removeItem("ognc_config_v1");
```

then reload.

## Deploying to GitHub Pages with ongodnocap.com

1. Push this folder's contents to the root of a GitHub repo (e.g. `main` branch).
2. In the repo: **Settings → Pages** → set source to the `main` branch, root folder.
3. The included `CNAME` file already points to `ongodnocap.com` — in your domain
   registrar, add a `CNAME` record (or the four GitHub `A` records for an apex domain)
   pointing to `<your-username>.github.io`. GitHub's docs walk through the exact records:
   https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
4. Back in **Settings → Pages**, confirm the custom domain and enable "Enforce HTTPS"
   once it's available.

## Ideas if you want to take it further

- Swap the `localStorage` layer for Firebase Firestore so Brandon and the tenant see the
  same ledger from any device (mirrors what's already running for Claws by Kait).
- Add email or text reminders a few days before the due date.
- Let the tenant download the printed history as a PDF instead of using the browser's
  print dialog.
