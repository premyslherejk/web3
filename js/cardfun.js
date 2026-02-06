const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = supabase.createClient(supabaseUrl, supabaseKey);

// ========= ID =========
const id = new URLSearchParams(window.location.search).get('id');
if (!id) throw new Error('Chybí ID karty');

// ========= ELEMENTY =========
const thumbsWrap = document.getElementById('thumbs');
const mainImg = document.getElementById('current');
const light = document.getElementById('lightbox');
const lightImg = document.getElementById('lightImg');

const nameEl = document.getElementById('name');
const descEl = document.getElementById('description');
const priceEl = document.getElementById('price');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('status');

const psaEl = document.getElementById('psa');
const psaInfoEl = document.getElementById('psa-info');

const conditionEl = document.getElementById('conditionBadge');
const conditionInfoEl = document.getElementById('condition-info');

const addBtn = document.querySelector('.add');
const minOrderEl = document.getElementById('min-order-info');

// ========= STATE =========
let images = [];
let index = 0;
let currentCard = null;

/* =========================
   CONDITION HELPERS
========================= */

function getConditionData(condition) {
  const c = String(condition || '').trim();

  const map = {
    'Excellent': { short: 'EX', full: 'Excellent', cls: 'ex' },
    'Near Mint': { short: 'NM', full: 'Near Mint', cls: 'nm' },
    'Good':      { short: 'GD', full: 'Good', cls: 'gd' },
    'Played':    { short: 'PL', full: 'Played', cls: 'pl' },
    'Poor':      { short: 'PO', full: 'Poor', cls: 'po' },
  };

  // fallback: pokud máš v DB něco mimo map, ukážeme to
  if (map[c]) return map[c];
  return { short: c ? c : 'RAW', full: c ? c : 'RAW', cls: 'unknown' };
}

// ========= LOAD =========
async function loadCard() {
  const { data: card, error } = await sb
    .from('cards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return console.error(error);

  currentCard = card;

  nameEl.textContent = card.name || '';
  descEl.textContent = card.description || '';
  priceEl.textContent = `${card.price} Kč`;
  metaEl.textContent = `Edice: ${card.set || '—'} · Stav: ${card.condition || '—'}`;

  // STATUS
  const st = String(card.status || 'Skladem').trim();
  statusEl.textContent = st;
  statusEl.style.background = (st === 'Rezervováno') ? '#a0a0aa' : '#1f8f3a';
  statusEl.style.color = (st === 'Rezervováno') ? '#0b0b0f' : '#fff';

  handleMinOrderInfo();

  // ===== PSA + CONDITION RULES =====
  const isPsa = !!String(card.psa_grade ?? '').trim();

  // reset PSA UI
  psaEl.style.display = 'none';
  psaInfoEl.style.display = 'none';
  psaEl.textContent = '';
  psaEl.onclick = null;

  // reset CONDITION UI
  conditionEl.style.display = 'none';
  conditionEl.textContent = '';
  conditionEl.className = 'condition';
  conditionEl.onclick = null;

  if (conditionInfoEl) conditionInfoEl.style.display = 'none'; // default hidden

  if (isPsa) {
    // ✅ PSA karta: jen PSA badge + PSA info, žádný stav vysvětlení
    psaEl.textContent = `PSA ${card.psa_grade}`;
    psaEl.style.display = 'inline-flex';
    psaInfoEl.style.display = 'block';

    psaEl.onclick = () => {
      psaInfoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  } else {
    // ✅ RAW karta: condition badge (CELÝ TEXT) + condition vysvětlení
    const d = getConditionData(card.condition);

    conditionEl.textContent = d.full;             // 👈 celým slovem
    conditionEl.className = `condition ${d.cls}`; // barvy zůstávají
    conditionEl.style.display = 'inline-flex';

    if (conditionInfoEl) conditionInfoEl.style.display = 'block';

    conditionEl.onclick = () => {
      conditionInfoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  // ===== IMAGES =====
  images = [];

  if (card.real_images && typeof card.real_images === 'string') {
    images = card.real_images.split(',').map(i => i.trim()).filter(Boolean);
  }

  if (!images.length && card.image_url) images = [card.image_url];
  if (!images.length) return;

  renderImages();
  syncAddButton();
}

// ========= KOŠÍK =========
function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function addToCart() {
  if (!currentCard) return;

  const cart = getCart();
  const exists = cart.find(item => item.id === currentCard.id);
  if (exists) return;

  cart.push({
    id: currentCard.id,
    name: currentCard.name,
    price: currentCard.price,
    image: currentCard.image_url,
    psa: currentCard.psa_grade || null
  });

  saveCart(cart);
  document.dispatchEvent(new Event('cartUpdated'));

  syncAddButton();
  handleMinOrderInfo();
}

// ========= MIN ORDER LOGIKA =========
function handleMinOrderInfo() {
  if (!minOrderEl || !currentCard) return;

  const cartTotal = getCartTotal();

  if (currentCard.price < 100 && cartTotal < 100) {
    minOrderEl.style.display = 'block';
  } else {
    minOrderEl.style.display = 'none';
  }
}

// ========= SYNC TLAČÍTKA =========
function syncAddButton() {
  const cart = getCart();
  const exists = cart.find(item => item.id === currentCard.id);

  if (exists) {
    addBtn.textContent = 'Přidáno ✓';
    addBtn.disabled = true;
    addBtn.classList.add('added');
  } else {
    addBtn.textContent = 'Přidat do košíku';
    addBtn.disabled = false;
    addBtn.classList.remove('added');
  }
}

addBtn.addEventListener('click', addToCart);

// ========= GALERIE =========
function renderImages() {
  thumbsWrap.innerHTML = '';
  index = 0;
  mainImg.src = images[0];

  images.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    if (i === 0) img.classList.add('active');
    img.onclick = () => setImage(i);
    thumbsWrap.appendChild(img);
  });
}

function setImage(i) {
  index = i;
  mainImg.src = images[i];
  [...thumbsWrap.children].forEach(el => el.classList.remove('active'));
  thumbsWrap.children[i].classList.add('active');
}

// ========= LIGHTBOX =========
document.getElementById('mainImage').onclick = () => {
  lightImg.src = images[index];
  light.classList.add('active');
};

document.getElementById('close').onclick = () =>
  light.classList.remove('active');

document.getElementById('prev').onclick = () => nav(-1);
document.getElementById('next').onclick = () => nav(1);

function nav(dir) {
  index = (index + dir + images.length) % images.length;
  setImage(index);
  lightImg.src = images[index];
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') light.classList.remove('active');
});

// ========= START =========
loadCard();
