/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS. Tenant portal logic. Firestore.
   ========================================================================== */

import { OGNC } from "./data.js";

const gate = document.getElementById("gate");
const app = document.getElementById("app");
const gateForm = document.getElementById("gate-form");
const gateSubmitBtn = gateForm.querySelector("button[type=submit]");

let latestConfig = null;
let latestPayments = null;
let unsubConfig = null;
let unsubPayments = null;

function unlock(){
  gate.style.display = "none";
  app.style.display = "block";
  unsubConfig = OGNC.subscribeConfig((cfg) => {
    latestConfig = cfg;
    render();
  });
  unsubPayments = OGNC.subscribePayments((payments) => {
    latestPayments = payments;
    render();
  });
}

if (window.OGNC_AUTH.isRenter()) {
  unlock();
}

gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const val = document.getElementById("gate-pass").value;
  const err = document.getElementById("gate-error");
  err.textContent = "";
  gateSubmitBtn.disabled = true;
  gateSubmitBtn.textContent = "Checking";
  try {
    const cfg = await OGNC.getConfig();
    if (val === cfg.renterPassword) {
      window.OGNC_AUTH.setRenter(true);
      unlock();
    } else {
      err.textContent = "That is not correct. Try again.";
    }
  } catch (e2) {
    err.textContent = "Could not reach the server. Check your connection and try again.";
  } finally {
    gateSubmitBtn.disabled = false;
    gateSubmitBtn.textContent = "View My History";
  }
});

document.getElementById("logout-link").addEventListener("click", (e) => {
  e.preventDefault();
  window.OGNC_AUTH.setRenter(false);
  if (unsubConfig) unsubConfig();
  if (unsubPayments) unsubPayments();
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
  const rows = payments.map(p => `
    <tr>
      <td>${p.label}</td>
      <td>${OGNC.formatDate(p.dueDate)}</td>
      <td>${OGNC.formatMoney(p.amount)}</td>
      <td>${statusPill(p.status)}</td>
      <td>${p.paidDate ? OGNC.formatDate(p.paidDate) : "N/A"}</td>
      <td>${p.confirmedBy || "N/A"}</td>
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
  if (!latestConfig || !latestPayments) return;
  const cfg = latestConfig;
  const payments = latestPayments;
  const stats = OGNC.computeStats(payments);

  document.getElementById("welcome-heading").textContent = `${cfg.tenantName}'s Payment History`;
  document.getElementById("ledger-title").textContent = `${cfg.propertyLabel}`;
  document.getElementById("printed-note").textContent = `Printed ${new Date().toLocaleDateString()}`;

  document.getElementById("stat-total").textContent = OGNC.formatMoney(stats.totalPaid);
  document.getElementById("stat-ontime").textContent = `${stats.onTimeRate}%`;
  document.getElementById("stat-count").textContent = stats.settledCount + stats.pendingCount;

  renderLedger(payments);
}
