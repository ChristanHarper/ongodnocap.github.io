/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — administrator console logic (Firestore)
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

if (window.OGNC_AUTH.isAdmin()) {
  unlock();
}

gateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const val = document.getElementById("gate-pass").value;
  const err = document.getElementById("gate-error");
  err.textContent = "";
  gateSubmitBtn.disabled = true;
  gateSubmitBtn.textContent = "Checking…";
  try {
    const cfg = await OGNC.getConfig();
    if (val === cfg.adminPassword) {
      window.OGNC_AUTH.setAdmin(true);
      unlock();
    } else {
      err.textContent = "That's not it. Try again.";
    }
  } catch (e2) {
    err.textContent = "Couldn't reach the server. Check your connection and try again.";
  } finally {
    gateSubmitBtn.disabled = false;
    gateSubmitBtn.textContent = "Enter Console";
  }
});

document.getElementById("logout-link").addEventListener("click", (e) => {
  e.preventDefault();
  window.OGNC_AUTH.setAdmin(false);
  if (unsubConfig) unsubConfig();
  if (unsubPayments) unsubPayments();
  window.location.href = "portal.html";
});

document.getElementById("add-month-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await OGNC.addNextPeriod();
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await OGNC.saveConfig({
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
  } finally {
    btn.disabled = false;
  }
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
  const rows = payments.map(p => `
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
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-confirm");
      const method = window.prompt("How'd they pay? (e.g. Cash App, Venmo, cash)", "Cash App");
      if (method === null) return; // cancelled
      btn.disabled = true;
      btn.textContent = "Confirming…";
      try {
        await OGNC.markPaid(id, { method: method.trim() || "Confirmed in person" });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Confirm Paid";
        alert("Couldn't save that. Check your connection and try again.");
      }
    });
  });

  wrap.querySelectorAll("[data-undo]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-undo");
      if (window.confirm("Mark this period back to pending?")) {
        btn.disabled = true;
        try {
          await OGNC.undoPayment(id);
        } catch (e) {
          btn.disabled = false;
          alert("Couldn't save that. Check your connection and try again.");
        }
      }
    });
  });
}

function render(){
  if (!latestConfig || !latestPayments) return; // wait until both have loaded once
  const cfg = latestConfig;
  const payments = latestPayments;
  const stats = OGNC.computeStats(payments);

  document.getElementById("welcome-heading").textContent = `Welcome back, ${cfg.landlordName}`;
  document.getElementById("tenant-label-note").textContent = `${cfg.tenantName} · ${cfg.propertyLabel}`;

  document.getElementById("stat-total").textContent = OGNC.formatMoney(stats.totalPaid);
  document.getElementById("stat-ontime").textContent = `${stats.onTimeRate}%`;
  document.getElementById("stat-pending").textContent = stats.pendingCount;

  // Don't clobber a field the admin is actively typing in.
  const active = document.activeElement;
  const settingsFields = {
    "s-tenant": cfg.tenantName,
    "s-landlord": cfg.landlordName,
    "s-property": cfg.propertyLabel,
    "s-rent": cfg.rentAmount,
    "s-dueday": cfg.dueDay,
    "s-adminpass": cfg.adminPassword,
    "s-renterpass": cfg.renterPassword,
  };
  Object.entries(settingsFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el !== active) el.value = value;
  });

  renderLedger(payments);
}
