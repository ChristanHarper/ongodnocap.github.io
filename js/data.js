/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS. Data layer. Firestore-backed.
   Config lives at ognc_meta/config. Charges live in the ognc_payments
   collection, one document per billing period. Reads are open. Writes
   require anonymous auth (see firebase.js for what that does and does
   not protect).
   ========================================================================== */

import { db, authReady } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONFIG_DOC = doc(db, "ognc_meta", "config");
const PAYMENTS_COL = collection(db, "ognc_payments");

const DEFAULT_CONFIG = {
  tenantName: "The Tenant",
  propertyLabel: "The Room, Primary Residence",
  rentAmount: 650,
  dueDay: 1,
  adminPassword: "scarface",
  renterPassword: "nocap",
  landlordName: "The Administrator",
  // Tracks whether demo charges have ever been seeded, so deleting every
  // charge later leaves the ledger genuinely empty instead of refilling it.
  seeded: false,
};

const MONTHS = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];

function uid(){
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

function labelFor(dueDateIso){
  const [y, m] = dueDateIso.split("-").map(Number);
  return `${MONTHS[m-1]} ${y}`;
}

function dueDateFor(year, monthIndex, dueDay){
  const d = new Date(year, monthIndex, dueDay);
  return d.toISOString().slice(0,10);
}

/* ------------------------------- config -------------------------------- */

async function getConfig(){
  await authReady;
  let snap = await getDoc(CONFIG_DOC);
  if (!snap.exists()) {
    await setDoc(CONFIG_DOC, DEFAULT_CONFIG);
    snap = await getDoc(CONFIG_DOC);
  }
  return { ...DEFAULT_CONFIG, ...snap.data() };
}

async function saveConfig(partial){
  await authReady;
  await setDoc(CONFIG_DOC, partial, { merge: true });
  return getConfig();
}

function subscribeConfig(callback){
  let unsub = () => {};
  authReady.then(() => {
    unsub = onSnapshot(CONFIG_DOC, async (snap) => {
      if (!snap.exists()) {
        await setDoc(CONFIG_DOC, DEFAULT_CONFIG);
        return; // triggers this listener again with the new doc
      }
      callback({ ...DEFAULT_CONFIG, ...snap.data() });
    });
  });
  return () => unsub();
}

/* ------------------------------ payments -------------------------------- */

async function seedDemoPayments(cfg){
  const now = new Date();
  const historyOffsets = [-3, -2, -1];
  const statuses = ["paid", "late", "paid"];
  const writes = [];

  historyOffsets.forEach((offset, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const due = dueDateFor(year, month, cfg.dueDay);
    const isLate = statuses[i] === "late";
    const paidDate = new Date(year, month, cfg.dueDay + (isLate ? 6 : 0));
    writes.push(setDoc(doc(db, "ognc_payments", uid()), {
      label: labelFor(due),
      dueDate: due,
      amount: cfg.rentAmount,
      status: statuses[i],
      paidDate: paidDate.toISOString().slice(0,10),
      method: "Cash App",
      confirmedBy: cfg.landlordName,
    }));
  });

  const curDue = dueDateFor(now.getFullYear(), now.getMonth(), cfg.dueDay);
  writes.push(setDoc(doc(db, "ognc_payments", uid()), {
    label: labelFor(curDue),
    dueDate: curDue,
    amount: cfg.rentAmount,
    status: "pending",
    paidDate: null,
    method: "",
    confirmedBy: "",
  }));

  await Promise.all(writes);
}

async function getPayments(){
  await authReady;
  const snap = await getDocs(query(PAYMENTS_COL, orderBy("dueDate", "desc")));
  if (snap.empty) {
    const cfg = await getConfig();
    if (!cfg.seeded) {
      await seedDemoPayments(cfg);
      await saveConfig({ seeded: true });
      const reSnap = await getDocs(query(PAYMENTS_COL, orderBy("dueDate", "desc")));
      return reSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return [];
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function subscribePayments(callback){
  let unsub = () => {};
  let seeding = false;
  authReady.then(() => {
    const q = query(PAYMENTS_COL, orderBy("dueDate", "desc"));
    unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        if (seeding) return; // seed write already in flight, wait for the next snapshot
        const cfg = await getConfig();
        if (!cfg.seeded) {
          seeding = true;
          await seedDemoPayments(cfg);
          await saveConfig({ seeded: true });
          seeding = false;
          return; // triggers this listener again with the seeded docs
        }
        // Already seeded once before; genuinely empty now because every
        // charge was deleted on purpose. Don't refill it.
        callback([]);
        return;
      }
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  });
  return () => unsub();
}

// Add a charge with any due date and amount. This is the general-purpose
// entry point; addNextPeriod() below is just a convenience wrapper around it.
// The period label is always derived from the due date, never entered by hand.
async function addCharge({ dueDate, amount }){
  await authReady;
  const id = uid();
  await setDoc(doc(db, "ognc_payments", id), {
    label: labelFor(dueDate),
    dueDate,
    amount: Number(amount) || 0,
    status: "pending",
    paidDate: null,
    method: "",
    confirmedBy: "",
  });
  return id;
}

async function addNextPeriod(){
  await authReady;
  const cfg = await getConfig();
  const payments = await getPayments();

  let year, month;
  if (payments.length === 0) {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  } else {
    const sorted = [...payments].sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    const last = sorted[sorted.length - 1];
    const [ly, lm] = last.dueDate.split("-").map(Number);
    const d = new Date(ly, lm - 1 + 1, 1);
    year = d.getFullYear();
    month = d.getMonth();
  }
  const dueDate = dueDateFor(year, month, cfg.dueDay);
  await addCharge({ dueDate, amount: cfg.rentAmount });
}

// Edit an existing charge's due date and/or amount. The period label always
// tracks the due date and is never entered by hand.
async function updateCharge(id, { dueDate, amount }){
  await authReady;
  const ref = doc(db, "ognc_payments", id);
  const patch = {};
  if (dueDate) {
    patch.dueDate = dueDate;
    patch.label = labelFor(dueDate);
  }
  if (amount !== undefined) patch.amount = Number(amount) || 0;
  await updateDoc(ref, patch);
}

async function deleteCharge(id){
  await authReady;
  await deleteDoc(doc(db, "ognc_payments", id));
}

async function markPaid(id, { method = "", paidDate = null } = {}){
  await authReady;
  const cfg = await getConfig();
  const ref = doc(db, "ognc_payments", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const record = snap.data();

  const paid = paidDate || new Date().toISOString().slice(0,10);
  const late = new Date(paid) > new Date(record.dueDate + "T23:59:59");

  await updateDoc(ref, {
    status: late ? "late" : "paid",
    paidDate: paid,
    method: method || record.method || "Confirmed in person",
    confirmedBy: cfg.landlordName,
  });
}

async function undoPayment(id){
  await authReady;
  const ref = doc(db, "ognc_payments", id);
  await updateDoc(ref, {
    status: "pending",
    paidDate: null,
    method: "",
    confirmedBy: "",
  });
}

/* -------------------------------- stats ---------------------------------- */

function computeStats(payments){
  const settled = payments.filter(p => p.status === "paid" || p.status === "late");
  const totalPaid = settled.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const onTime = settled.filter(p => p.status === "paid").length;
  const onTimeRate = settled.length ? Math.round((onTime / settled.length) * 100) : 100;
  const pendingCount = payments.filter(p => p.status === "pending").length;
  return { totalPaid, onTimeRate, settledCount: settled.length, pendingCount };
}

function formatMoney(n){
  return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso){
  if (!iso) return "N/A";
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const OGNC = {
  getConfig, saveConfig, subscribeConfig,
  getPayments, subscribePayments,
  addCharge, addNextPeriod, updateCharge, deleteCharge,
  markPaid, undoPayment,
  computeStats, formatMoney, formatDate,
};

// Also expose globally for convenience / console debugging.
window.OGNC = OGNC;