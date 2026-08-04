/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — Firebase bootstrap
   Loaded as an ES module. Sets up the shared app, auth, and Firestore
   instances used by data.js.

   NOTE ON SECURITY: this project uses anonymous auth purely so Firestore's
   security rules have a `request.auth != null` to check — it is NOT the
   same thing as the admin/tenant password gate you type into the site.
   Anyone who loads the site becomes an authenticated anonymous user and,
   per the rules set up for this project, can read and write the ledger
   directly (e.g. via browser dev tools), regardless of which password
   screen they did or didn't get past. That's an acceptable trade-off for
   a private joke site between two friends — it would not be acceptable
   for anything handling real security-sensitive data.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZXKVtiOxEVDvK3LVdDkU1CkH-0O4oBUc",
  authDomain: "ongodnocap.firebaseapp.com",
  projectId: "ongodnocap",
  storageBucket: "ongodnocap.firebasestorage.app",
  messagingSenderId: "437766469639",
  appId: "1:437766469639:web:b4a82c4ce6932dc4e7d2a2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Resolves once we have a signed-in (anonymous) user. Every read/write in
// data.js awaits this first.
export const authReady = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      resolve(user);
    } else {
      signInAnonymously(auth).catch(reject);
    }
  });
});
