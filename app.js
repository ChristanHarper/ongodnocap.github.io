/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — shared app helpers
   Session auth is intentionally simple: a password checked client-side and
   a flag stored in sessionStorage. This is a private joke site between two
   friends, not a security product — don't reuse these passwords elsewhere.
   ========================================================================== */

const OGNC_AUTH = (() => {
  const ADMIN_KEY = "ognc_admin_auth";
  const RENTER_KEY = "ognc_renter_auth";

  return {
    isAdmin: () => sessionStorage.getItem(ADMIN_KEY) === "1",
    setAdmin: (on) => on
      ? sessionStorage.setItem(ADMIN_KEY, "1")
      : sessionStorage.removeItem(ADMIN_KEY),

    isRenter: () => sessionStorage.getItem(RENTER_KEY) === "1",
    setRenter: (on) => on
      ? sessionStorage.setItem(RENTER_KEY, "1")
      : sessionStorage.removeItem(RENTER_KEY),
  };
})();
