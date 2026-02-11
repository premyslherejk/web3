// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'; // <- vlož stejnou jako používáš jinde

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== CART HELPERS =====================
// Podporujeme víc formátů, protože každý to má v localStorage jinak.
// Preferované: [{ card_id: "...uuid...", qty: 1 }]
// Fallback: [{ id: "...uuid...", qty: 1 }]
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
  // u tebe jsou kusovky -> qty vždy 1 (ale necháme to obecně)
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
}

function setMsg(type, text) {
  els.msg.className = 'form-msg ' + (type || '');
  els.msg.textContent = text || '';
}

function getSelected(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

// Ceník
function calcFees(delivery, payment) {
  const ship = delivery === 'zasilkovna' ? 89 : (delivery === 'balikovna' ? 85 : 0);
  const cod = payment === 'cod' ? 35 : 0;
  return { ship, cod, extra: ship + cod };
}

function formatKc(n) {
  const x = Number(n || 0);
  return `${x} Kč`;
}

// ===================== MINI SUMMARY =====================
// Pro mini shrnutí si vezmeme data z localStorage, pokud tam máš uložené i jméno/cenu.
// Pokud ne, pořád to ukáže aspoň počet položek.
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

  const delivery = getSelected('delivery') || 'zasilkovna';
  const payment = getSelected('payment') || 'bank';
  const fees = calcFees(delivery, payment);

  // subtotal z localstorage (pokud existuje price)
  let subtotal = 0;
  for (const it of cart) {
    const price = Number(it?.price ?? it?.card?.price ?? 0);
    const qty = Number(it?.qty ?? 1) || 1;
    subtotal += price * qty;
  }

  // list
  const itemsHtml = cart.slice(0, 12).map(it => {
    const name = it?.name || it?.card?.name || 'Karta';
    const img = it?.image_url || it?.imageUrl || it?.card?.image_url || '';
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

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
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

  const cart = normalizeCartItems(readCart());
  if (!cart.length) return 'Košík je prázdný.';

  return null;
}

async function createOrder(payload) {
  // RPC call: create_order_and_reserve(payload jsonb)
  const { data, error } = await sb.rpc('create_order_and_reserve', { payload });
  if (error) throw error;
  return data;
}

function buildPayload() {
  const cart = normalizeCartItems(readCart());
  const delivery_method = getSelected('delivery') || 'zasilkovna';
  const payment_method = getSelected('payment') || 'bank';

  return {
    email: String(els.email.value || '').trim(),
    phone: String(els.phone.value || '').trim() || null,
    first_name: String(els.firstName.value || '').trim(),
    last_name: String(els.lastName.value || '').trim(),
    street: String(els.street.value || '').trim(),
    city: String(els.city.value || '').trim(),
    zip: String(els.zip.value || '').trim(),
    country: String(els.country.value || 'CZ').trim(),

    delivery_method,
    // zatím bez widgetu:
    delivery_point_id: null,
    delivery_point_name: null,

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
  // uložíme pro dekuji.html
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
  renderMiniSummary();

  // přepočítávat shrnutí při změně dopravy/platby
  document.getElementById('deliveryChoices')?.addEventListener('change', renderMiniSummary);
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

      if (!resp?.ok) {
        throw new Error('Objednávku se nepodařilo vytvořit.');
      }

      saveLastOrder(resp, payload);
      clearCart();

      setMsg('ok', 'Objednávka vytvořena. Přesměrovávám…');
      goThankYou(resp.order_id, resp.order_number);

    } catch (ex) {
      console.error(ex);
      setMsg('err', `Nešlo to dokončit: ${ex?.message || ex}`);
      lockUI(false);
    }
  });
});
