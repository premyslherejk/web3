// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== UI HELPERS =====================
const $ = (id) => document.getElementById(id);

const views = {
  login: $('loginView'),
  dash: $('dashView'),
  denied: $('deniedView'),
};

const els = {
  loginForm: $('loginForm'),
  loginEmail: $('loginEmail'),
  loginPassword: $('loginPassword'),
  loginBtn: $('loginBtn'),
  loginMsg: $('loginMsg'),

  dashMsg: $('dashMsg'),
  whoami: $('whoami'),
  countAll: $('countAll'),
  refreshBtn: $('refreshBtn'),
  logoutBtn: $('logoutBtn'),
  deniedLogoutBtn: $('deniedLogoutBtn'),

  exportCsvBtn: $('exportCsvBtn'),

  ordersBody: $('ordersBody'),
  searchInput: $('searchInput'),
  statusFilter: $('statusFilter'),
  paymentFilter: $('paymentFilter'),
};

function showView(which) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[which].classList.remove('hidden');
}

function setMsg(el, type, text) {
  if (!el) return;
  el.className = 'msg ' + (type || '');
  el.textContent = text || '';
}

function fmtKc(n) {
  return `${Number(n || 0)} Kč`;
}

function fmtDt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('cs-CZ', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit'
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

// ===================== ADMIN CHECK =====================
async function isAdmin() {
  const { data, error } = await sb.rpc('is_admin');
  if (error) throw error;
  return !!data;
}

// ===================== DATA =====================
let ORDERS = [];

async function loadOrders() {
  const { data, error } = await sb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  ORDERS = data || [];
  els.countAll.textContent = String(ORDERS.length);
}

// ===================== FILTERS =====================
function getFilteredOrders() {
  const q = String(els.searchInput.value || '').trim().toLowerCase();
  const st = els.statusFilter.value || 'all';
  const pay = els.paymentFilter.value || 'all';

  return ORDERS.filter(o => {
    if (st !== 'all' && o.status !== st) return false;
    if (pay !== 'all' && o.payment_method !== pay) return false;

    if (!q) return true;

    const hay = [
      o.order_number,
      o.email,
      o.first_name,
      o.last_name,
      o.delivery_point_name,
      o.delivery_point_id,
    ].filter(Boolean).join(' ').toLowerCase();

    return hay.includes(q);
  });
}

// ===================== DONE 21 DAYS =====================
function isDone21Days(order) {
  if (!order.shipped_at) return false;
  const shipped = new Date(order.shipped_at);
  const diff = Date.now() - shipped.getTime();
  return diff >= 21 * 24 * 60 * 60 * 1000;
}

// ===================== COLOR CLASS =====================
function getRowClass(order) {
  const pm = order.payment_method;
  const st = order.status;

  if (st === 'awaiting_payment') return 'is-red';

  if (pm === 'bank') {
    if (st === 'paid') return 'is-blue';
    if (st === 'shipped') return 'is-green';
  }

  if (pm === 'cod') {
    if (st === 'new') return 'is-red';
    if (st === 'shipped') return 'is-yellow';
    if (st === 'paid') return 'is-green';
  }

  return '';
}

// ===================== ACTIONS =====================
function getActions(order) {
  const pm = order.payment_method;
  const st = order.status;

  if (st === 'shipped' && isDone21Days(order)) {
    return { done: true, actions: [] };
  }

  if (pm === 'bank') {
    if (st === 'awaiting_payment') return { done:false, actions:['paid','cancel'] };
    if (st === 'paid') return { done:false, actions:['shipped'] };
    if (st === 'shipped') return { done:false, actions:['returned'] };
  }

  if (pm === 'cod') {
    if (st === 'new') return { done:false, actions:['shipped','cancel'] };
    if (st === 'shipped') return { done:false, actions:['paid','returned','cancel'] };
    if (st === 'paid') return { done:false, actions:['returned'] };
  }

  return { done:false, actions:[] };
}

function actionButtons(order) {
  const { done, actions } = getActions(order);

  if (done) return `<span class="done-label">HOTOVO ✅</span>`;

  return `
    <div class="actions">
      ${actions.includes('paid') ? `<button class="btn-small" data-act="paid" data-id="${order.id}">Zaplaceno</button>` : ''}
      ${actions.includes('shipped') ? `<button class="btn-small" data-act="shipped" data-id="${order.id}">Odesláno</button>` : ''}
      ${actions.includes('returned') ? `<button class="btn-small" data-act="returned" data-id="${order.id}">Vráceno</button>` : ''}
      ${actions.includes('cancel') ? `<button class="btn-small danger" data-act="cancel" data-id="${order.id}">Zrušit</button>` : ''}
    </div>
  `;
}

// ===================== RENDER =====================
function renderTable() {
  const rows = getFilteredOrders();

  if (!rows.length) {
    els.ordersBody.innerHTML = `<tr><td colspan="11" class="muted">Nic tu není.</td></tr>`;
    return;
  }

  els.ordersBody.innerHTML = rows.map(o => {
    const rowClass = getRowClass(o);

    return `
      <tr class="${rowClass}">
        <td><input type="checkbox" class="pickbox" data-pick="${o.id}"></td>

        <td><strong>${escapeHtml(o.order_number)}</strong></td>
        <td>${escapeHtml(o.status)}</td>
        <td>${escapeHtml(o.payment_method)}</td>
        <td><strong>${fmtKc(o.total)}</strong></td>
        <td>${escapeHtml(o.first_name)} ${escapeHtml(o.last_name)}</td>
        <td>${escapeHtml(o.street)}, ${escapeHtml(o.city)}</td>
        <td>${escapeHtml(o.delivery_point_id || '—')}</td>
        <td>${fmtDt(o.created_at)}</td>
        <td>${o.payment_method === 'bank' ? fmtDt(o.reserved_until) : '—'}</td>
        <td>${actionButtons(o)}</td>
      </tr>
    `;
  }).join('');
}

// ===================== ACTION RPC =====================
async function doAction(act, orderId) {
  let fn = null;

  if (act === 'paid') fn = 'admin_mark_paid';
  if (act === 'shipped') fn = 'admin_mark_shipped';
  if (act === 'returned') fn = 'admin_mark_returned';
  if (act === 'cancel') fn = 'admin_cancel_order';

  if (!fn) return;

  if (act === 'cancel') {
    if (!confirm("Fakt zrušit objednávku?")) return;
  }

  const { error } = await sb.rpc(fn, { p_order_id: orderId });
  if (error) throw error;

  await loadOrders();
  renderTable();
}

// ===================== CSV EXPORT =====================
function parseStreet(street) {
  if (!street) return { streetName:'', house:'' };

  const match = street.match(/^(.*?)(\d+\w*)$/);
  if (!match) return { streetName: street, house:'' };

  return {
    streetName: match[1].trim(),
    house: match[2].trim()
  };
}

function exportCsv() {
  const picked = Array.from(document.querySelectorAll("[data-pick]:checked"))
    .map(x => x.getAttribute("data-pick"));

  if (!picked.length) {
    alert("Nejdřív označ objednávky checkboxem.");
    return;
  }

  const selectedOrders = ORDERS.filter(o => picked.includes(o.id));

  const headers = [
    "order_number","first_name","last_name","email","phone",
    "cod","value","currency","weight_grams",
    "pickup_point_id","street","house_number","city","note"
  ];

  let csv = "\uFEFF" + headers.join(";") + "\n";

  selectedOrders.forEach(o => {
    const isCod = o.payment_method === "cod";
    const { streetName, house } = parseStreet(o.street);

    const row = [
      o.order_number,
      o.first_name,
      o.last_name,
      o.email,
      o.phone || "",
      isCod ? "1" : "0",
      o.total,
      "CZK",
      o.weight_grams || 0,
      o.delivery_point_id || "",
      streetName,
      house,
      o.city,
      o.note || ""
    ];

    csv += row.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(";") + "\n";
  });

  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "zasilkovna_export.csv";
  a.click();
}

// ===================== AUTH FLOW =====================
async function refreshAuthUI() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    showView("login");
    return;
  }

  els.whoami.textContent = session.user.email;

  const ok = await isAdmin();
  if (!ok) {
    showView("denied");
    return;
  }

  showView("dash");
  await loadOrders();
  renderTable();
}

// ===================== EVENTS =====================
document.addEventListener("DOMContentLoaded", async () => {

  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);

    refreshAuthUI();
  });

  els.logoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    showView("login");
  });

  els.deniedLogoutBtn.addEventListener("click", async () => {
    await sb.auth.signOut();
    showView("login");
  });

  els.refreshBtn.addEventListener("click", async () => {
    await loadOrders();
    renderTable();
  });

  els.exportCsvBtn.addEventListener("click", exportCsv);

  els.searchInput.addEventListener("input", renderTable);
  els.statusFilter.addEventListener("change", renderTable);
  els.paymentFilter.addEventListener("change", renderTable);

  els.ordersBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    try {
      await doAction(act, id);
    } catch (err) {
      alert("Chyba: " + err.message);
    }
  });

  refreshAuthUI();
});
