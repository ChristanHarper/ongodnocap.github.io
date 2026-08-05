# On God No Capital Investments

A dead serious looking website for a not at all serious situation: one friend renting a
room to another. Black, gold, and red. The whole site is written and designed like a
genuine private investment firm; the only joke is the name.

## Design direction

The site borrows the visual language of an actual private placement memorandum or fund
overview page: a filing reference strip repeated on every page, a fund fact sheet, a
schedule of holdings table, and multi-column legal disclosures in the footer. All copy
outside the firm name itself is written straight, in the register of real institutional
finance boilerplate. The absurdity is meant to come entirely from the subject matter (one
room, one tenant) being presented with that level of formality, not from jokes in the
writing.

## Read this before you rely on it

The site itself is static (GitHub Pages, no server code), but the ledger lives in
**Firebase Firestore**. The administrator confirming a payment on their phone shows up on
the tenant's laptop in real time. Both portals hold a live subscription, so no refresh is
needed.

Worth knowing:
- Passwords are plain text convenience locks, not real authentication. The admin and
  tenant password screens are a courtesy gate, not a security boundary. Firestore's
  security rules only check that a visitor is anonymously signed in, which happens
  automatically for anyone who loads the site; they do not distinguish "admin" from
  "tenant." Someone who opened dev tools could write to the ledger directly, bypassing the
  password screens entirely. Fine for two friends, not fine for anything that actually
  needs to be secure.
- The Firebase project config in `js/firebase.js` contains an API key. This is normal and
  expected for Firebase web apps. It is not a secret; Firestore's security rules are what
  actually govern access, not the key.
- If Firestore is unreachable, the login forms show a message saying so rather than
  hanging silently.

## What's in the box

```
index.html             Home page, the firm overview (served at /)
portal/index.html       Choose Administrator or Tenant access (served at /portal/)
admin/index.html          Administrator console: ledger, add/edit/delete charges, settings (served at /admin/)
renter/index.html          Tenant view: read only history plus Print Payment History (served at /renter/)
css/style.css         Design system
js/firebase.js          Firebase app, auth, and Firestore bootstrap plus project config
js/data.js                Firestore data layer: config doc, payments collection, live subscriptions, full CRUD
js/app.js                  Session auth helpers, the admin and tenant password gate
js/admin.js                 Admin page logic, including inline edit and add-charge controls
js/renter.js                 Tenant page logic
CNAME                          Custom domain file for GitHub Pages (ongodnocap.com)
```

Every page is a folder's `index.html`, so GitHub Pages serves it at the clean URL
(`/portal/` rather than `/portal.html`) with no extension. All internal links, script
tags, and redirects use root-relative paths (`/css/style.css`, `/portal/`, etc.), so they
resolve correctly regardless of which folder the current page lives in.

## Default passwords

Set in `js/data.js` under `DEFAULT_CONFIG`. These seed into Firestore the first time the
site runs, and can be changed afterward from the Administrator Console:

- **Administrator:** `scarface`
- **Tenant:** `nocap`

Changing them in Firm Settings updates the shared Firestore document, so the change
applies for everyone immediately, not just the browser you happen to be using.

## Managing the ledger

The Administrator Console now supports full control over every charge, not just marking
things paid:

- **Add Next Period.** Quickly creates the next month's charge at the standard rent
  amount, based on the most recent charge on record.
- **Add Charge.** Opens a blank row where you can set any due date, amount, and optional
  label. Use this for anything outside the standard monthly cycle: a partial month, a late
  fee, a one-off credit.
- **Edit.** Turns a row's period, due date, and amount into editable fields. Save writes
  the change straight to Firestore, so it is reflected on the tenant's screen right away.
- **Delete.** Removes a charge permanently. There is a confirmation prompt first; this
  cannot be undone.
- **Confirm Paid / Undo.** Unchanged from before: mark a pending charge as received, or
  revert a paid charge back to pending if it was confirmed by mistake.

## How the data flows

- `ognc_meta/config`, a single Firestore document holding tenant name, rent amount, due
  day, and both passwords.
- `ognc_payments`, a Firestore collection, one document per charge, holding label, due
  date, amount, status (`pending`, `paid`, or `late`), paid date, method, and who
  confirmed it.
- Both `admin/index.html` and `renter/index.html` hold a live `onSnapshot` subscription to both of the
  above. Any write from either portal, or directly in the Firebase console, shows up on
  every open tab within moments.
- If the collection is empty on first load, the site seeds a few demo months
  automatically so it is not blank.

To wipe the ledger and start clean, delete all documents in the `ognc_payments` collection
from the Firebase console (Firestore Database, your project, `ognc_payments`).

## Firebase project setup

Already done for the live `ongodnocap` project. If you ever need to rebuild this from
scratch, or set it up for a different project:

1. **console.firebase.google.com**, Add project.
2. Add a **Web app** (the `</>` icon). Skip Firebase Hosting; this uses GitHub Pages.
   Copy the `firebaseConfig` object it gives you into `js/firebase.js`.
3. **Build > Firestore Database**, Create database, production mode.
4. **Build > Authentication > Sign-in method**, enable **Anonymous**.
5. **Firestore Database > Rules**, set:

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

1. Push this folder's contents to the root of a GitHub repo (for example the `main`
   branch). Make sure `css/` and `js/` land as actual subfolders at the repo root, not
   flattened or nested inside another folder.
2. In the repo: **Settings > Pages**, set source to the `main` branch, root folder.
3. The included `CNAME` file already points to `ongodnocap.com`. At your registrar, point
   the apex domain at GitHub's four Pages IPs via `A` records, and optionally point `www`
   at `<your-username>.github.io.` via a `CNAME` record. GitHub's docs walk through the
   exact setup at docs.github.com (search "configuring a custom domain for your GitHub
   Pages site").
4. Back in **Settings > Pages**, confirm the custom domain and enable "Enforce HTTPS" once
   it is available.

## Ideas if you want to take it further

- Add email or text reminders a few days before a charge's due date, for example a small
  scheduled Cloud Function that checks `ognc_payments` for anything still `pending` near
  its due date.
- Let the tenant download the printed history as a PDF instead of using the browser's
  print dialog.
- Tighten the Firestore rules further if this ever needs to be more than a two-friend
  arrangement, for example custom claims on the anonymous user to distinguish admin from
  tenant at the rules level, not just in the UI.
