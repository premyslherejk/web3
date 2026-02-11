const itemsWrap = document.getElementById('cart-items');
const emptyEl = document.getElementById('cart-empty');
const totalEl = document.getElementById('totalPrice');
const summaryEl = document.getElementById('cart-summary');
const checkoutBtn = document.querySelector('.checkout');

const MIN_ORDER = 99;

// ===== TOAST =====
function showToast(msg) {
  let toast = document.querySelector('.toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#ff3b3b',
      color: '#fff',
      padding: '14px 22px',
      borderRadius: '999px',
      fontWeight: '800',
      zIndex: 9999,
      opacity: 0,
      transition: 'opacity .3s'
    });
  }

  toast.textContent = msg;
  toast.style.opacity = 1;

  setTimeout(() => {
    toast.style.opacity = 0;
  }, 2500);
}

// ===== CART STORAGE HELPERS =====
function readCartRaw() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch {
    return [];
  }
}

/**
 * MIGRACE: sjednotíme strukturu položek v localStorage,
 * aby checkout našel image_url (a ideálně i card_id).
 *
 * Podporované vstupy:
 * - { image: "..." }  -> image_url
 * - { image_url: "..." } (ok)
 * - { id: "uuid" } -> card_id
 * - { card_id: "uuid" } (ok)
 */
function migrateCart(cart) {
  let changed = false;

  const next = cart.map((it) => {
    const out = { ...it };

    // id -> card_id (pro checkout / RPC payload)
    if (!out.card_id && out.id) {
      out.card_id = out.id;
      changed = true;
    }

    // image -> image_url (to je tvůj hlavní bug)
    if (!out.image_url && out.image) {
      out.image_url = out.image;
      changed = true;
    }

    // pro kompatibilitu necháme i starý klíč image,
    // ale renderovat budeme image_url
    return out;
  });

  if (changed) {
    localStorage.setItem('cart', JSON.stringify(next));
    document.dispatchEvent(new Event('cartUpdated'));
  }

  return next;
}

// ===== LOAD CART =====
function loadCart() {
  const cart = migrateCart(readCartRaw());

  itemsWrap.innerHTML = '';
  let total = 0;

  if (!cart.length) {
    emptyEl.style.display = 'block';
    summaryEl.style.display = 'none';
    updateCartCount();
    return;
  }

  emptyEl.style.display = 'none';
  summaryEl.style.display = 'flex';

  cart.forEach((item, index) => {
    total += Number(item.price || 0);

    const img = item.image_url || item.image || ''; // fallback

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.dataset.index = index;

    div.innerHTML = `
      <img src="${img}" alt="">
      <div class="item-info">
        <div class="item-name">${item.name || 'Karta'}</div>
        <div class="item-meta">
          ${item.psa ? `PSA ${item.psa}` : 'Raw karta'}
        </div>
        <div class="item-price">${Number(item.price || 0)} Kč</div>
      </div>
      <button class="remove">✕</button>
    `;

    itemsWrap.appendChild(div);
  });

  totalEl.textContent = `${total} Kč`;
  handleCheckoutState(total);
  updateCartCount();
}

// ===== CHECKOUT LOGIKA =====
function handleCheckoutState(total) {
  if (!checkoutBtn) return;

  if (total < MIN_ORDER) {
    checkoutBtn.disabled = true;
    checkoutBtn.style.opacity = '.4';
    checkoutBtn.style.cursor = 'not-allowed';
  } else {
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = '1';
    checkoutBtn.style.cursor = 'pointer';
  }
}

checkoutBtn?.addEventListener('click', e => {
  const total = parseInt(totalEl.textContent);

  if (total < MIN_ORDER) {
    e.preventDefault();
    showToast('Minimální objednávka je 99 Kč');
  }
});

// ===== CONFIRM REMOVE FLOW =====
itemsWrap.addEventListener('click', e => {
  if (!e.target.classList.contains('remove')) return;

  const card = e.target.closest('.cart-item');
  const index = Number(card.dataset.index);

  if (card.querySelector('.confirm-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  overlay.innerHTML = `
    <p>Opravdu chcete produkt odstranit z košíku?</p>
    <div class="confirm-actions">
      <button class="confirm-yes">Ano</button>
      <button class="confirm-no">Ne</button>
    </div>
  `;

  card.appendChild(overlay);

  overlay.querySelector('.confirm-no').onclick = () => {
    overlay.classList.add('confirm-exit');
    setTimeout(() => overlay.remove(), 250);
  };

  overlay.querySelector('.confirm-yes').onclick = () => {
    card.classList.add('delete-anim');

    setTimeout(() => {
      const cart = readCartRaw();
      cart.splice(index, 1);
      localStorage.setItem('cart', JSON.stringify(cart));

      document.dispatchEvent(new Event('cartUpdated'));
      loadCart();
    }, 450);
  };
});

// ===== HEADER CART COUNT =====
const cartCountEl = document.getElementById('cart-count');

function updateCartCount() {
  const cart = readCartRaw();
  if (cartCountEl) cartCountEl.textContent = cart.length;
}

document.addEventListener('cartUpdated', updateCartCount);

// ===== START =====
loadCart();
