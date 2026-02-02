const itemsWrap = document.getElementById('cart-items');
const emptyEl = document.getElementById('cart-empty');
const totalEl = document.getElementById('totalPrice');
const summaryEl = document.getElementById('cart-summary');

// ===== LOAD CART =====
function loadCart() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];

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
    total += item.price;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.dataset.index = index;

    div.innerHTML = `
      <img src="${item.image}" alt="">
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-meta">
          ${item.psa ? `PSA ${item.psa}` : 'Raw karta'}
        </div>
        <div class="item-price">${item.price} Kč</div>
      </div>
      <button class="remove">✕</button>
    `;

    itemsWrap.appendChild(div);
  });

  totalEl.textContent = `${total} Kč`;

  // 🔥 Po načtení košíku aktualizuj počet v headeru
  updateCartCount();
}

// ===== CONFIRM REMOVE FLOW =====
itemsWrap.addEventListener('click', e => {
  if (!e.target.classList.contains('remove')) return;

  const card = e.target.closest('.cart-item');
  const index = Number(card.dataset.index);

  // overlay už existuje?
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

  // ==== NE ====
  overlay.querySelector('.confirm-no').onclick = () => {
    overlay.classList.add('confirm-exit');
    setTimeout(() => overlay.remove(), 250);
  };

  // ==== ANO ====
  overlay.querySelector('.confirm-yes').onclick = () => {
    card.classList.add('delete-anim');

    setTimeout(() => {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      cart.splice(index, 1);
      localStorage.setItem('cart', JSON.stringify(cart));

      // 🔥 Okamžitě aktualizuj header
      document.dispatchEvent(new Event('cartUpdated'));

      loadCart();
    }, 450);
  };
});

// ===== HEADER CART COUNT =====
const cartCountEl = document.getElementById('cart-count');

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (cartCountEl) cartCountEl.textContent = cart.length;
}

// 🔥 Reaguj na globální update z detailu karty
document.addEventListener('cartUpdated', updateCartCount);

// ===== START =====
loadCart();