/* ==========================================================================
   ON GOD NO CAPITAL SOLUTIONS. Shared app helpers.
   Session auth is intentionally simple: a password checked client-side and
   a flag stored in sessionStorage. This is a private joke site between two
   friends, not a security product. Do not reuse these passwords elsewhere.
   ========================================================================== */

const OGNC_AUTH = (() => {
  const ADMIN_KEY = "ognc_admin_auth";
  const RENTER_KEY = "ognc_renter_auth";
  const AGE_KEY = "ognc_age_verified";

  return {
    isAdmin: () => sessionStorage.getItem(ADMIN_KEY) === "1",
    setAdmin: (on) => on
      ? sessionStorage.setItem(ADMIN_KEY, "1")
      : sessionStorage.removeItem(ADMIN_KEY),

    isRenter: () => sessionStorage.getItem(RENTER_KEY) === "1",
    setRenter: (on) => on
      ? sessionStorage.setItem(RENTER_KEY, "1")
      : sessionStorage.removeItem(RENTER_KEY),

    isAgeVerified: () => sessionStorage.getItem(AGE_KEY) === "1",
    setAgeVerified: (on) => on
      ? sessionStorage.setItem(AGE_KEY, "1")
      : sessionStorage.removeItem(AGE_KEY),
  };
})();

// Also expose globally so module scripts (admin.js, renter.js) can reach it.
window.OGNC_AUTH = OGNC_AUTH;