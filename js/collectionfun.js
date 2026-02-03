const { createClient } = supabase;

const sb = createClient(
  'https://hwjbfrhbgeczukcjkmca.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
);

let state = {
  lang: null,
  section: null,
  set: null
};

async function loadCards() {
  let q = sb.from('cards').select('*').eq('status', 'Skladem');

  if (state.lang) q = q.eq('language', state.lang);
  if (state.section === 'new') q = q.eq('is_new', true);
  if (state.section === 'hot') q = q.eq('is_hot', true);
  if (state.set) q = q.eq('set', state.set);

  const search = document.getElementById('searchInput').value;
  if (search) q = q.ilike('name', `%${search}%`);

  const cond = document.getElementById('condition').value;
  if (cond) q = q.eq('condition', cond);

  const rar = document.getElementById('rarity').value;
  if (rar) q = q.eq('rarity', rar);

  const min = document.getElementById('priceMin').value;
  const max = document.getElementById('priceMax').value;
  if (min) q = q.gte('price', min);
  if (max) q = q.lte('price', max);

  const sort = document.getElementById('sort').value;
  if (sort === 'price_asc') q = q.order('price');
  if (sort === 'price_desc') q = q.order('price', { ascending: false });
  if (sort === 'name') q = q.order('name');
  if (sort === 'sold') q = q.order('sold_count', { ascending: false });
  if (sort === 'new') q = q.order('created_at', { ascending: false });

  const { data } = await q;
  renderCards(data || []);
}

function renderCards(cards) {
  const grid = document.getElementById('cards');
  grid.innerHTML = '';

  cards.forEach(c => {
    const d = document.createElement('div');
    d.className = 'card';
    d.onclick = () => location.href = `card.html?id=${c.id}`;
    d.innerHTML = `
      <img src="${c.image_url}">
      <strong>${c.name}</strong>
      <div class="price">${c.price} Kč</div>
    `;
    grid.appendChild(d);
  });
}

async function loadEditions() {
  const { data } = await sb
    .from('cards')
    .select('set')
    .eq('language', state.lang);

  const sets = [...new Set(data.map(d => d.set))];
  const el = document.getElementById('editions');
  el.innerHTML = '';
  el.classList.remove('hidden');

  sets.forEach(s => {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => {
      state.set = s;
      loadCards();
    };
    el.appendChild(b);
  });
}

/* EVENTS */
document.querySelectorAll('.cat-card').forEach(c => {
  c.onclick = () => {
    state.lang = c.dataset.lang || state.lang;
    state.section = c.dataset.section || null;
    state.set = null;

    if (state.lang) loadEditions();
    loadCards();
  };
});

document.getElementById('applyFilters').onclick = loadCards;
document.getElementById('searchInput').oninput = () => {
  clearTimeout(window._s);
  window._s = setTimeout(loadCards, 300);
};

loadCards();
