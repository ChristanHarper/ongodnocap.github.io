# On God No Capital Investments

A very serious-looking website for a not-at-all-serious situation: Brandon renting a room
to a friend. Black, gold, and red — Scarface mansion energy, private-equity-firm copy, for
a portfolio of exactly one room.

## ⚠️ Read this before you rely on it

The site itself is still static (GitHub Pages, no server code), but the ledger now lives
in **Firebase Firestore** instead of the browser's `localStorage`. That means Brandon
confirming a payment on his phone shows up on the tenant's laptop in real time — both
portals subscribe to live updates, no refresh needed.

Worth knowing:
- **Passwords are plain-text convenience locks**, not real authentication. The
  admin/tenant password screens are a courtesy UI gate, not a security boundary.
  Firestore's security rules only check that a visitor is *anonymously signed in* (which
  happens automatically for anyone who loads the site) — they don't distinguish "admin"
  from "tenant." Someone who opened dev tools could write to the ledger directly,
  bypassing the password screens entirely. Fine for keeping this between two friends, not
  fine for anything that actually needs to be secure.
- The Firebase project config (`js/firebase.js`) contains an API key. This is normal and
  expected for Firebase web apps — it's not a secret, and it's meant to be public;
  Firestore's security rules are what actually govern access, not the key.
- If Firestore is unreachable (offline, misconfigured rules, etc.), the login forms show
  a "couldn't reach the server" message rather than hanging silently.

## What's in the box

```
index.html         Home page — the "firm"
portal.html         Choose Administrator or Tenant access
admin.html           Brandon's console — confirm payments, manage the ledger, edit settings
renter.html          Tenant view — read-only history + "Print Payment History"
css/style.css        Design system (black / gold / red, Playfair Display + Cormorant Garamond)
js/firebase.js         Firebase app/auth/Firestore bootstrap + project config
js/data.js               Firestore data layer (config doc + payments collection, live subscriptions)
js/app.js                 Session auth helpers (the admin/tenant password gate)
js/admin.js                Admin page logic
js/renter.js                Tenant page logic
CNAME                         Custom domain file for GitHub Pages (ongodnocap.com)
```

## Default passwords

Set in `js/data.js` under `DEFAULT_CONFIG` — these seed into Firestore the first time the
site runs, and can be changed afterward from the Administrator Console:

- **Administrator (Brandon):** `scarface`
- **Tenant:** `nocap`

Changing them in Firm Settings updates the shared Firestore document, so — unlike the old
localStorage version — the change applies for everyone immediately, not just the browser
you're using.

## How the data flows

- `ognc_meta/config` — a single Firestore document holding tenant name, rent amount, due
  day, and both passwords.
- `ognc_payments` — a Firestore collection, one document per billing period, holding
  amount, due date, status (`pending` / `paid` / `late`), paid date, method, and who
  confirmed it.
- Both `admin.html` and `renter.html` open a live `onSnapshot` subscription to both of the
  above. Any write from either portal (or directly in the Firebase console) shows up on
  every open tab within moments.
- If the collection is empty on first load, the site seeds a few demo months automatically
  so it isn't blank.

To wipe the ledger and start clean, delete all documents in the `ognc_payments` collection
from the Firebase console (Firestore Database → your project → `ognc_payments`).

## Firebase project setup (already done for ongodnocap)

If you ever need to rebuild this from scratch, or set it up for a different project:

1. **console.firebase.google.com** → Add project.
2. Add a **Web app** (the `</>` icon) — skip Firebase Hosting, you're using GitHub Pages.
   Copy the `firebaseConfig` object it gives you into `js/firebase.js`.
3. **Build → Firestore Database** → Create database → production mode.
4. **Build → Authentication → Sign-in method** → enable **Anonymous**.
5. **Firestore Database → Rules**, set:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ognc_meta/config {
         allow read: if true;
         allow write: if request.auth != null;
       }
       match /ognc_payments/{paymentId} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

## Deploying to GitHub Pages with ongodnocap.com

1. Push this folder's contents to the root of a GitHub repo (e.g. `main` branch) — make
   sure `css/` and `js/` land as actual subfolders at the repo root, not flattened or
   nested inside another folder.
2. In the repo: **Settings → Pages** → set source to the `main` branch, root folder.
3. The included `CNAME` file already points to `ongodnocap.com`. At your registrar, point
   the apex domain at GitHub's four Pages IPs via `A` records, and (optionally) `www` at
   `<your-username>.github.io.` via a `CNAME` record. GitHub's docs walk through the exact
   setup: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
4. Back in **Settings → Pages**, confirm the custom domain and enable "Enforce HTTPS"
   once it's available.

## Ideas if you want to take it further

- Add email or text reminders a few days before the due date (e.g. a small scheduled
  Cloud Function watching `ognc_payments` for anything still `pending` near the due date).
- Let the tenant download the printed history as a PDF instead of using the browser's
  print dialog.
- Tighten the Firestore rules further if this ever needs to be more than a two-friend
  arrangement — e.g. custom claims on the anonymous user to actually distinguish admin
  from tenant at the rules level, not just in the UI.
