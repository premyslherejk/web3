const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menu-button');
const cartCountEl = document.getElementById('cart-count');

// ===== MENU =====
menuBtn?.addEventListener('click', () => {
  menu.classList.toggle('active');
});

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    menu.classList.remove('active');
  }
});

// ===== CART COUNT =====
function updateCartCount(){
  if(!cartCountEl) return;

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  cartCountEl.textContent = cart.length;

  // schovej bublinu když je 0
  cartCountEl.style.display = cart.length ? 'flex' : 'none';
}

// při načtení stránky
document.addEventListener('DOMContentLoaded', updateCartCount);

// při změně z jiné záložky
window.addEventListener('storage', updateCartCount);

// 🔥 CUSTOM EVENT – klíč k okamžité aktualizaci
document.addEventListener('cartUpdated', updateCartCount);

// globálně dostupné (volitelné)
window.updateCartCount = updateCartCount;