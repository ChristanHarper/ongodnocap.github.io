/* ==========================================================================
   ON GOD NO CAPITAL INVESTMENTS — data layer
   Everything lives in the browser's localStorage. There is no server.
   This is a private joke site for two friends, not a real financial
   product — passwords below are plain-text convenience locks, not security.
   ========================================================================== */

const OGNC = (() => {
  const CONFIG_KEY = "ognc_config_v1";
  const PAYMENTS_KEY = "ognc_payments_v1";

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

  function getConfig(){
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
      return { ...DEFAULT_CONFIG };
    }
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(partial){
    const current = getConfig();
    const next = { ...current, ...partial };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  function getPayments(){
    const raw = localStorage.getItem(PAYMENTS_KEY);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch(e) {
      return [];
    }
  }

  function savePayments(list){
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(list));
  }

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

  // Seed a handful of months so the site isn't empty on first load.
  function ensureSeeded(){
    const existing = getPayments();
    if (existing.length > 0) return existing;

    const cfg = getConfig();
    const now = new Date();
    const seeded = [];
    // three prior months paid, one on time, one late-but-paid, one right on the dot,
    // plus the current month left pending so there's something to demo.
    const historyOffsets = [-3, -2, -1];
    const statuses = ["paid", "late", "paid"];

    historyOffsets.forEach((offset, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const due = dueDateFor(year, month, cfg.dueDay);
      const isLate = statuses[i] === "late";
      const paidDate = new Date(year, month, cfg.dueDay + (isLate ? 6 : 0));
      seeded.push({
        id: uid(),
        period: `${year}-${String(month+1).padStart(2,"0")}`,
        label: periodLabel(year, month),
        dueDate: due,
        amount: cfg.rentAmount,
        status: statuses[i],
        paidDate: paidDate.toISOString().slice(0,10),
        method: "Cash App",
        confirmedBy: cfg.landlordName,
      });
    });

    // current month, still pending
    const curDue = dueDateFor(now.getFullYear(), now.getMonth(), cfg.dueDay);
    seeded.push({
      id: uid(),
      period: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,
      label: periodLabel(now.getFullYear(), now.getMonth()),
      dueDate: curDue,
      amount: cfg.rentAmount,
      status: "pending",
      paidDate: null,
      method: "",
      confirmedBy: "",
    });

    savePayments(seeded);
    return seeded;
  }

  function addNextPeriod(){
    const cfg = getConfig();
    const payments = getPayments();
    let year, month;
    if (payments.length === 0) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
    } else {
      const sorted = [...payments].sort((a,b) => a.period.localeCompare(b.period));
      const last = sorted[sorted.length - 1];
      const [ly, lm] = last.period.split("-").map(Number);
      const d = new Date(ly, lm - 1 + 1, 1); // next month after last
      year = d.getFullYear();
      month = d.getMonth();
    }
    const period = `${year}-${String(month+1).padStart(2,"0")}`;
    if (payments.some(p => p.period === period)) return payments;

    payments.push({
      id: uid(),
      period,
      label: periodLabel(year, month),
      dueDate: dueDateFor(year, month, cfg.dueDay),
      amount: cfg.rentAmount,
      status: "pending",
      paidDate: null,
      method: "",
      confirmedBy: "",
    });
    savePayments(payments);
    return payments;
  }

  function markPaid(id, { method = "", paidDate = null } = {}){
    const cfg = getConfig();
    const payments = getPayments();
    const idx = payments.findIndex(p => p.id === id);
    if (idx === -1) return payments;

    const record = payments[idx];
    const paid = paidDate || new Date().toISOString().slice(0,10);
    const late = new Date(paid) > new Date(record.dueDate + "T23:59:59");

    payments[idx] = {
      ...record,
      status: late ? "late" : "paid",
      paidDate: paid,
      method: method || record.method || "Confirmed in person",
      confirmedBy: cfg.landlordName,
    };
    savePayments(payments);
    return payments;
  }

  function undoPayment(id){
    const payments = getPayments();
    const idx = payments.findIndex(p => p.id === id);
    if (idx === -1) return payments;
    payments[idx] = {
      ...payments[idx],
      status: "pending",
      paidDate: null,
      method: "",
      confirmedBy: "",
    };
    savePayments(payments);
    return payments;
  }

  function deletePeriod(id){
    const payments = getPayments().filter(p => p.id !== id);
    savePayments(payments);
    return payments;
  }

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

  return {
    getConfig, saveConfig,
    getPayments, savePayments, ensureSeeded,
    addNextPeriod, markPaid, undoPayment, deletePeriod,
    computeStats, formatMoney, formatDate,
  };
})();
