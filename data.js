/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — data layer (Firestore-backed)
   Replaces the old localStorage version. Config lives at ognc_meta/config,
   payments live in the ognc_payments collection. Reads are open; writes
   require anonymous auth (see firebase.js for the caveat on what that
   does and doesn't protect).
   ========================================================================== */

import { db, authReady } from "./firebase.js";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CONFIG_DOC = doc(db, "ognc_meta", "config");
const PAYMENTS_COL = collection(db, "ognc_payments");

const DEFAULT_CONFIG = {
  tenantName: "The Tenant",
  propertyLabel: "The Room — Primary Residence",
  rentAmount: 650,
  dueDay: 1,
  adminPassword: "scarface",
  renterPassword: "nocap",
  landlordName: "Brandon",
};

const MONTHS = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];

function uid(){
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

function periodLabel(year, monthIndex){
  return `${MONTHS[monthIndex]} ${year}`;
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
    const id = uid();
    writes.push(setDoc(doc(db, "ognc_payments", id), {
      period: `${year}-${String(month+1).padStart(2,"0")}`,
      label: periodLabel(year, month),
      dueDate: due,
      amount: cfg.rentAmount,
      status: statuses[i],
      paidDate: paidDate.toISOString().slice(0,10),
      method: "Cash App",
      confirmedBy: cfg.landlordName,
    }));
  });

  const curDue = dueDateFor(now.getFullYear(), now.getMonth(), cfg.dueDay);
  const curId = uid();
  writes.push(setDoc(doc(db, "ognc_payments", curId), {
    period: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,
    label: periodLabel(now.getFullYear(), now.getMonth()),
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
  const snap = await getDocs(query(PAYMENTS_COL, orderBy("period", "desc")));
  if (snap.empty) {
    const cfg = await getConfig();
    await seedDemoPayments(cfg);
    const reSnap = await getDocs(query(PAYMENTS_COL, orderBy("period", "desc")));
    return reSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function subscribePayments(callback){
  let unsub = () => {};
  let seeding = false;
  authReady.then(() => {
    const q = query(PAYMENTS_COL, orderBy("period", "desc"));
    unsub = onSnapshot(q, async (snap) => {
      if (snap.empty && !seeding) {
        seeding = true;
        const cfg = await getConfig();
        await seedDemoPayments(cfg);
        seeding = false;
        return; // triggers this listener again with the seeded docs
      }
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  });
  return () => unsub();
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
    const sorted = [...payments].sort((a,b) => a.period.localeCompare(b.period));
    const last = sorted[sorted.length - 1];
    const [ly, lm] = last.period.split("-").map(Number);
    const d = new Date(ly, lm - 1 + 1, 1);
    year = d.getFullYear();
    month = d.getMonth();
  }
  const period = `${year}-${String(month+1).padStart(2,"0")}`;
  if (payments.some(p => p.period === period)) return;

  const id = uid();
  await setDoc(doc(db, "ognc_payments", id), {
    period,
    label: periodLabel(year, month),
    dueDate: dueDateFor(year, month, cfg.dueDay),
    amount: cfg.rentAmount,
    status: "pending",
    paidDate: null,
    method: "",
    confirmedBy: "",
  });
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
  if (!iso) return "—";
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export const OGNC = {
  getConfig, saveConfig, subscribeConfig,
  getPayments, subscribePayments,
  addNextPeriod, markPaid, undoPayment,
  computeStats, formatMoney, formatDate,
};

// Also expose globally for convenience / console debugging.
window.OGNC = OGNC;
