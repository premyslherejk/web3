// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

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
  const x = Number(n || 0);
  return `${x} Kč`;
}

function fmtDt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('cs-CZ', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

async function isAdmin() {
  // voláme tvou funkci public.is_admin()
  const { data, error } = await sb.rpc('is_admin');
  if (error) throw error;
  return !!data;
}

// ===================== DATA =====================
let ORDERS = [];

async function loadOrders() {
  setMsg(els.dashMsg, '', '');

  // načti objednávky – RLS pustí jen admina
  const { data, error } = await sb
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  ORDERS = data || [];
  els.countAll.textContent = String(ORDERS.length);
}

function getFilteredOrders() {
  const q = String(els.searchInput.value || '').trim().toLowerCase();
  const st = els.statusFilter.value || 'all';
  const pay = els.paymentFilter.value || 'all';

  return ORDERS.filter(o => {
    if (st !== 'all' && (o.status !== st)) return false;
    if (pay !== 'all' && (o.payment_method !== pay)) return false;

    if (!q) return true;

    const hay = [
      o.order_number,
      o.email,
      o.first_name,
      o.last_name,
      o.delivery_point_name,
      o.delivery_point_id,
      o.phone,
    ].filter(Boolean).join(' ').toLowerCase();

    return hay.includes(q);
  });
}

function badgePayment(payment) {
  const cls = payment === 'bank' ? 'badge bank' : 'badge cod';
  return `<span class="${cls}">${escapeHtml(payment)}</span>`;
}

function actionButtons(o) {
  const btns = [];

  // Zaplaceno - jde u bank i cod (podle tvé logiky)
  if (!['paid', 'returned', 'expired', 'cancelled'].includes(o.status)) {
    btns.push(`<button class="btn-small" data-act="paid" data-id="${o.id}">Zaplaceno</button>`);
  }

  // Odesláno - nejde u expired/cancelled/returned
  if (!['returned', 'expired', 'cancelled'].includes(o.status)) {
    btns.push(`<button class="btn-small" data-act="shipped" data-id="${o.id}">Odesláno</button>`);
  }

  // Vráceno (smysl hlavně u dobírky)
  if (!['returned', 'expired', 'cancelled'].includes(o.status)) {
    btns.push(`<button class="btn-small" data-act="returned" data-id="${o.id}">Vráceno</button>`);
  }

  // Zrušit (ne pokud je paid/returned/expired)
  if (!['paid', 'returned', 'expired'].includes(o.status)) {
    btns.push(`<button class="btn-small danger" data-act="cancel" data-id="${o.id}">Zrušit</button>`);
  }

  return `<div class="actions">${btns.join('')}</div>`;
}

function renderTable() {
  const rows = getFilteredOrders();

  if (!rows.length) {
    els.ordersBody.innerHTML = `<tr><td colspan="10" class="muted">Nic tu není.</td></tr>`;
    return;
  }

  els.ordersBody.innerHTML = rows.map(o => {
    const customer = `${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')}<br><span class="muted">${escapeHtml(o.email || '')}${o.phone ? ` • ${escapeHtml(o.phone)}` : ''}</span>`;
    const addr = `${escapeHtml(o.street || '')}<br>${escapeHtml(o.zip || '')} ${escapeHtml(o.city || '')}`;

    const pickup = o.delivery_point_name
      ? `${escapeHtml(o.delivery_point_name)}<br><span class="muted">${escapeHtml(o.delivery_point_id || '')}</span>`
      : `<span class="muted">—</span>`;

    return `
      <tr>
        <td><strong>${escapeHtml(o.order_number || '—')}</strong></td>
        <td><span class="badge">${escapeHtml(o.status || '—')}</span></td>
        <td>${badgePayment(o.payment_method)}</td>
        <td><strong>${fmtKc(o.total)}</strong><br><span class="muted">ship: ${fmtKc(o.shipping_price)}</span></td>
        <td>${customer}</td>
        <td>${addr}</td>
        <td>${pickup}</td>
        <td>${fmtDt(o.created_at)}</td>
        <td>${o.payment_method === 'bank' ? fmtDt(o.reserved_until) : '—'}</td>
        <td>${actionButtons(o)}</td>
      </tr>
    `;
  }).join('');
}

// ===================== ACTIONS =====================
async function doAction(act, orderId) {
  setMsg(els.dashMsg, '', '');
  try {
    let fn = null;
    let args = {};

    if (act === 'paid') { fn = 'admin_mark_paid'; args = { p_order_id: orderId }; }
    if (act === 'shipped') { fn = 'admin_mark_shipped'; args = { p_order_id: orderId }; }
    if (act === 'returned') { fn = 'admin_mark_returned'; args = { p_order_id: orderId }; }
    if (act === 'cancel') { fn = 'admin_cancel_order'; args = { p_order_id: orderId }; }

    if (!fn) return;

    // confirm u zrušení
    if (act === 'cancel') {
      const ok = confirm('Fakt chceš objednávku zrušit? (Karty se vrátí do prodeje)');
      if (!ok) return;
    }

    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;

    setMsg(els.dashMsg, 'ok', 'Hotovo ✅');
    await loadOrders();
    renderTable();

  } catch (e) {
    console.error(e);
    setMsg(els.dashMsg, 'err', `Nešlo to: ${e?.message || e}`);
  }
}

// ===================== AUTH FLOW =====================
async function refreshAuthUI() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    showView('login');
    setMsg(els.loginMsg, '', '');
    return;
  }

  // user is logged in — check admin
  els.whoami.textContent = session.user?.email || session.user?.id || '—';

  try {
    const ok = await isAdmin();
    if (!ok) {
      showView('denied');
      return;
    }

    showView('dash');
    await loadOrders();
    renderTable();

  } catch (e) {
    console.error(e);
    showView('login');
    setMsg(els.loginMsg, 'err', `Auth chyba: ${e?.message || e}`);
  }
}

// ===================== EVENTS =====================
document.addEventListener('DOMContentLoaded', async () => {
  // login
  els.loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(els.loginMsg, '', '');

    const email = String(els.loginEmail.value || '').trim();
    const password = String(els.loginPassword.value || '');

    if (!email || !password) {
      setMsg(els.loginMsg, 'err', 'Vyplň email i heslo.');
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = 'Přihlašuji…';

    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setMsg(els.loginMsg, 'ok', 'Přihlášeno ✅');
      await refreshAuthUI();

    } catch (e2) {
      console.error(e2);
      setMsg(els.loginMsg, 'err', `Nešlo přihlásit: ${e2?.message || e2}`);
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Přihlásit';
    }
  });

  // logout
  async function logout() {
    await sb.auth.signOut();
    showView('login');
  }
  els.logoutBtn?.addEventListener('click', logout);
  els.deniedLogoutBtn?.addEventListener('click', logout);

  // refresh
  els.refreshBtn?.addEventListener('click', async () => {
    try {
      await loadOrders();
      renderTable();
      setMsg(els.dashMsg, 'ok', 'Reload ✅');
      setTimeout(() => setMsg(els.dashMsg, '', ''), 900);
    } catch (e) {
      setMsg(els.dashMsg, 'err', e?.message || String(e));
    }
  });

  // filters
  els.searchInput?.addEventListener('input', renderTable);
  els.statusFilter?.addEventListener('change', renderTable);
  els.paymentFilter?.addEventListener('change', renderTable);

  // table actions (event delegation)
  $('ordersBody')?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    if (!act || !id) return;
    doAction(act, id);
  });

  // keep UI updated if session changes
  sb.auth.onAuthStateChange(() => {
    refreshAuthUI();
  });

  // initial
  await refreshAuthUI();
});
