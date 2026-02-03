const { createClient } = supabase;

const sb = createClient(
  'https://hwjbfrhbgeczukcjkmca.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
);

/* =========================
   GLOBAL STATE
========================= */
const state = {
  language: null,   // EN | JP
  section: null,    // new | hot | null
  edition: null,    // set name
  filtersOpen: false
};

/* =========================
   LOAD CARDS
========================= */
async function loadCards() {
  let q = sb
    .from('cards')
    .select('*')
    .eq('status', 'Skladem');

  // --- BASE STATE ---
  if (state.language) q = q.eq('language', state.language);
  if (state.section === 'new') q = q.eq('new', true);
  if (state.section === 'hot') q = q.eq('hot', true);
  if (state.edition) q = q.eq('set', state.edition);

  // --- SEARCH ---
  const search = document.getElementById('searchInput')?.value;
  if (search) q = q.ilike('name', `%${search}%`);

  // --- FILTERS ---
  const condition = document.getElementById('filter-condition')?.value;
  if (condition) q = q.eq('condition', condition);

  const rarity = document.getElementById('filter-rarity')?.value;
  if (rarity) q = q.eq('rarity', rarity);

  const min = document.getElementById('priceMin')?.value;
  const max = document.getElementById('priceMax')?.value;
  if (min) q = q.gte('price', min);
  if (max) q = q.lte('price', max);

  // --- SORT ---
  const sort = document.getElementById('sort')?.value;
  switch (sort) {
    case 'price_asc':
      q = q.order('price', { ascending: true });
      break;
    case 'price_desc':
      q = q.order('price', { ascending: false });
      break;
    case 'name':
      q = q.order('name', { ascending: true });
      break;
    case 'sold':
      q = q.order('sold_count', { ascending: false });
      break;
    case 'new':
      q = q.order('created_at', { ascending: false });
      break;
  }

  const { data, error } = await q;
  if (error) {
    console.error(error);
    return;
  }

  renderCards(data || []);
}

/* =========================
   RENDER CARDS
========================= */
function renderCards(cards) {
  const grid = document.getElementById('cards');
  grid.innerHTML = '';

  if (!cards.length) {
    grid.innerHTML = `<p class="empty">Nic jsme nenašli 😕</p>`;
    return;
  }

  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'card';
    el.onclick = () => location.href = `card.html?id=${c.id}`;
    el.innerHTML = `
      <img src="${c.image_url}" alt="${c.name}">
      <div class="card-info">
        <strong>${c.name}</strong>
        <div class="meta">
          <span>${c.language}</span>
          <span>${c.condition}</span>
          <span>${c.rarity}</span>
        </div>
        <div class="price">${c.price} Kč</div>
      </div>
    `;
    grid.appendChild(el);
  });
}

/* =========================
   LOAD EDITIONS
========================= */
async function loadEditions() {
  if (!state.language) return;

  const { data } = await sb
    .from('cards')
    .select('set')
    .eq('language', state.language);

  const sets = [...new Set(data.map(d => d.set))].filter(Boolean);

  const wrap = document.getElementById('editions');
  wrap.innerHTML = '';
  wrap.classList.remove('hidden');

  sets.forEach(set => {
    const btn = document.createElement('button');
    btn.textContent = set;
    btn.onclick = () => {
      state.edition = set;
      hideTopCategories();
      loadCards();
    };
    wrap.appendChild(btn);
  });
}

/* =========================
   UI HELPERS
========================= */
function hideTopCategories() {
  document.getElementById('top-categories')?.classList.add('hidden');
}

function toggleFilters(force = null) {
  const panel = document.getElementById('filters');
  state.filtersOpen = force !== null ? force : !state.filtersOpen;
  panel.classList.toggle('open', state.filtersOpen);
}

/* =========================
   EVENTS
========================= */

// EN / JP / NEW / HOT
document.querySelectorAll('[data-lang],[data-section]').forEach(btn => {
  btn.onclick = () => {
    state.language = btn.dataset.lang || state.language;
    state.section = btn.dataset.section || null;
    state.edition = null;

    hideTopCategories();
    loadEditions();
    loadCards();
  };
});

// APPLY FILTERS
document.getElementById('applyFilters')?.addEventListener('click', () => {
  toggleFilters(false);
  loadCards();
});

// FILTER TOGGLE BUTTON
document.getElementById('toggleFilters')?.addEventListener('click', () => {
  toggleFilters();
});

// SEARCH (debounce)
document.getElementById('searchInput')?.addEventListener('input', () => {
  clearTimeout(window._search);
  window._search = setTimeout(loadCards, 300);
});

/* =========================
   INIT
========================= */
loadCards();
