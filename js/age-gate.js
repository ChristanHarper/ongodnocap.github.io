/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS. Age gate for the homepage.
   ========================================================================== */

(function(){
  const gate = document.getElementById("age-gate");
  const app = document.getElementById("app");

  function unlock(){
    gate.style.display = "none";
    app.style.display = "";
  }

  if (window.OGNC_AUTH.isAgeVerified()) {
    unlock();
    return;
  }

  document.getElementById("age-yes").addEventListener("click", () => {
    window.OGNC_AUTH.setAgeVerified(true);
    unlock();
  });

  document.getElementById("age-no").addEventListener("click", () => {
    window.location.href = "/juice-box/";
  });
})();
