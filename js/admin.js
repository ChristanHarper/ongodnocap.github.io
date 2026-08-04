/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS. Administrator console logic. Firestore.
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

let editingId = null;
let addingNew = false;

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
  gateSubmitBtn.textContent = "Checking";
  try {
    const cfg = await OGNC.getConfig();
    if (val === cfg.adminPassword) {
      window.OGNC_AUTH.setAdmin(true);
      unlock();
    } else {
      err.textContent = "That is not correct. Try again.";
    }
  } catch (e2) {
    err.textContent = "Could not reach the server. Check your connection and try again.";
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

document.getElementById("quick-add-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await OGNC.addNextPeriod();
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("custom-add-btn").addEventListener("click", () => {
  editingId = null;
  addingNew = true;
  render();
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

function displayRow(p){
  return `
    <tr>
      <td>${p.label}</td>
      <td>${OGNC.formatDate(p.dueDate)}</td>
      <td>${OGNC.formatMoney(p.amount)}</td>
      <td>${statusPill(p.status)}</td>
      <td>${p.paidDate ? OGNC.formatDate(p.paidDate) : "N/A"}</td>
      <td>${p.method || "N/A"}</td>
      <td>
        <div class="row-actions">
          ${p.status === "pending"
            ? `<button class="row-btn" data-confirm="${p.id}">Confirm Paid</button>`
            : `<button class="row-btn row-btn--undo" data-undo="${p.id}">Undo</button>`
          }
          <button class="row-btn row-btn--ghost" data-edit="${p.id}">Edit</button>
          <button class="row-btn row-btn--danger" data-delete="${p.id}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function editRow(p){
  return `
    <tr>
      <td><input type="text" id="edit-label-${p.id}" value="${p.label.replace(/"/g,'&quot;')}"></td>
      <td><input type="date" id="edit-due-${p.id}" value="${p.dueDate}"></td>
      <td><input type="number" id="edit-amount-${p.id}" value="${p.amount}" min="0" step="1"></td>
      <td>${statusPill(p.status)}</td>
      <td>${p.paidDate ? OGNC.formatDate(p.paidDate) : "N/A"}</td>
      <td>${p.method || "N/A"}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" data-save-edit="${p.id}">Save</button>
          <button class="row-btn row-btn--ghost" data-cancel-edit="1">Cancel</button>
        </div>
      </td>
    </tr>
  `;
}

function addRow(cfg){
  const today = new Date().toISOString().slice(0,10);
  return `
    <tr>
      <td><input type="text" id="new-label" placeholder="Optional"></td>
      <td><input type="date" id="new-due" value="${today}"></td>
      <td><input type="number" id="new-amount" value="${cfg ? cfg.rentAmount : 0}" min="0" step="1"></td>
      <td><span class="pill pill--pending">Pending</span></td>
      <td>N/A</td>
      <td>N/A</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" data-save-new="1">Save</button>
          <button class="row-btn row-btn--ghost" data-cancel-new="1">Cancel</button>
        </div>
      </td>
    </tr>
  `;
}

function renderLedger(payments, cfg){
  const wrap = document.getElementById("ledger-wrap");

  if (payments.length === 0 && !addingNew) {
    wrap.innerHTML = `<div class="empty-state">No charges on the books yet. Use Add Charge to get started.</div>`;
    return;
  }

  const rows = [];
  if (addingNew) rows.push(addRow(cfg));
  payments.forEach(p => {
    rows.push(p.id === editingId ? editRow(p) : displayRow(p));
  });

  wrap.innerHTML = `
    <table class="ledger">
      <thead>
        <tr>
          <th>Period</th><th>Due</th><th>Amount</th><th>Status</th>
          <th>Paid On</th><th>Method</th><th></th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;

  wrap.querySelectorAll("[data-confirm]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-confirm");
      const method = window.prompt("How was this paid? For example, Cash App, Venmo, or cash.", "Cash App");
      if (method === null) return;
      btn.disabled = true;
      btn.textContent = "Confirming";
      try {
        await OGNC.markPaid(id, { method: method.trim() || "Confirmed in person" });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Confirm Paid";
        alert("Could not save that. Check your connection and try again.");
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
          alert("Could not save that. Check your connection and try again.");
        }
      }
    });
  });

  wrap.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      addingNew = false;
      editingId = btn.getAttribute("data-edit");
      render();
    });
  });

  wrap.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      if (window.confirm("Delete this charge permanently? This cannot be undone.")) {
        btn.disabled = true;
        try {
          await OGNC.deleteCharge(id);
        } catch (e) {
          btn.disabled = false;
          alert("Could not delete that. Check your connection and try again.");
        }
      }
    });
  });

  wrap.querySelectorAll("[data-cancel-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      editingId = null;
      render();
    });
  });

  wrap.querySelectorAll("[data-save-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-save-edit");
      const label = document.getElementById(`edit-label-${id}`).value;
      const dueDate = document.getElementById(`edit-due-${id}`).value;
      const amount = document.getElementById(`edit-amount-${id}`).value;
      if (!dueDate) { alert("A due date is required."); return; }
      btn.disabled = true;
      btn.textContent = "Saving";
      try {
        await OGNC.updateCharge(id, { label, dueDate, amount });
        editingId = null;
        render();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Save";
        alert("Could not save that. Check your connection and try again.");
      }
    });
  });

  wrap.querySelectorAll("[data-cancel-new]").forEach(btn => {
    btn.addEventListener("click", () => {
      addingNew = false;
      render();
    });
  });

  wrap.querySelectorAll("[data-save-new]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const label = document.getElementById("new-label").value;
      const dueDate = document.getElementById("new-due").value;
      const amount = document.getElementById("new-amount").value;
      if (!dueDate) { alert("A due date is required."); return; }
      btn.disabled = true;
      btn.textContent = "Saving";
      try {
        await OGNC.addCharge({ label, dueDate, amount });
        addingNew = false;
        render();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Save";
        alert("Could not save that. Check your connection and try again.");
      }
    });
  });
}

function render(){
  if (!latestConfig || !latestPayments) return;
  const cfg = latestConfig;
  const payments = latestPayments;
  const stats = OGNC.computeStats(payments);

  document.getElementById("welcome-heading").textContent = `Welcome back, ${cfg.landlordName}`;
  document.getElementById("tenant-label-note").textContent = `${cfg.tenantName}. ${cfg.propertyLabel}`;

  document.getElementById("stat-total").textContent = OGNC.formatMoney(stats.totalPaid);
  document.getElementById("stat-ontime").textContent = `${stats.onTimeRate}%`;
  document.getElementById("stat-pending").textContent = stats.pendingCount;
  document.getElementById("stat-total-periods").textContent = stats.settledCount + stats.pendingCount;

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

  renderLedger(payments, cfg);
}
