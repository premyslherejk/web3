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

// "load more" paging
const paging = {
  page: 1,
  pageSize: 24,
  total: 0,
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

  // load more UI
  els.loadMoreWrap = document.getElementById('loadMoreWrap');
  els.loadMoreBtn = document.getElementById('loadMoreBtn');
  els.loadMoreInfo = document.getElementById('loadMoreInfo');
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
   PAGE SIZE + RESET
========================= */

function computePageSize(){
  return window.matchMedia('(max-width: 900px)').matches ? 18 : 24;
}

function resetPaging(){
  paging.page = 1;
  paging.pageSize = computePageSize();
  paging.total = 0;
  paging.loading = false;
  updateLoadMoreUI();
}

function getShownCount(){
  const shown = (paging.page * paging.pageSize);
  return Math.min(shown, paging.total || 0);
}

function updateLoadMoreUI(){
  if (!els.loadMoreWrap) return;

  const total = paging.total || 0;
  const shown = getShownCount();

  if (els.loadMoreInfo){
    els.loadMoreInfo.textContent = `${shown}/${total}`;
  }

  const canMore = shown < total;

  if (els.loadMoreBtn){
    els.loadMoreBtn.disabled = paging.loading || !canMore;
    els.loadMoreBtn.style.opacity = (paging.loading || !canMore) ? '0.55' : '1';
  }

  // když je total 0 -> klidně schovej celé
  els.loadMoreWrap.style.display = (total > 0) ? 'flex' : 'none';
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

  if (u.language){
    state.language = u.language;
    setActive(els.langBtns, b => b.dataset.lang === state.language);
  }
  if (u.section){
    state.section = u.section;
    setActive(els.quickBtns, b => b.dataset.section === state.section);
  }

  await loadSeriesIntoFilter();

  if (u.serie && optionExists(els.serie, u.serie)){
    els.serie.value = u.serie;
  } else {
    els.serie.value = '';
  }

  await loadEditionsIntoFilter();

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
    case 'search': els.search.value = ''; break;

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

    case 'set': els.set.value = ''; break;
    case 'condition': els.condition.value = ''; break;
    case 'priceMin': els.priceMin.value = ''; break;
    case 'priceMax': els.priceMax.value = ''; break;
  }

  refreshDependentOptions().then(() => {
    renderFilterChips();
    resetAndReload();
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
    resetAndReload();
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
   QUERY HELPERS
========================= */

function applyFiltersToQuery(q){
  q = q.neq('status', 'Prodáno');

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

  return q;
}

function applySortToQuery(q){
  const sort = els.sort.value || 'new';

  // ✅ Stabilní order: vždy přidáme tiebreaker "id"
  if (sort === 'price_asc') {
    q = q.order('price', { ascending: true, nullsFirst: false });
    q = q.order('id', { ascending: true });
  } else if (sort === 'price_desc') {
    q = q.order('price', { ascending: false, nullsFirst: false });
    q = q.order('id', { ascending: false });
  } else if (sort === 'name') {
    q = q.order('name', { ascending: true, nullsFirst: false });
    q = q.order('id', { ascending: true });
  } else {
    // new
    q = q.order('created_at', { ascending: false, nullsFirst: false });
    q = q.order('id', { ascending: false });
  }

  return q;
}

/* =========================
   LOAD (COUNT + PAGE DATA)
========================= */

async function fetchTotalCount(){
  // head+count query
  let q = sb.from('cards');
  q = applyFiltersToQuery(q).select('id', { count: 'exact', head: true });

  const { count, error } = await q;
  if (error) throw error;

  return count || 0;
}

async function fetchPageData(page){
  const selectCols = 'id,name,price,image_url,language,condition,created_at,hot,status,psa_grade,set,serie';

  const from = (page - 1) * paging.pageSize;
  const to = from + paging.pageSize - 1;

  let q = sb.from('cards');
  q = applyFiltersToQuery(q);
  q = applySortToQuery(q);
  q = q.select(selectCols).range(from, to);

  const { data, error } = await q;
  if (error) throw error;

  return data || [];
}

async function loadCards({ reset = false, append = false } = {}){
  if (paging.loading) return;

  if (!window.OfferUI?.renderCardsInto || !window.OfferUI?.renderCard){
    console.error('OfferUI not loaded. Add <script src="js/offerfun.js"></script> before collectionfun.js');
    els.cards.innerHTML = `<p style="opacity:.7">Chybí offerfun.js 😕</p>`;
    return;
  }

  paging.loading = true;
  updateLoadMoreUI();

  try {
    paging.pageSize = computePageSize();

    if (reset){
      paging.page = 1;
      append = false;
    }

    // 1) count (jen když reset nebo total neznáme)
    if (reset || paging.total === 0){
      paging.total = await fetchTotalCount();
    }

    // když nic nenajdeme
    if (paging.total === 0){
      window.OfferUI.renderCardsInto(els.cards, []);
      paging.loading = false;
      updateLoadMoreUI();
      return;
    }

    // 2) fetch page data
    const data = await fetchPageData(paging.page);

    if (!append){
      window.OfferUI.renderCardsInto(els.cards, data, { size: 'md' });
    } else {
      const frag = document.createDocumentFragment();
      for (const c of data){
        frag.appendChild(window.OfferUI.renderCard(c, { size: 'md' }));
      }
      els.cards.appendChild(frag);
    }

    renderFilterChips();
  } catch (err){
    console.error('Load error:', err?.message || err, err);
    if (!append) window.OfferUI.renderCardsInto(els.cards, []);
    paging.total = 0;
  } finally {
    paging.loading = false;
    updateLoadMoreUI();
  }
}

function resetAndReload(){
  resetPaging();
  loadCards({ reset: true, append: false });
}

/* =========================
   EVENTS
========================= */

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

  // live search
  let t = null;
  els.search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => resetAndReload(), 250);
    renderFilterChips();
  });

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

  els.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.section;
      state.section = (state.section === sec) ? null : sec;

      setActive(els.quickBtns, b => b.dataset.section === state.section);
      renderFilterChips();
      resetAndReload();
    });
  });

  // load more
  if (els.loadMoreBtn){
    els.loadMoreBtn.addEventListener('click', () => {
      const shown = getShownCount();
      if (paging.loading) return;
      if (shown >= (paging.total || 0)) return;

      paging.page += 1;
      loadCards({ reset: false, append: true });
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.filtersOpen) setFiltersOpen(false);
  });

  // resize: změna pageSize (18/24)
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

  // 1) načti dependent options
  await refreshDependentOptions();

  // 2) aplikuj URL (?serie&set...)
  await applyUrlFilters();

  // 3) chipy
  renderFilterChips();

  // 4) první load (reset + count + page 1)
  loadCards({ reset: true, append: false });
});
