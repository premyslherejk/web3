const { createClient } = supabase;

const sb = createClient(
  'https://hwjbfrhbgeczukcjkmca.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
);

const state = {
  language: null,   // "EN" | "JP" | null
  section: null,    // "graded" | "hot" | null
  filtersOpen: false
};

const paging = {
  page: 1,
  pageSize: 24,
  total: 0,
  totalPages: 1,
  loading: false
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

  els.serie = document.getElementById('serie');
  els.set = document.getElementById('set');
  els.condition = document.getElementById('condition');
  els.priceMin = document.getElementById('priceMin');
  els.priceMax = document.getElementById('priceMax');
  els.sort = document.getElementById('sort');

  els.langBtns = Array.from(document.querySelectorAll('#langSwitch [data-lang]'));
  els.quickBtns = Array.from(document.querySelectorAll('#quickFilters [data-section]'));

  els.activeFilters = document.getElementById('activeFilters');
  els.filterChips = document.getElementById('filterChips');
  els.clearAll = document.getElementById('clearAllFilters');

  // pagination UI (optional – když to tam nebude, nic se nerozbije)
  els.pager = document.getElementById('pager');
  els.pagePrev = document.getElementById('pagePrev');
  els.pageNext = document.getElementById('pageNext');
  els.pageMore = document.getElementById('pageMore');
  els.pageInfo = document.getElementById('pageInfo');
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
  if (window.OfferUI?.escapeHtml) return window.OfferUI.escapeHtml(s);
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

/* =========================
   PAGE SIZE (18 mobile / 24 desktop)
========================= */

function computePageSize(){
  return window.matchMedia('(max-width: 900px)').matches ? 18 : 24;
}

function resetPaging(){
  paging.page = 1;
  paging.pageSize = computePageSize();
  paging.total = 0;
  paging.totalPages = 1;
  updatePagerUI();
}

/* =========================
   URL FILTERS
========================= */

function getUrlParams(){
  const p = new URLSearchParams(location.search);
  const language = p.get('language');
  const section = p.get('section');
  const serie = p.get('serie');
  const set = p.get('set');

  return {
    language: (language === 'EN' || language === 'JP') ? language : null,
    section: (section === 'hot' || section === 'graded') ? section : null,
    serie: serie ? String(serie) : '',
    set: set ? String(set) : ''
  };
}

function optionExists(selectEl, value){
  if (!selectEl || value == null) return false;
  return Array.from(selectEl.options).some(o => o.value === value);
}

async function applyUrlFilters(){
  const u = getUrlParams();

  // language / section
  if (u.language){
    state.language = u.language;
    setActive(els.langBtns, b => b.dataset.lang === state.language);
  }
  if (u.section){
    state.section = u.section;
    setActive(els.quickBtns, b => b.dataset.section === state.section);
  }

  // load series first (respects language)
  await loadSeriesIntoFilter();

  // set serie
  if (u.serie && optionExists(els.serie, u.serie)){
    els.serie.value = u.serie;
  } else {
    els.serie.value = '';
  }

  // load sets for serie
  await loadEditionsIntoFilter();

  // set set
  if (u.set && optionExists(els.set, u.set)){
    els.set.value = u.set;
  } else {
    els.set.value = '';
  }
}

/* =========================
   FILTER CHIPS
========================= */

function getActiveFilters(){
  const active = [];

  const search = (els.search.value || '').trim();
  if (search) active.push({ key:'search', label:'Hledat', value: search });

  if (state.language) active.push({ key:'language', label:'Jazyk', value: state.language });

  if (state.section === 'graded') active.push({ key:'section', label:'Sekce', value: 'Hodnocené' });
  if (state.section === 'hot') active.push({ key:'section', label:'Sekce', value: 'Žhavé' });

  const serieVal = els.serie?.value || '';
  if (serieVal) active.push({ key:'serie', label:'Série', value: serieVal });

  const setVal = els.set.value || '';
  if (setVal) active.push({ key:'set', label:'Edice', value: setVal });

  const cond = els.condition.value || '';
  if (cond) active.push({ key:'condition', label:'Stav', value: cond });

  const min = els.priceMin.value;
  const max = els.priceMax.value;
  if (min !== '' && min != null) active.push({ key:'priceMin', label:'Cena od', value: `${Number(min)} Kč` });
  if (max !== '' && max != null) active.push({ key:'priceMax', label:'Cena do', value: `${Number(max)} Kč` });

  return active;
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

function clearSingleFilter(key){
  switch(key){
    case 'search':
      els.search.value = '';
      break;

    case 'language':
      state.language = null;
      setActive(els.langBtns, () => false);
      els.serie.value = '';
      els.set.value = '';
      break;

    case 'section':
      state.section = null;
      setActive(els.quickBtns, () => false);
      break;

    case 'serie':
      els.serie.value = '';
      els.set.value = '';
      break;

    case 'set':
      els.set.value = '';
      break;

    case 'condition':
      els.condition.value = '';
      break;

    case 'priceMin':
      els.priceMin.value = '';
      break;

    case 'priceMax':
      els.priceMax.value = '';
      break;
  }

  refreshDependentOptions().then(() => {
    renderFilterChips();
    resetPaging();
    loadCards({ reset: true });
  });
}

function clearAllFilters(){
  els.search.value = '';
  els.serie.value = '';
  els.set.value = '';
  els.condition.value = '';
  els.priceMin.value = '';
  els.priceMax.value = '';
  els.sort.value = 'new';

  state.language = null;
  state.section = null;

  setActive(els.langBtns, () => false);
  setActive(els.quickBtns, () => false);

  refreshDependentOptions().then(() => {
    renderFilterChips();
    resetPaging();
    loadCards({ reset: true });
  });
}

/* =========================
   DEPENDENT OPTIONS (Serie -> Set)
========================= */

async function loadSeriesIntoFilter(){
  let q = sb
    .from('cards')
    .select('serie')
    .neq('status', 'Prodáno');

  if (state.language) q = q.eq('language', state.language);

  const { data, error } = await q;
  if (error){
    console.error('Serie load error:', error?.message || error);
    return;
  }

  const series = [...new Set((data || []).map(x => x.serie).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'cs'));

  const current = els.serie.value || '';

  els.serie.innerHTML =
    `<option value="">Vše</option>` +
    series.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  els.serie.value = (current && series.includes(current)) ? current : '';
}

async function loadEditionsIntoFilter(){
  const serieVal = els.serie.value || '';

  if (!serieVal){
    els.set.innerHTML = `<option value="">Nejdřív vyber sérii</option>`;
    els.set.disabled = true;
    return;
  }

  els.set.disabled = false;

  let q = sb
    .from('cards')
    .select('set')
    .neq('status', 'Prodáno')
    .eq('serie', serieVal);

  if (state.language) q = q.eq('language', state.language);

  const { data, error } = await q;
  if (error){
    console.error('Editions load error:', error?.message || error);
    return;
  }

  const sets = [...new Set((data || []).map(x => x.set).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'cs'));

  const current = els.set.value || '';

  els.set.innerHTML =
    `<option value="">Vše</option>` +
    sets.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  els.set.value = (current && sets.includes(current)) ? current : '';
}

async function refreshDependentOptions(){
  await loadSeriesIntoFilter();
  await loadEditionsIntoFilter();
}

/* =========================
   BUILD QUERY (shared)
========================= */

function buildBaseQuery(selectCols){
  let q = sb
    .from('cards')
    .select(selectCols)
    .neq('status', 'Prodáno');

  if (state.language) q = q.eq('language', state.language);
  if (state.section === 'hot') q = q.eq('hot', true);
  if (state.section === 'graded') q = q.not('psa_grade', 'is', null);

  const search = (els.search.value || '').trim();
  if (search) q = q.ilike('name', `%${search}%`);

  const serieVal = els.serie.value || '';
  if (serieVal) q = q.eq('serie', serieVal);

  const setVal = els.set.value || '';
  if (setVal) q = q.eq('set', setVal);

  const cond = els.condition.value || '';
  if (cond) q = q.eq('condition', cond);

  const min = els.priceMin.value;
  const max = els.priceMax.value;
  if (min !== '' && min != null) q = q.gte('price', Number(min));
  if (max !== '' && max != null) q = q.lte('price', Number(max));

  const sort = els.sort.value || 'new';
  if (sort === 'price_asc') q = q.order('price', { ascending: true });
  if (sort === 'price_desc') q = q.order('price', { ascending: false });
  if (sort === 'name') q = q.order('name', { ascending: true });
  if (sort === 'new') q = q.order('created_at', { ascending: false });

  return q;
}

/* =========================
   PAGER UI
========================= */

function updatePagerUI(){
  if (!els.pager) return;

  const p = paging.page;
  const tp = paging.totalPages;

  if (els.pageInfo){
    els.pageInfo.textContent = `Stránka ${p} / ${tp} • Celkem ${paging.total} karet`;
  }

  if (els.pagePrev) els.pagePrev.disabled = (p <= 1) || paging.loading;
  if (els.pageNext) els.pageNext.disabled = (p >= tp) || paging.loading;

  // "Zobrazit více" = přidá další stránku pod to
  if (els.pageMore){
    const canMore = (p < tp) && !paging.loading;
    els.pageMore.disabled = !canMore;
    els.pageMore.style.display = (tp > 1) ? 'inline-flex' : 'none';
  }
}

/* =========================
   LOAD CARDS (pagination)
========================= */

async function loadCards({ reset = false, append = false } = {}){
  if (paging.loading) return;
  paging.loading = true;
  updatePagerUI();

  if (!window.OfferUI?.renderCardsInto || !window.OfferUI?.renderCard){
    console.error('OfferUI not loaded. Add <script src="js/offerfun.js"></script> before collectionfun.js');
    els.cards.innerHTML = `<p style="opacity:.7">Chybí offerfun.js 😕</p>`;
    paging.loading = false;
    updatePagerUI();
    return;
  }

  // reset list
  if (reset){
    paging.page = 1;
    append = false;
  }

  paging.pageSize = computePageSize();

  const selectCols = 'id,name,price,image_url,language,condition,created_at,hot,status,psa_grade,set,serie';

  // 1) count query
  const countQuery = buildBaseQuery('id', true);
  // supabase-js: count přes select with count exact + head true
  const { count, error: countErr } = await buildBaseQuery('id')
    .select('id', { count: 'exact', head: true });

  if (countErr){
    console.error('Supabase count error:', countErr?.message || countErr, countErr);
    if (!append) window.OfferUI.renderCardsInto(els.cards, []);
    paging.loading = false;
    paging.total = 0;
    paging.totalPages = 1;
    updatePagerUI();
    return;
  }

  paging.total = count || 0;
  paging.totalPages = Math.max(1, Math.ceil(paging.total / paging.pageSize));

  // clamp page
  if (paging.page > paging.totalPages) paging.page = paging.totalPages;

  // 2) data query with range
  const from = (paging.page - 1) * paging.pageSize;
  const to = from + paging.pageSize - 1;

  const dataQuery = buildBaseQuery(selectCols).range(from, to);

  const { data, error } = await dataQuery;
  if (error){
    console.error('Supabase data error:', error?.message || error, error);
    if (!append) window.OfferUI.renderCardsInto(els.cards, []);
    paging.loading = false;
    updatePagerUI();
    return;
  }

  const cards = data || [];

  if (!append){
    window.OfferUI.renderCardsInto(els.cards, cards, { size: 'md' });
  } else {
    // append = přidá další kartu za existující (load more)
    const frag = document.createDocumentFragment();
    for (const c of cards){
      frag.appendChild(window.OfferUI.renderCard(c, { size: 'md' }));
    }
    els.cards.appendChild(frag);
  }

  renderFilterChips();
  paging.loading = false;
  updatePagerUI();
}

/* =========================
   EVENTS
========================= */

function resetAndReload(){
  resetPaging();
  loadCards({ reset: true });
}

function wireEvents(){
  els.toggleFilters.addEventListener('click', () => setFiltersOpen(!state.filtersOpen));
  els.closeFilters.addEventListener('click', () => setFiltersOpen(false));

  els.applyFilters.addEventListener('click', () => {
    setFiltersOpen(false);
    resetAndReload();
  });

  els.clearAll.addEventListener('click', clearAllFilters);

  els.filterChips.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const chip = e.target.closest('.chip');
    if (!chip) return;
    clearSingleFilter(chip.dataset.key);
  });

  // live search (reset paging)
  let t = null;
  els.search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      resetAndReload();
    }, 250);
    renderFilterChips();
  });

  // serie -> set depends
  els.serie.addEventListener('change', async () => {
    els.set.value = '';
    await loadEditionsIntoFilter();
    renderFilterChips();
    resetAndReload();
  });

  [els.set, els.condition, els.priceMin, els.priceMax, els.sort].forEach(el => {
    el.addEventListener('change', () => {
      renderFilterChips();
      resetAndReload();
    });
  });

  // language buttons
  els.langBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      state.language = (state.language === lang) ? null : lang;

      els.serie.value = '';
      els.set.value = '';

      await refreshDependentOptions();

      setActive(els.langBtns, b => b.dataset.lang === state.language);
      renderFilterChips();
      resetAndReload();
    });
  });

  // quick buttons
  els.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      state.section = (state.section === sec) ? null : sec;

      setActive(els.quickBtns, b => b.dataset.section === state.section);
      renderFilterChips();
      resetAndReload();
    });
  });

  // pager buttons
  if (els.pagePrev){
    els.pagePrev.addEventListener('click', () => {
      if (paging.page <= 1) return;
      paging.page -= 1;
      loadCards({ reset: false, append: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (els.pageNext){
    els.pageNext.addEventListener('click', () => {
      if (paging.page >= paging.totalPages) return;
      paging.page += 1;
      loadCards({ reset: false, append: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (els.pageMore){
    els.pageMore.addEventListener('click', () => {
      if (paging.page >= paging.totalPages) return;
      paging.page += 1;
      loadCards({ reset: false, append: true });
    });
  }

  // close filters on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.filtersOpen) setFiltersOpen(false);
  });

  // on resize: když se přepne mobil/desktop, přepočítat pageSize a reloadnout
  let rt = null;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const newSize = computePageSize();
      if (newSize !== paging.pageSize){
        resetAndReload();
      }
    }, 200);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  grabEls();
  wireEvents();

  resetPaging();

  // URL -> dropdowny
  await applyUrlFilters();

  renderFilterChips();
  loadCards({ reset: true });
});
