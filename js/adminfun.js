// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET = 'buy-requests';
const SIGNED_URL_TTL = 60 * 10; // 10 min

// Aukce bucket
const AUC_BUCKET = 'auctions';

// ===================== UI HELPERS =====================
const $ = (id) => document.getElementById(id);

const views = {
  login: $('loginView'),
  dash: $('dashView'),
  denied: $('deniedView'),
};

const els = {
  // login
  loginForm: $('loginForm'),
  loginEmail: $('loginEmail'),
  loginPassword: $('loginPassword'),
  loginBtn: $('loginBtn'),
  loginMsg: $('loginMsg'),

  // dash
  dashMsg: $('dashMsg'),
  whoami: $('whoami'),
  countAll: $('countAll'),
  countBuy: $('countBuy'),
  countAuc: $('countAuc'),
  refreshBtn: $('refreshBtn'),
  logoutBtn: $('logoutBtn'),
  deniedLogoutBtn: $('deniedLogoutBtn'),

  // tabs
  tabOrders: $('tabOrders'),
  tabBuy: $('tabBuy'),
  tabAuc: $('tabAuc'),
  ordersPane: $('ordersPane'),
  buyPane: $('buyPane'),
  aucPane: $('aucPane'),

  // orders filters
  searchInput: $('searchInput'),
  statusFilter: $('statusFilter'),
  paymentFilter: $('paymentFilter'),
  exportCsvBtn: $('exportCsvBtn'),

  // orders table
  ordersBody: $('ordersBody'),

  // buy filters
  buySearchInput: $('buySearchInput'),
  buyTypeFilter: $('buyTypeFilter'),
  buySort: $('buySort'),

  // buy table
  buyBody: $('buyBody'),

  // modal
  photoModal: $('photoModal'),
  photoGrid: $('photoGrid'),
  photoMeta: $('photoMeta'),
  closeModalBtn: $('closeModalBtn'),
  downloadZipBtn: $('downloadZipBtn'),
  modalMsg: $('modalMsg'),

  // auctions filters
  aucSearchInput: $('aucSearchInput'),
  aucPubFilter: $('aucPubFilter'),
  aucSort: $('aucSort'),
  aucNewBtn: $('aucNewBtn'),

  // auctions table
  aucBody: $('aucBody'),

  // auctions editor
  aucEditor: $('aucEditor'),
  aucClearBtn: $('aucClearBtn'),
  aucForm: $('aucForm'),
  aucTitle: $('aucTitle'),
  aucUrl: $('aucUrl'),
  aucDesc: $('aucDesc'),
  aucStarts: $('aucStarts'),
  aucEnds: $('aucEnds'),
  aucSortOrder: $('aucSortOrder'),
  aucPublished: $('aucPublished'),
  aucSaveBtn: $('aucSaveBtn'),
  aucMsg: $('aucMsg'),

  // auctions photos
  aucPhotos: $('aucPhotos'),
  aucUploadBtn: $('aucUploadBtn'),
  aucPhotoGrid: $('aucPhotoGrid'),
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
  const { data, error } = await sb.rpc('is_admin');
  if (error) throw error;
  return !!data;
}

// ===================== TABS =====================
let ACTIVE_TAB = 'orders';

function setTab(which) {
  ACTIVE_TAB = which;

  els.tabOrders.classList.toggle('active', which === 'orders');
  els.tabBuy.classList.toggle('active', which === 'buy');
  els.tabAuc.classList.toggle('active', which === 'auc');

  els.ordersPane.classList.toggle('hidden', which !== 'orders');
  els.buyPane.classList.toggle('hidden', which !== 'buy');
  els.aucPane.classList.toggle('hidden', which !== 'auc');

  setMsg(els.dashMsg, '', '');
}

// ===================== DATA =====================
let ORDERS = [];
let BUY = [];
let AUCTIONS = [];

// ---------- Orders ----------
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

function isDone21Days(order) {
  if (!order.shipped_at) return false;
  const shipped = new Date(order.shipped_at);
  const diff = Date.now() - shipped.getTime();
  return diff >= 21 * 24 * 60 * 60 * 1000;
}

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

function getActions(order) {
  const pm = order.payment_method;
  const st = order.status;

  // po 21 dnech po odeslání: hotovo (bez tlačítek)
  if (st === 'shipped' && isDone21Days(order)) {
    return { done: true, actions: [] };
  }

  // BANK
  if (pm === 'bank') {
    if (st === 'awaiting_payment') return { done:false, actions:['paid','cancel'] };
    if (st === 'paid') return { done:false, actions:['shipped','cancel'] };
    if (st === 'shipped') return { done:false, actions:['returned','cancel'] };
  }

  // COD
  if (pm === 'cod') {
    if (st === 'new') return { done:false, actions:['shipped','cancel'] };
    if (st === 'shipped') return { done:false, actions:['paid','returned','cancel'] };
    if (st === 'paid') return { done:false, actions:['returned','cancel'] };
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

function renderOrdersTable() {
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
        <td><strong>${escapeHtml(o.order_number || '—')}</strong></td>
        <td>${escapeHtml(o.status || '—')}</td>
        <td>${escapeHtml(o.payment_method || '—')}</td>
        <td><strong>${fmtKc(o.total)}</strong><br><span class="muted">ship: ${fmtKc(o.shipping_price)}</span></td>
        <td>${escapeHtml(o.first_name || '')} ${escapeHtml(o.last_name || '')}<br><span class="muted">${escapeHtml(o.email || '')}</span></td>
        <td>${escapeHtml(o.street || '')}<br>${escapeHtml(o.zip || '')} ${escapeHtml(o.city || '')}</td>
        <td>${escapeHtml(o.delivery_point_name || '—')}<br><span class="muted">${escapeHtml(o.delivery_point_id || '')}</span></td>
        <td>${fmtDt(o.created_at)}</td>
        <td>${o.payment_method === 'bank' ? fmtDt(o.reserved_until) : '—'}</td>
        <td>${actionButtons(o)}</td>
      </tr>
    `;
  }).join('');
}

async function doOrderAction(act, orderId) {
  let fn = null;
  if (act === 'paid') fn = 'admin_mark_paid';
  if (act === 'shipped') fn = 'admin_mark_shipped';
  if (act === 'returned') fn = 'admin_mark_returned';
  if (act === 'cancel') fn = 'admin_cancel_order';
  if (!fn) return;

  if (act === 'cancel') {
    if (!confirm('Fakt zrušit objednávku?')) return;
  }

  const { error } = await sb.rpc(fn, { p_order_id: orderId });
  if (error) throw error;

  await loadOrders();
  renderOrdersTable();
}

// ---------- CSV export ----------
function parseStreet(street) {
  if (!street) return { streetName:'', house:'' };
  const match = street.match(/^(.*?)(\d+\w*)$/);
  if (!match) return { streetName: street, house:'' };
  return { streetName: match[1].trim(), house: match[2].trim() };
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

// ---------- Buy requests ----------
async function loadBuyRequests() {
  const { data, error } = await sb
    .from('buy_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  BUY = data || [];
  els.countBuy.textContent = String(BUY.length);
}

function getFilteredBuy() {
  const q = String(els.buySearchInput.value || '').trim().toLowerCase();
  const t = els.buyTypeFilter.value || 'all';
  const sort = els.buySort.value || 'newest';

  let rows = [...BUY];

  if (t !== 'all') rows = rows.filter(r => r.type === t);

  if (q) {
    rows = rows.filter(r => {
      const hay = [
        r.email,
        r.type,
        r.message,
        JSON.stringify(r.items || {}),
        JSON.stringify(r.bulk || {})
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a,b) => {
    const A = new Date(a.created_at).getTime();
    const B = new Date(b.created_at).getTime();
    return sort === 'oldest' ? (A - B) : (B - A);
  });

  return rows;
}

function pillType(t) {
  if (t === 'singles') return `<span class="pill singles">Kusové</span>`;
  if (t === 'bulk') return `<span class="pill bulk">Bulk</span>`;
  return `<span class="pill">${escapeHtml(t || '—')}</span>`;
}

function buyContentSummary(r) {
  if (r.type === 'bulk') {
    const desc = r.bulk?.description || r.message || '';
    const count = r.bulk?.count || 0;
    return `${escapeHtml(String(desc).slice(0, 90))}${desc.length > 90 ? '…' : ''}<br><span class="muted">Počet: ${escapeHtml(String(count))}</span>`;
  }

  const items = Array.isArray(r.items) ? r.items : [];
  const names = items.slice(0, 3).map(x => x?.name).filter(Boolean);
  const more = items.length > 3 ? ` +${items.length - 3}` : '';
  return `${escapeHtml(names.join(', ') || '—')}${more}<br><span class="muted">Karet: ${items.length}</span>`;
}

function buyPhotoCount(r) {
  const p = r.photo_paths || [];
  return Array.isArray(p) ? p.length : 0;
}

function renderBuyTable() {
  const rows = getFilteredBuy();

  if (!rows.length) {
    els.buyBody.innerHTML = `<tr><td colspan="6" class="muted">Nic tu není.</td></tr>`;
    return;
  }

  els.buyBody.innerHTML = rows.map(r => {
    const photos = buyPhotoCount(r);
    return `
      <tr>
        <td>${fmtDt(r.created_at)}</td>
        <td>${pillType(r.type)}</td>
        <td><strong>${escapeHtml(r.email || '—')}</strong><br><span class="muted">${escapeHtml((r.message || '').slice(0, 60))}${(r.message||'').length>60?'…':''}</span></td>
        <td>${buyContentSummary(r)}</td>
        <td><strong>${photos}</strong></td>
        <td>
          <div class="actions">
            <button class="btn-small" data-buy-act="photos" data-buy-id="${r.id}">Otevřít fotky</button>
            <button class="btn-small" data-buy-act="zip" data-buy-id="${r.id}">Stáhnout vše</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---------- Signed URLs + downloads ----------
async function signedUrl(path) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) throw error;
  return data?.signedUrl;
}

function baseNameFromPath(path) {
  const s = String(path || '');
  const parts = s.split('/');
  return parts[parts.length - 1] || 'photo.jpg';
}

async function fetchAsBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fail (${res.status})`);
  return await res.blob();
}

// ---------- Modal ----------
let MODAL_REQ = null; // aktuální buy_request
let MODAL_URLS = [];  // [{path, url}]

function openModal() {
  els.photoModal.classList.remove('hidden');
}
function closeModal() {
  els.photoModal.classList.add('hidden');
  els.photoGrid.innerHTML = '';
  setMsg(els.modalMsg, '', '');
  MODAL_REQ = null;
  MODAL_URLS = [];
}

async function showPhotosForRequest(reqId) {
  setMsg(els.modalMsg, '', '');
  const req = BUY.find(x => x.id === reqId);
  if (!req) return;

  const paths = Array.isArray(req.photo_paths) ? req.photo_paths : [];
  if (!paths.length) {
    els.photoMeta.textContent = `${req.email} • ${fmtDt(req.created_at)} • bez fotek`;
    els.photoGrid.innerHTML = `<div class="muted">Žádné fotky.</div>`;
    MODAL_REQ = req;
    MODAL_URLS = [];
    openModal();
    return;
  }

  els.photoMeta.textContent = `${req.email} • ${fmtDt(req.created_at)} • fotek: ${paths.length}`;
  els.photoGrid.innerHTML = `<div class="muted">Načítám fotky…</div>`;
  openModal();

  try {
    const out = [];
    for (const p of paths) {
      const url = await signedUrl(p);
      out.push({ path: p, url });
    }
    MODAL_REQ = req;
    MODAL_URLS = out;

    els.photoGrid.innerHTML = out.map(x => {
      const name = baseNameFromPath(x.path);
      return `
        <div class="photo-card">
          <a href="${x.url}" target="_blank" rel="noopener">
            <img src="${x.url}" alt="">
          </a>
          <div class="cap">
            <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <a class="btn-small" href="${x.url}" download="${escapeHtml(name)}">Download</a>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error(e);
    setMsg(els.modalMsg, 'err', `Nešlo načíst fotky: ${e?.message || e}`);
    els.photoGrid.innerHTML = '';
  }
}

async function downloadZipCurrent() {
  if (!MODAL_REQ) return;
  if (!window.JSZip) {
    setMsg(els.modalMsg, 'err', 'Chybí JSZip (knihovna pro ZIP).');
    return;
  }
  if (!MODAL_URLS.length) {
    setMsg(els.modalMsg, 'err', 'Žádné fotky k zabalení.');
    return;
  }

  setMsg(els.modalMsg, '', '');
  els.downloadZipBtn.disabled = true;
  els.downloadZipBtn.textContent = 'Baluju ZIP…';

  try {
    const zip = new JSZip();

    for (let i = 0; i < MODAL_URLS.length; i++) {
      const { path, url } = MODAL_URLS[i];
      const name = baseNameFromPath(path) || `photo-${i+1}.jpg`;

      const blob = await fetchAsBlob(url);
      zip.file(name, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);

    const a = document.createElement('a');
    a.href = url;
    a.download = `vykup-${MODAL_REQ.email || 'request'}-${String(MODAL_REQ.id).slice(0,8)}.zip`;
    a.click();

    setMsg(els.modalMsg, 'ok', 'ZIP stažen ✅');

  } catch (e) {
    console.error(e);
    setMsg(els.modalMsg, 'err', `ZIP fail: ${e?.message || e}`);
  } finally {
    els.downloadZipBtn.disabled = false;
    els.downloadZipBtn.textContent = 'Stáhnout vše (ZIP)';
  }
}

/* ===================== AUKCE (NEW) ===================== */

let AUC_EDIT_ID = null; // null = nová aukce

function toDatetimeLocalValue(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDatetimeLocalValue(v) {
  if (!v) return null;
  // datetime-local je bez timezone -> vytvoří Date v lokálním čase
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // do DB jako timestamptz safe
}

function aucState(a) {
  const now = new Date();
  const starts = a.starts_at ? new Date(a.starts_at) : null;
  const ends = a.ends_at ? new Date(a.ends_at) : null;

  if (!ends || Number.isNaN(ends.getTime())) return 'ended';
  if (ends <= now) return 'ended';
  if (starts && !Number.isNaN(starts.getTime()) && starts > now) return 'scheduled';
  return 'live';
}

function aucBadgeHtml(a) {
  const st = aucState(a);
  if (st === 'live') return `<span class="auc-badge live">LIVE</span>`;
  if (st === 'scheduled') return `<span class="auc-badge scheduled">Plán</span>`;
  return `<span class="auc-badge ended">Hotovo</span>`;
}

function publicAucImgUrl(path) {
  if (!path) return '';
  // pokud je bucket public:
  return `${SUPABASE_URL}/storage/v1/object/public/${AUC_BUCKET}/${encodeURIComponent(path).replaceAll('%2F','/')}`;
}

async function loadAuctions() {
  const { data, error } = await sb
    .from('auctions')
    .select(`
      id, created_at, title, description, fb_url, starts_at, ends_at, is_published, sort_order,
      auction_images:auction_images ( id, path, caption, sort_order )
    `)
    .order('ends_at', { ascending: false })
    .limit(300);

  if (error) throw error;

  (data || []).forEach(a => {
    if (!Array.isArray(a.auction_images)) a.auction_images = [];
    a.auction_images.sort((x,y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
  });

  AUCTIONS = data || [];
  els.countAuc.textContent = String(AUCTIONS.length);
}

function getFilteredAuctions() {
  const q = String(els.aucSearchInput.value || '').trim().toLowerCase();
  const pub = els.aucPubFilter.value || 'all';
  const sort = els.aucSort.value || 'ends_desc';

  let rows = [...AUCTIONS];

  if (pub === 'pub') rows = rows.filter(a => !!a.is_published);
  if (pub === 'unpub') rows = rows.filter(a => !a.is_published);

  if (q) {
    rows = rows.filter(a => {
      const hay = [
        a.title,
        a.description,
        a.fb_url
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  rows.sort((a,b) => {
    const Aend = new Date(a.ends_at || 0).getTime();
    const Bend = new Date(b.ends_at || 0).getTime();
    const Acrt = new Date(a.created_at || 0).getTime();
    const Bcrt = new Date(b.created_at || 0).getTime();

    if (sort === 'ends_asc') return Aend - Bend;
    if (sort === 'newest') return Bcrt - Acrt;
    if (sort === 'oldest') return Acrt - Bcrt;
    return Bend - Aend; // ends_desc
  });

  // secondary sort_order (pokud chceš)
  rows.sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return rows;
}

function renderAuctionsTable() {
  const rows = getFilteredAuctions();

  if (!rows.length) {
    els.aucBody.innerHTML = `<tr><td colspan="7" class="muted">Nic tu není.</td></tr>`;
    return;
  }

  els.aucBody.innerHTML = rows.map(a => {
    const imgCount = Array.isArray(a.auction_images) ? a.auction_images.length : 0;
    return `
      <tr>
        <td><strong>${escapeHtml(a.title || '—')}</strong><br><span class="muted">${escapeHtml((a.description || '').slice(0, 70))}${(a.description||'').length>70?'…':''}</span></td>
        <td>${aucBadgeHtml(a)}</td>
        <td>${fmtDt(a.starts_at)}</td>
        <td><strong>${fmtDt(a.ends_at)}</strong></td>
        <td><strong>${a.is_published ? 'ANO' : 'NE'}</strong></td>
        <td><strong>${imgCount}</strong></td>
        <td>
          <div class="actions">
            <button class="btn-small" data-auc-act="edit" data-auc-id="${a.id}">Upravit</button>
            <button class="btn-small" data-auc-act="toggle" data-auc-id="${a.id}">${a.is_published ? 'Skrýt' : 'Publikovat'}</button>
            <a class="btn-small" href="${escapeHtml(a.fb_url || '#')}" target="_blank" rel="noopener">FB</a>
            <button class="btn-small danger" data-auc-act="delete" data-auc-id="${a.id}">Smazat</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function clearAucEditor() {
  AUC_EDIT_ID = null;
  els.aucTitle.value = '';
  els.aucUrl.value = '';
  els.aucDesc.value = '';
  els.aucStarts.value = '';
  els.aucEnds.value = '';
  els.aucSortOrder.value = '';
  els.aucPublished.checked = false;
  els.aucPhotoGrid.innerHTML = '';
  els.aucPhotos.value = '';
  setMsg(els.aucMsg, '', '');
}

function fillAucEditor(a) {
  AUC_EDIT_ID = a?.id || null;
  els.aucTitle.value = a?.title || '';
  els.aucUrl.value = a?.fb_url || '';
  els.aucDesc.value = a?.description || '';
  els.aucStarts.value = toDatetimeLocalValue(a?.starts_at);
  els.aucEnds.value = toDatetimeLocalValue(a?.ends_at);
  els.aucSortOrder.value = (a?.sort_order ?? '') === null ? '' : String(a?.sort_order ?? '');
  els.aucPublished.checked = !!a?.is_published;

  renderAucPhotoGrid(a);
  setMsg(els.aucMsg, '', '');
}

function renderAucPhotoGrid(a) {
  const imgs = Array.isArray(a?.auction_images) ? a.auction_images : [];
  if (!imgs.length) {
    els.aucPhotoGrid.innerHTML = `<div class="muted">Zatím žádné fotky. Nahraj je nahoře.</div>`;
    return;
  }

  els.aucPhotoGrid.innerHTML = imgs.map(im => {
    const url = publicAucImgUrl(im.path);
    const name = baseNameFromPath(im.path);
    return `
      <div class="auc-photo">
        <a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt=""></a>
        <div class="cap">
          <div class="name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
          <button class="btn-small danger" data-aucimg-act="delete" data-aucimg-id="${im.id}" data-aucimg-path="${escapeHtml(im.path)}">Smazat</button>
        </div>
      </div>
    `;
  }).join('');
}

async function saveAuction() {
  setMsg(els.aucMsg, '', '');

  const title = String(els.aucTitle.value || '').trim();
  const fb_url = String(els.aucUrl.value || '').trim();
  const description = String(els.aucDesc.value || '').trim();

  const starts_at = fromDatetimeLocalValue(els.aucStarts.value);
  const ends_at = fromDatetimeLocalValue(els.aucEnds.value);
  const sort_order_raw = String(els.aucSortOrder.value || '').trim();
  const sort_order = sort_order_raw === '' ? 0 : Number(sort_order_raw);

  const is_published = !!els.aucPublished.checked;

  if (!title || !fb_url || !ends_at) {
    setMsg(els.aucMsg, 'err', 'Vyplň Název + FB URL + Konec.');
    return;
  }
  if (!Number.isFinite(sort_order)) {
    setMsg(els.aucMsg, 'err', 'Řazení musí být číslo.');
    return;
  }

  const payload = {
    title,
    fb_url,
    description: description || null,
    starts_at: starts_at || null,
    ends_at,
    sort_order,
    is_published
  };

  if (!AUC_EDIT_ID) {
    const { data, error } = await sb
      .from('auctions')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    await loadAuctions();
    renderAuctionsTable();

    // otevři editor na nově vytvořenou aukci
    const created = AUCTIONS.find(x => x.id === data.id) || data;
    fillAucEditor(created);

    setMsg(els.aucMsg, 'ok', 'Aukce vytvořená ✅');

  } else {
    const { error } = await sb
      .from('auctions')
      .update(payload)
      .eq('id', AUC_EDIT_ID);

    if (error) throw error;

    await loadAuctions();
    renderAuctionsTable();

    const updated = AUCTIONS.find(x => x.id === AUC_EDIT_ID);
    if (updated) fillAucEditor(updated);

    setMsg(els.aucMsg, 'ok', 'Uloženo ✅');
  }
}

async function toggleAuctionPublish(id) {
  const a = AUCTIONS.find(x => x.id === id);
  if (!a) return;

  const { error } = await sb
    .from('auctions')
    .update({ is_published: !a.is_published })
    .eq('id', id);

  if (error) throw error;

  await loadAuctions();
  renderAuctionsTable();

  if (AUC_EDIT_ID === id) {
    const updated = AUCTIONS.find(x => x.id === id);
    if (updated) fillAucEditor(updated);
  }
}

async function deleteAuction(id) {
  const a = AUCTIONS.find(x => x.id === id);
  if (!a) return;

  const ok = confirm(`Fakt smazat aukci "${a.title}"? (smaže i záznamy fotek v DB)`);
  if (!ok) return;

  // smaž DB (fotky v bucketu zůstanou – to je OK, nebo můžeme doplnit purge později)
  const { error } = await sb.from('auctions').delete().eq('id', id);
  if (error) throw error;

  if (AUC_EDIT_ID === id) clearAucEditor();

  await loadAuctions();
  renderAuctionsTable();
}

async function editAuction(id) {
  const a = AUCTIONS.find(x => x.id === id);
  if (!a) return;
  fillAucEditor(a);
}

async function uploadAuctionPhotos() {
  setMsg(els.aucMsg, '', '');

  if (!AUC_EDIT_ID) {
    setMsg(els.aucMsg, 'err', 'Nejdřív ulož aukci (aby měla ID), pak nahraj fotky.');
    return;
  }

  const files = Array.from(els.aucPhotos.files || []);
  if (!files.length) {
    setMsg(els.aucMsg, 'err', 'Vyber fotky.');
    return;
  }

  els.aucUploadBtn.disabled = true;
  els.aucUploadBtn.textContent = 'Nahrávám…';

  try {
    // zjisti next sort_order pro fotky
    const cur = AUCTIONS.find(x => x.id === AUC_EDIT_ID);
    const base = (cur?.auction_images?.length || 0);

    const inserted = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const safeName = String(f.name || `photo-${i+1}.jpg`).replaceAll(' ', '_');
      const path = `${AUC_EDIT_ID}/${Date.now()}-${i+1}-${safeName}`;

      const { error: upErr } = await sb.storage.from(AUC_BUCKET).upload(path, f, {
        cacheControl: '3600',
        upsert: false,
        contentType: f.type || 'image/jpeg'
      });
      if (upErr) throw upErr;

      inserted.push({
        auction_id: AUC_EDIT_ID,
        path,
        sort_order: base + i
      });
    }

    // zapiš do DB
    const { error: insErr } = await sb.from('auction_images').insert(inserted);
    if (insErr) throw insErr;

    // refresh
    await loadAuctions();
    renderAuctionsTable();
    const updated = AUCTIONS.find(x => x.id === AUC_EDIT_ID);
    if (updated) fillAucEditor(updated);

    els.aucPhotos.value = '';
    setMsg(els.aucMsg, 'ok', `Nahráno: ${files.length} ✅`);

  } catch (e) {
    console.error(e);
    setMsg(els.aucMsg, 'err', `Upload fail: ${e?.message || e}`);
  } finally {
    els.aucUploadBtn.disabled = false;
    els.aucUploadBtn.textContent = 'Nahrát fotky';
  }
}

async function deleteAuctionImage(imgId, path) {
  const ok = confirm('Smazat fotku? (smaže z DB, a pokusí se smazat i ze Storage)');
  if (!ok) return;

  // 1) DB delete
  const { error: delErr } = await sb.from('auction_images').delete().eq('id', imgId);
  if (delErr) throw delErr;

  // 2) best-effort storage remove (když nemáš práva, DB už je čistá)
  try {
    await sb.storage.from(AUC_BUCKET).remove([path]);
  } catch (e) {
    console.warn('Storage remove failed (ignored):', e);
  }

  await loadAuctions();
  renderAuctionsTable();
  const updated = AUCTIONS.find(x => x.id === AUC_EDIT_ID);
  if (updated) fillAucEditor(updated);
}

/* ===================== AUTH FLOW ===================== */
async function refreshAuthUI() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    showView("login");
    setMsg(els.loginMsg, '', '');
    return;
  }

  els.whoami.textContent = session.user?.email || session.user?.id || '—';

  try {
    const ok = await isAdmin();
    if (!ok) {
      showView("denied");
      return;
    }

    showView("dash");

    // load all datasets
    await Promise.all([loadOrders(), loadBuyRequests(), loadAuctions()]);
    renderOrdersTable();
    renderBuyTable();
    renderAuctionsTable();

  } catch (e) {
    console.error(e);
    showView("login");
    setMsg(els.loginMsg, 'err', `Auth chyba: ${e?.message || e}`);
  }
}

/* ===================== EVENTS ===================== */
document.addEventListener("DOMContentLoaded", async () => {
  // Tabs
  els.tabOrders.addEventListener('click', () => setTab('orders'));
  els.tabBuy.addEventListener('click', () => setTab('buy'));
  els.tabAuc.addEventListener('click', () => setTab('auc'));

  // Login
  els.loginForm.addEventListener("submit", async (e) => {
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
    } catch (err) {
      console.error(err);
      setMsg(els.loginMsg, 'err', `Nešlo přihlásit: ${err?.message || err}`);
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = 'Přihlásit';
    }
  });

  // Logout
  async function logout() {
    await sb.auth.signOut();
    showView("login");
  }
  els.logoutBtn.addEventListener("click", logout);
  els.deniedLogoutBtn.addEventListener("click", logout);

  // Reload
  els.refreshBtn.addEventListener("click", async () => {
    try {
      setMsg(els.dashMsg, '', '');
      await Promise.all([loadOrders(), loadBuyRequests(), loadAuctions()]);
      renderOrdersTable();
      renderBuyTable();
      renderAuctionsTable();
      setMsg(els.dashMsg, 'ok', 'Reload ✅');
      setTimeout(() => setMsg(els.dashMsg, '', ''), 900);

      // refresh editor if editing
      if (AUC_EDIT_ID) {
        const updated = AUCTIONS.find(x => x.id === AUC_EDIT_ID);
        if (updated) fillAucEditor(updated);
      }
    } catch (e) {
      console.error(e);
      setMsg(els.dashMsg, 'err', e?.message || String(e));
    }
  });

  // Orders filters
  els.searchInput.addEventListener('input', renderOrdersTable);
  els.statusFilter.addEventListener('change', renderOrdersTable);
  els.paymentFilter.addEventListener('change', renderOrdersTable);

  // CSV
  els.exportCsvBtn.addEventListener('click', exportCsv);

  // Orders action buttons (delegation)
  els.ordersBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    try {
      await doOrderAction(act, id);
    } catch (err) {
      console.error(err);
      alert("Chyba: " + (err?.message || err));
    }
  });

  // Buy filters
  els.buySearchInput.addEventListener('input', renderBuyTable);
  els.buyTypeFilter.addEventListener('change', renderBuyTable);
  els.buySort.addEventListener('change', renderBuyTable);

  // Buy actions (delegation)
  els.buyBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-buy-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-buy-act');
    const id = btn.getAttribute('data-buy-id');
    if (!act || !id) return;

    try {
      if (act === 'photos') await showPhotosForRequest(id);
      if (act === 'zip') {
        await showPhotosForRequest(id);
        await downloadZipCurrent();
      }
    } catch (err) {
      console.error(err);
      alert('Chyba: ' + (err?.message || err));
    }
  });

  // Modal events
  els.closeModalBtn.addEventListener('click', closeModal);
  els.photoModal.addEventListener('click', (e) => {
    if (e.target === els.photoModal) closeModal();
  });
  els.downloadZipBtn.addEventListener('click', downloadZipCurrent);

  // ===================== AUKCE EVENTS =====================
  els.aucSearchInput.addEventListener('input', renderAuctionsTable);
  els.aucPubFilter.addEventListener('change', renderAuctionsTable);
  els.aucSort.addEventListener('change', renderAuctionsTable);

  els.aucNewBtn.addEventListener('click', () => {
    clearAucEditor();
    setTab('auc');
    setMsg(els.aucMsg, '', '');
  });

  els.aucClearBtn.addEventListener('click', () => {
    clearAucEditor();
    setMsg(els.aucMsg, '', '');
  });

  els.aucForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveAuction();
    } catch (err) {
      console.error(err);
      setMsg(els.aucMsg, 'err', err?.message || String(err));
    }
  });

  els.aucUploadBtn.addEventListener('click', async () => {
    try {
      await uploadAuctionPhotos();
    } catch (err) {
      console.error(err);
      setMsg(els.aucMsg, 'err', err?.message || String(err));
    }
  });

  // aukce table actions (delegation)
  els.aucBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-auc-act]');
    if (!btn) return;

    const act = btn.getAttribute('data-auc-act');
    const id = btn.getAttribute('data-auc-id');
    if (!act || !id) return;

    try {
      if (act === 'edit') await editAuction(id);
      if (act === 'toggle') await toggleAuctionPublish(id);
      if (act === 'delete') await deleteAuction(id);
    } catch (err) {
      console.error(err);
      alert('Chyba: ' + (err?.message || err));
    }
  });

  // aukce photo actions (delegation)
  els.aucPhotoGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-aucimg-act]');
    if (!btn) return;

    const act = btn.getAttribute('data-aucimg-act');
    const imgId = btn.getAttribute('data-aucimg-id');
    const path = btn.getAttribute('data-aucimg-path');

    try {
      if (act === 'delete') await deleteAuctionImage(imgId, path);
    } catch (err) {
      console.error(err);
      alert('Chyba: ' + (err?.message || err));
    }
  });

  // keep UI updated if session changes
  sb.auth.onAuthStateChange(() => {
    refreshAuthUI();
  });

  // init
  setTab('orders');
  clearAucEditor();
  await refreshAuthUI();
});
