const { createClient } = supabase;

const sb = createClient(
  'https://hwjbfrhbgeczukcjkmca.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
);

const state = {
  language: null,   // "EN" | "JP"
  section: null,    // "new" | "hot" | null
  filtersOpen: false
};

const els = {};
function grabEls(){
  els.cards = document.getElementById('cards');

  els.search = document.getElementById('search');

  els.condition = document.getElementById('condition');
  els.rarity = document.getElementById('rarity');
  els.priceMin = document.getElementById('priceMin');
  els.priceMax = document.getElementById('priceMax');
  els.sort = document.getElementById('sort');

  els.toggleFilters = document.getElementById('toggleFilters');
  els.applyFilters = document.getElementById('applyFilters');

  els.filtersPanel = document.getElementById('filtersPanel');
  els.layout = document.getElementById('collectionLayout');

  els.langBtns = Array.from(document.querySelectorAll('#langSwitch [data-lang]'));
  els.quickBtns = Array.from(document.querySelectorAll('#quickFilters [data-section]'));
}

function setFiltersOpen(open){
  state.filtersOpen = open;

  // panel nikdy nenecháme display:none když ho chceme animovat
  if (open) els.filtersPanel.classList.remove('hidden');

  els.layout.classList.toggle('filters-open', open);
  els.filtersPanel.classList.toggle('show', open);

  if (!open){
    // necháme doběhnout animaci a pak schováme
    setTimeout(() => {
      els.filtersPanel.classList.add('hidden');
    }, 250);
  }
}

function renderCards(cards){
  els.cards.innerHTML = '';

  if (!cards.length){
    els.cards.innerHTML = `<p style="opacity:.7">Nic jsme nenašli 😕</p>`;
    return;
  }

  for (const c of cards){
    const el = document.createElement('div');
    el.className = 'card';
    el.onclick = () => location.href = `card.html?id=${c.id}`;
    el.innerHTML = `
      <img src="${c.image_url}" alt="${c.name}">
      <strong>${c.name}</strong>
      <div class="price">${c.price} Kč</div>
    `;
    els.cards.appendChild(el);
  }
}

async function loadCards(){
  let q = sb
    .from('cards')
    .select('id,name,price,image_url,language,condition,rarity,created_at,hot,new,status')
    .eq('status', 'Skladem');

  // state
  if (state.language) q = q.eq('language', state.language);
  if (state.section === 'new') q = q.eq('new', true);
  if (state.section === 'hot') q = q.eq('hot', true);

  // search
  const search = (els.search?.value || '').trim();
  if (search) q = q.ilike('name', `%${search}%`);

  // filters
  const cond = els.condition?.value || '';
  if (cond) q = q.eq('condition', cond);

  const rar = els.rarity?.value || '';
  if (rar) q = q.eq('rarity', rar);

  const min = els.priceMin?.value;
  const max = els.priceMax?.value;
  if (min !== '' && min != null) q = q.gte('price', Number(min));
  if (max !== '' && max != null) q = q.lte('price', Number(max));

  // sort
  const sort = els.sort?.value || 'new';
  if (sort === 'price_asc') q = q.order('price', { ascending: true });
  if (sort === 'price_desc') q = q.order('price', { ascending: false });
  if (sort === 'name') q = q.order('name', { ascending: true });
  if (sort === 'new') q = q.order('created_at', { ascending: false });

  const { data, error } = await q;
  if (error){
    console.error('Supabase error:', error);
    renderCards([]);
    return;
  }

  renderCards(data || []);
}

function setActive(btns, matcherFn){
  btns.forEach(b => b.classList.toggle('active', matcherFn(b)));
}

function wireEvents(){
  // toggle filters
  els.toggleFilters?.addEventListener('click', () => {
    setFiltersOpen(!state.filtersOpen);
  });

  // apply filters (a zavřít)
  els.applyFilters?.addEventListener('click', () => {
    setFiltersOpen(false);
    loadCards();
  });

  // live search (debounce)
  let t = null;
  els.search?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(loadCards, 250);
  });

  // dropdowns/inputs -> reload
  [els.condition, els.rarity, els.priceMin, els.priceMax, els.sort].forEach(el => {
    el?.addEventListener('change', loadCards);
  });

  // language buttons
  els.langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.language = btn.dataset.lang;

      setActive(els.langBtns, b => b.dataset.lang === state.language);
      loadCards();
    });
  });

  // quick buttons (toggle on/off)
  els.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;

      state.section = (state.section === sec) ? null : sec;

      setActive(els.quickBtns, b => b.dataset.section === state.section);
      loadCards();
    });
  });

  // ESC zavře filtry
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.filtersOpen) setFiltersOpen(false);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  grabEls();
  wireEvents();
  loadCards();
});
