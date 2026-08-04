/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — administrator console logic
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

  if (OGNC_AUTH.isAdmin()) {
    unlock();
  }

  document.getElementById("gate-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("gate-pass").value;
    const cfg = OGNC.getConfig();
    const err = document.getElementById("gate-error");
    if (val === cfg.adminPassword) {
      OGNC_AUTH.setAdmin(true);
      unlock();
    } else {
      err.textContent = "That's not it. Try again.";
    }
  });

  document.getElementById("logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    OGNC_AUTH.setAdmin(false);
    window.location.href = "portal.html";
  });

  document.getElementById("add-month-btn").addEventListener("click", () => {
    OGNC.addNextPeriod();
    render();
  });

  document.getElementById("settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    OGNC.saveConfig({
      tenantName: document.getElementById("s-tenant").value.trim(),
      landlordName: document.getElementById("s-landlord").value.trim(),
      propertyLabel: document.getElementById("s-property").value.trim(),
      rentAmount: Number(document.getElementById("s-rent").value) || 0,
      dueDay: Number(document.getElementById("s-dueday").value) || 1,
      adminPassword: document.getElementById("s-adminpass").value,
      renterPassword: document.getElementById("s-renterpass").value,
    });
    const msg = document.getElementById("save-msg");
    msg.classList.add("show");
    setTimeout(() => msg.classList.remove("show"), 2200);
    render();
  });

  function statusPill(status){
    if (status === "paid") return `<span class="pill pill--paid">Paid On Time</span>`;
    if (status === "late") return `<span class="pill pill--late">Paid Late</span>`;
    return `<span class="pill pill--pending">Pending</span>`;
  }

  function renderLedger(payments){
    const wrap = document.getElementById("ledger-wrap");
    if (payments.length === 0) {
      wrap.innerHTML = `<div class="empty-state">No charges on the books yet. Add next month's charge to get started.</div>`;
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
        <td>${p.method || "—"}</td>
        <td>
          ${p.status === "pending"
            ? `<button class="row-btn" data-confirm="${p.id}">Confirm Paid</button>`
            : `<button class="row-btn row-btn--undo" data-undo="${p.id}">Undo</button>`
          }
        </td>
      </tr>
    `).join("");

    wrap.innerHTML = `
      <table class="ledger">
        <thead>
          <tr>
            <th>Period</th><th>Due</th><th>Amount</th><th>Status</th>
            <th>Paid On</th><th>Method</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    wrap.querySelectorAll("[data-confirm]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-confirm");
        const method = window.prompt("How'd they pay? (e.g. Cash App, Venmo, cash)", "Cash App");
        if (method === null) return; // cancelled
        OGNC.markPaid(id, { method: method.trim() || "Confirmed in person" });
        render();
      });
    });

    wrap.querySelectorAll("[data-undo]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-undo");
        if (window.confirm("Mark this period back to pending?")) {
          OGNC.undoPayment(id);
          render();
        }
      });
    });
  }

  function render(){
    const cfg = OGNC.getConfig();
    const payments = OGNC.getPayments();
    const stats = OGNC.computeStats(payments);

    document.getElementById("welcome-heading").textContent = `Welcome back, ${cfg.landlordName}`;
    document.getElementById("tenant-label-note").textContent = `${cfg.tenantName} · ${cfg.propertyLabel}`;

    document.getElementById("stat-total").textContent = OGNC.formatMoney(stats.totalPaid);
    document.getElementById("stat-ontime").textContent = `${stats.onTimeRate}%`;
    document.getElementById("stat-pending").textContent = stats.pendingCount;

    document.getElementById("s-tenant").value = cfg.tenantName;
    document.getElementById("s-landlord").value = cfg.landlordName;
    document.getElementById("s-property").value = cfg.propertyLabel;
    document.getElementById("s-rent").value = cfg.rentAmount;
    document.getElementById("s-dueday").value = cfg.dueDay;
    document.getElementById("s-adminpass").value = cfg.adminPassword;
    document.getElementById("s-renterpass").value = cfg.renterPassword;

    renderLedger(payments);
  }
})();
