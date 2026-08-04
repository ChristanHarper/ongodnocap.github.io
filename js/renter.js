/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — tenant portal logic
   ========================================================================== */

(() => {
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");

  function unlock(){
    gate.style.display = "none";
    app.style.display = "block";
    OGNC.ensureSeeded();
    render();
  }

  if (OGNC_AUTH.isRenter()) {
    unlock();
  }

  document.getElementById("gate-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("gate-pass").value;
    const cfg = OGNC.getConfig();
    const err = document.getElementById("gate-error");
    if (val === cfg.renterPassword) {
      OGNC_AUTH.setRenter(true);
      unlock();
    } else {
      err.textContent = "That's not it. Try again.";
    }
  });

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    OGNC_AUTH.setRenter(false);
    window.location.href = "portal.html";
  });

  document.getElementById("print-btn").addEventListener("click", () => {
    window.print();
  });

  function statusPill(status){
    if (status === "paid") return `<span class="pill pill--paid">Paid On Time</span>`;
    if (status === "late") return `<span class="pill pill--late">Paid Late</span>`;
    return `<span class="pill pill--pending">Pending</span>`;
  }

  function renderLedger(payments){
    const wrap = document.getElementById("ledger-wrap");
    if (payments.length === 0) {
      wrap.innerHTML = `<div class="empty-state">No payment history on record yet.</div>`;
      return;
    }
    const sorted = [...payments].sort((a,b) => b.period.localeCompare(a.period));
    const rows = sorted.map(p => `
      <tr>
        <td>${p.label}</td>
        <td>${OGNC.formatDate(p.dueDate)}</td>
        <td>${OGNC.formatMoney(p.amount)}</td>
        <td>${statusPill(p.status)}</td>
        <td>${p.paidDate ? OGNC.formatDate(p.paidDate) : "—"}</td>
        <td>${p.confirmedBy || "—"}</td>
      </tr>
    `).join("");

    wrap.innerHTML = `
      <table class="ledger">
        <thead>
          <tr>
            <th>Period</th><th>Due</th><th>Amount</th><th>Status</th>
            <th>Paid On</th><th>Confirmed By</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function render(){
    const cfg = OGNC.getConfig();
    const payments = OGNC.getPayments();
    const stats = OGNC.computeStats(payments);

    document.getElementById("welcome-heading").textContent = `${cfg.tenantName}'s Payment History`;
    document.getElementById("ledger-title").textContent = `${cfg.propertyLabel}`;
    document.getElementById("printed-note").textContent = `Printed ${new Date().toLocaleDateString()}`;

    document.getElementById("stat-total").textContent = OGNC.formatMoney(stats.totalPaid);
    document.getElementById("stat-ontime").textContent = `${stats.onTimeRate}%`;
    document.getElementById("stat-count").textContent = stats.settledCount + stats.pendingCount;

    renderLedger(payments);
  }
})();
