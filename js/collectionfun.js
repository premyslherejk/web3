const { createClient } = supabase;

const sb = createClient(
  'https://hwjbfrhbgeczukcjkmca.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
);

const state = {
  language: null,   // "EN" | "JP" | null
  section: null,    // "new" | "hot" | null
  filtersOpen: false
};

const els = {};

function grabEls(){
  els.layout = document.getElementById('collectionLayout');
  els.cards = document.getElementById('cards');

  els.search = document.getElementById('search');

  els.toggleFilters = document.getElementById('toggleFilters');
  els.closeFilters = document.getElementById('closeFilters');
  els.filtersPanel = document.getElementById('filtersPanel');
  els.applyFilters = document.getElementById('applyFilters');

  els.set = document.getElementById('set');
  els.condition = document.getElementById('condition');
  els.rarity = document.getElementById('rarity');
  els.psaOnly = document.getElementById('psaOnly');
  els.priceMin = document.getElementById('priceMin');
  els.priceMax = document.getElementById('priceMax');
  els.sort = document.getElementById('sort');

  els.langBtns = Array.from(document.querySelectorAll('#langSwitch [data-lang]'));
  els.quickBtns = Array.from(document.querySelectorAll('#quickFilters [data-section]'));

  // chips UI
  els.activeFilters = document.getElementById('activeFilters');
  els.filterChips = document.getElementById('filterChips');
  els.clearAll = document.getElementById('clearAllFilters');
}

function setFiltersOpen(open){
  state.filtersOpen = open;

  if (open) els.filtersPanel.classList.remove('hidden');

  els.layout.classList.toggle('filters-open', open);
  els.filtersPanel.classList.toggle('show', open);

  if (!open){
    setTimeout(() => {
      els.filtersPanel.classList.add('hidden');
    }, 220);
  }
}

function setActive(btns, predicate){
  btns.forEach(b => b.classList.toggle('active', predicate(b)));
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

/* =========================
   FILTER CHIPS
========================= */

function getActiveFilters(){
  const active = [];

  const search = (els.search.value || '').trim();
  if (search) active.push({ key:'search', label:'Hledat', value: search });

  if (state.language) active.push({ key:'language', label:'Jazyk', value: state.language });

  if (state.section === 'new') active.push({ key:'section', label:'Sekce', value: 'Novinky' });
  if (state.section === 'hot') active.push({ key:'section', label:'Sekce', value: 'Žhavé' });

  const setVal = els.set.value || '';
  if (setVal) active.push({ key:'set', label:'Edice', value: setVal });

  const cond = els.condition.value || '';
  if (cond) active.push({ key:'condition', label:'Stav', value: cond });

  const rar = els.rarity.value || '';
  if (rar) active.push({ key:'rarity', label:'Rarita', value: rar });

  if (els.psaOnly.checked) active.push({ key:'psaOnly', label:'PSA', value: 'Hodnocené' });

  const min = els.priceMin.value;
  const max = els.priceMax.value;

  if (min !== '' && min != null) active.push({ key:'priceMin', label:'Cena od', value: `${Number(min)} Kč` });
  if (max !== '' && max != null) active.push({ key:'priceMax', label:'Cena do', value: `${Number(max)} Kč` });

  // sort neukazuju jako chip defaultně (je to spíš UI preference), ale klidně můžu
  return active;
}

function clearSingleFilter(key){
  switch(key){
    case 'search':
      els.search.value = '';
      break;
    case 'language':
      state.language = null;
      els.set.value = '';
      setActive(els.langBtns, () => false);
      // reload set options based on (now null language)
      loadEditionsIntoFilter();
      break;
    case 'section':
      state.section = null;
      setActive(els.quickBtns, () => false);
      break;
    case 'set':
      els.set.value = '';
      break;
    case 'condition':
      els.condition.value = '';
      break;
    case 'rarity':
      els.rarity.value = '';
      break;
    case 'psaOnly':
      els.psaOnly.checked = false;
      break;
    case 'priceMin':
      els.priceMin.value = '';
      break;
    case 'priceMax':
      els.priceMax.value = '';
      break;
  }

  renderFilterChips();
  loadCards();
}

function clearAllFilters(){
  // UI inputs
  els.search.value = '';
  els.set.value = '';
  els.condition.value = '';
  els.rarity.value = '';
  els.psaOnly.checked = false;
  els.priceMin.value = '';
  els.priceMax.value = '';
  els.sort.value = 'new';

  // state
  state.language = null;
  state.section = null;

  // active styling
  setActive(els.langBtns, () => false);
  setActive(els.quickBtns, () => false);

  loadEditionsIntoFilter();
  renderFilterChips();
  loadCards();
}

function renderFilterChips(){
  const active = getActiveFilters();

  if (!active.length){
    els.activeFilters.classList.add('hidden');
    els.filterChips.innerHTML = '';
    return;
  }

  els.activeFilters.classList.remove('hidden');
  els.filterChips.innerHTML = active.map(f => `
    <span class="chip" data-key="${escapeHtml(f.key)}">
      <span class="chip-label">${escapeHtml(f.label)}:</span>
      <span class="chip-value">${escapeHtml(f.value)}</span>
      <button type="button" aria-label="Odstranit filtr">✕</button>
    </span>
  `).join('');
}

/* =========================
   RENDER CARDS
========================= */

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
      <img src="${c.image_url}" alt="${escapeHtml(c.name)}">
      <strong>${escapeHtml(c.name)}</strong>
      <div class="price">${c.price} Kč</div>
    `;
    els.cards.appendChild(el);
  }
}

/* =========================
   LOAD EDITIONS
========================= */

async function loadEditionsIntoFilter(){
  let q = sb
    .from('cards')
    .select('set')
    .eq('status', 'Skladem');

  if (state.language) q = q.eq('language', state.language);

  const { data, error } = await q;
  if (error){
    console.error('Editions load error:', error);
    return;
  }

  const sets = [...new Set((data || []).map(x => x.set).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b));

  const current = els.set.value || '';

  els.set.innerHTML =
    `<option value="">Vše</option>` +
    sets.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  if (current && sets.includes(current)) els.set.value = current;
  else els.set.value = '';
}

/* =========================
   LOAD CARDS
========================= */

async function loadCards(){
  let q = sb
    .from('cards')
    .select('id,name,price,image_url,language,condition,rarity,created_at,hot,new,status,psa_grade,set')
    .eq('status', 'Skladem');

  // quick state
  if (state.language) q = q.eq('language', state.language);
  if (state.section === 'new') q = q.eq('new', true);
  if (state.section === 'hot') q = q.eq('hot', true);

  // search
  const search = (els.search.value || '').trim();
  if (search) q = q.ilike('name', `%${search}%`);

  // sidebar filters
  const setVal = els.set.value || '';
  if (setVal) q = q.eq('set', setVal);

  const cond = els.condition.value || '';
  if (cond) q = q.eq('condition', cond);

  const rar = els.rarity.value || '';
  if (rar) q = q.eq('rarity', rar);

  if (els.psaOnly.checked) q = q.not('psa_grade', 'is', null);

  const min = els.priceMin.value;
  const max = els.priceMax.value;
  if (min !== '' && min != null) q = q.gte('price', Number(min));
  if (max !== '' && max != null) q = q.lte('price', Number(max));

  // sort
  const sort = els.sort.value || 'new';
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
  renderFilterChips();
}

/* =========================
   EVENTS
========================= */

function wireEvents(){
  // filters open/close
  els.toggleFilters.addEventListener('click', () => setFiltersOpen(!state.filtersOpen));
  els.closeFilters.addEventListener('click', () => setFiltersOpen(false));

  els.applyFilters.addEventListener('click', () => {
    setFiltersOpen(false);
    loadCards();
  });

  // clear all
  els.clearAll.addEventListener('click', clearAllFilters);

  // chips remove (delegation)
  els.filterChips.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const chip = e.target.closest('.chip');
    if (!chip) return;

    const key = chip.dataset.key;
    clearSingleFilter(key);
  });

  // live search (debounce)
  let t = null;
  els.search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(loadCards, 250);
    renderFilterChips();
  });

  // auto reload on filter change
  [els.set, els.condition, els.rarity, els.psaOnly, els.priceMin, els.priceMax, els.sort].forEach(el => {
    el.addEventListener('change', loadCards);
  });

  // language buttons
  els.langBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      state.language = (state.language === lang) ? null : lang;

      els.set.value = '';
      await loadEditionsIntoFilter();

      setActive(els.langBtns, b => b.dataset.lang === state.language);
      loadCards();
    });
  });

  // section buttons
  els.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      state.section = (state.section === sec) ? null : sec;

      setActive(els.quickBtns, b => b.dataset.section === state.section);
      loadCards();
    });
  });

  // esc closes filters
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.filtersOpen) setFiltersOpen(false);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  grabEls();
  wireEvents();
  await loadEditionsIntoFilter();
  renderFilterChips();
  loadCards();
});
