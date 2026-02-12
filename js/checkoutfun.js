// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== PACKETA (Zásilkovna) =====================
const PACKETA_API_KEY = '4b32c40ade3173fb';

// doporučené options – modal + CZ + Z-Box
const PACKETA_OPTIONS = {
  language: 'cs',
  view: 'modal',
  vendors: [
    { country: 'cz' },
    { country: 'cz', group: 'zbox' },
  ],
};

const PICKUP_SS_KEY = 'checkout_pickup_packeta';

// ===================== CART HELPERS =====================
function readCart() {
  const raw = localStorage.getItem('cart');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function normalizeCartItems(cart) {
  const out = [];
  for (const it of cart) {
    const card_id = it?.card_id || it?.id || it?.cardId || it?.card?.id;
    const qty = Number(it?.qty ?? 1) || 1;
    if (!card_id) continue;
    out.push({ card_id, qty });
  }
  return out;
}

// ===================== UI =====================
const els = {};
function grabEls() {
  els.form = document.getElementById('checkoutForm');
  els.msg = document.getElementById('formMsg');
  els.btn = document.getElementById('submitOrder');

  els.firstName = document.getElementById('firstName');
  els.lastName = document.getElementById('lastName');
  els.email = document.getElementById('email');
  els.phone = document.getElementById('phone');
  els.street = document.getElementById('street');
  els.city = document.getElementById('city');
  els.zip = document.getElementById('zip');
  els.country = document.getElementById('country');
  els.note = document.getElementById('note');

  els.terms = document.getElementById('termsAccepted');
  els.gdpr = document.getElementById('gdprAccepted');

  els.cartMini = document.getElementById('cartMini');
  els.sumSubtotal = document.getElementById('sumSubtotal');
  els.sumShip = document.getElementById('sumShip');
  els.sumTotal = document.getElementById('sumTotal');
  els.reserveHint = document.getElementById('reserveHint');

  els.pickBtn = document.getElementById('pickPacketa');
  els.pickSelected = document.getElementById('pickupSelected');
}

function setMsg(type, text) {
  if (!els.msg) return;
  els.msg.className = 'form-msg ' + (type || '');
  els.msg.textContent = text || '';
}

function getSelected(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

// Jen Zásilkovna + dobírka fee
function calcFees(payment) {
  const ship = 89;
  const cod = payment === 'cod' ? 35 : 0;
  return { ship, cod, extra: ship + cod };
}

function formatKc(n) {
  const x = Number(n || 0);
  return `${x} Kč`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

// ===================== PICKUP (sessionStorage) =====================
function readPickup() {
  const raw = sessionStorage.getItem(PICKUP_SS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function savePickup(point) {
  sessionStorage.setItem(PICKUP_SS_KEY, JSON.stringify(point));
}

function clearPickup() {
  sessionStorage.removeItem(PICKUP_SS_KEY);
}

function renderPickup() {
  const p = readPickup();
  if (!els.pickSelected) return;

  if (!p) {
    els.pickSelected.innerHTML = `<span class="muted">Zatím nic vybráno.</span>`;
    return;
  }

  const name = p?.name || p?.place || 'Výdejní místo';
  const city = p?.city || '';
  const street = p?.street || '';
  const id = p?.id || p?.pickupPointId || p?.carrierPickupPointId || '';

  els.pickSelected.innerHTML = `
    <div class="pickup-line">
      <strong>${escapeHtml(name)}</strong><br>
      <span class="muted">${escapeHtml([street, city].filter(Boolean).join(', '))}</span>
    </div>
    <div class="pickup-meta muted">ID: ${escapeHtml(String(id || '—'))}</div>
  `;
}

function openPacketaWidget() {
  // ✅ debug ať přesně víš co se děje
  console.log('Packeta click:', {
    hasPacketa: !!window.Packeta,
    hasPick: !!window.Packeta?.Widget?.pick,
    apiKeyLen: (PACKETA_API_KEY || '').length
  });

  if (!PACKETA_API_KEY) {
    setMsg('err', 'Chybí Packeta API key (PACKETA_API_KEY).');
    return;
  }

  if (!window.Packeta?.Widget?.pick) {
    setMsg('err', 'Packeta widget se nenačetl. Zkontroluj, že v <head> je library.js.');
    return;
  }

  const onPick = (point) => {
    if (!point) return; // user zavřel bez výběru
    savePickup(point);
    renderPickup();
    setMsg('ok', 'Výdejní místo vybráno ✅');
  };

  // ✅ otevři widget
  window.Packeta.Widget.pick(PACKETA_API_KEY, onPick, PACKETA_OPTIONS);
}

// ===================== MINI SUMMARY =====================
function renderMiniSummary() {
  const cart = readCart();
  if (!cart.length) {
    els.cartMini.innerHTML = `<p style="opacity:.7">Košík je prázdný.</p>`;
    els.sumSubtotal.textContent = formatKc(0);
    els.sumShip.textContent = formatKc(0);
    els.sumTotal.textContent = formatKc(0);
    els.reserveHint.textContent = '';
    return;
  }

  const payment = getSelected('payment') || 'bank';
  const fees = calcFees(payment);

  let subtotal = 0;
  for (const it of cart) {
    const price = Number(it?.price ?? it?.card?.price ?? 0);
    const qty = Number(it?.qty ?? 1) || 1;
    subtotal += price * qty;
  }

  const itemsHtml = cart.slice(0, 12).map(it => {
    const name = it?.name || it?.card?.name || 'Karta';
    const img = it?.image || it?.image_url || it?.imageUrl || it?.card?.image_url || '';
    const price = Number(it?.price ?? it?.card?.price ?? 0);
    return `
      <div class="mini-item">
        <img src="${img}" alt="">
        <div>
          <strong>${escapeHtml(name)}</strong>
          <div class="muted">${price ? formatKc(price) : ''}</div>
        </div>
        <div style="opacity:.75;font-weight:900;">×${Number(it?.qty ?? 1) || 1}</div>
      </div>
    `;
  }).join('');

  els.cartMini.innerHTML = itemsHtml + (cart.length > 12 ? `<p class="muted">+ další položky…</p>` : '');

  els.sumSubtotal.textContent = formatKc(subtotal);
  els.sumShip.textContent = formatKc(fees.extra);
  els.sumTotal.textContent = formatKc(subtotal + fees.extra);

  els.reserveHint.textContent =
    payment === 'bank'
      ? 'Rezervace na 24 hodin po vytvoření objednávky.'
      : 'Dobírka: rezervace bez limitu, stav se uzavírá ručně.';
}

// ===================== SUBMIT =====================
function validateForm() {
  const required = [
    ['Jméno', els.firstName.value],
    ['Příjmení', els.lastName.value],
    ['E-mail', els.email.value],
    ['Ulice', els.street.value],
    ['Město', els.city.value],
    ['PSČ', els.zip.value],
  ];

  for (const [label, val] of required) {
    if (!String(val || '').trim()) return `Chybí: ${label}`;
  }

  if (!els.terms.checked) return 'Musíš souhlasit s obchodními podmínkami.';
  if (!els.gdpr.checked) return 'Musíš souhlasit se zpracováním osobních údajů.';

  const pickup = readPickup();
  if (!pickup) return 'Vyber výdejní místo (Zásilkovna).';

  const cart = normalizeCartItems(readCart());
  if (!cart.length) return 'Košík je prázdný.';

  return null;
}

async function createOrder(payload) {
  const { data, error } = await sb.rpc('create_order_and_reserve', { payload });
  if (error) throw error;
  return data;
}

function buildPayload() {
  const cart = normalizeCartItems(readCart());
  const payment_method = getSelected('payment') || 'bank';
  const pickup = readPickup();

  const pickupId =
    pickup?.id ||
    pickup?.carrierPickupPointId ||
    pickup?.pickupPointId ||
    null;

  const pickupName =
    pickup?.name ||
    pickup?.place ||
    pickup?.formatedValue ||
    null;

  return {
    email: String(els.email.value || '').trim(),
    phone: String(els.phone.value || '').trim() || null,
    first_name: String(els.firstName.value || '').trim(),
    last_name: String(els.lastName.value || '').trim(),
    street: String(els.street.value || '').trim(),
    city: String(els.city.value || '').trim(),
    zip: String(els.zip.value || '').trim(),
    country: String(els.country.value || 'CZ').trim(),

    delivery_method: 'zasilkovna',
    delivery_point_id: pickupId,
    delivery_point_name: pickupName,

    payment_method,
    note: String(els.note.value || '').trim() || null,

    terms_accepted: true,
    gdpr_accepted: true,

    items: cart
  };
}

function lockUI(locked) {
  els.btn.disabled = !!locked;
  els.btn.textContent = locked ? 'Vytvářím objednávku…' : 'Objednat';
}

function saveLastOrder(resp, payload) {
  const info = {
    created_at: new Date().toISOString(),
    order_id: resp?.order_id,
    order_number: resp?.order_number,
    reserved_until: resp?.reserved_until,
    subtotal: resp?.subtotal,
    shipping: resp?.shipping,
    cod_fee: resp?.cod_fee,
    total: resp?.total,
    payment_method: payload?.payment_method,
    delivery_method: payload?.delivery_method,
    delivery_point_id: payload?.delivery_point_id,
    delivery_point_name: payload?.delivery_point_name,
    email: payload?.email
  };
  sessionStorage.setItem('last_order', JSON.stringify(info));
}

function clearCart() {
  localStorage.removeItem('cart');
}

function goThankYou(orderId, orderNumber) {
  const p = new URLSearchParams();
  if (orderId) p.set('order_id', orderId);
  if (orderNumber) p.set('order_number', orderNumber);
  location.href = `dekuji.html?${p.toString()}`;
}

document.addEventListener('DOMContentLoaded', () => {
  grabEls();

  renderPickup();

  // ✅ click na tlačítko
  els.pickBtn?.addEventListener('click', () => {
    setMsg('', '');
    openPacketaWidget();
  });

  renderMiniSummary();
  document.getElementById('paymentChoices')?.addEventListener('change', renderMiniSummary);

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('', '');

    const err = validateForm();
    if (err) {
      setMsg('err', err);
      return;
    }

    const payload = buildPayload();

    try {
      lockUI(true);
      const resp = await createOrder(payload);

      if (!resp?.ok) throw new Error('Objednávku se nepodařilo vytvořit.');

      saveLastOrder(resp, payload);
      clearCart();
      clearPickup();

      setMsg('ok', 'Objednávka vytvořena. Přesměrovávám…');
      goThankYou(resp.order_id, resp.order_number);

    } catch (ex) {
      console.error(ex);
      setMsg('err', `Nešlo to dokončit: ${ex?.message || ex}`);
      lockUI(false);
    }
  });
});
