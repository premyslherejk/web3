diff --git a/js/collectionfun.js b/js/collectionfun.js
index 4a8f10cf2848fc62257a56b6510824a2157485de..861ede5329af0353fbc53f583b295bd3ff5f9b50 100644
--- a/js/collectionfun.js
+++ b/js/collectionfun.js
@@ -1,65 +1,70 @@
 const { createClient } = supabase;
 
 const sb = createClient(
   'https://hwjbfrhbgeczukcjkmca.supabase.co',
   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
 );
 
 const state = {
   language: null,   // "EN" | "JP" | null
   section: null,    // "graded" | "hot" | null
-  filtersOpen: false
+  filtersOpen: false,
+  page: 1,
+  pageSize: 24,
+  totalPages: 1,
+  cardsData: []
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
   // ❌ els.rarity pryč
   els.priceMin = document.getElementById('priceMin');
   els.priceMax = document.getElementById('priceMax');
   els.sort = document.getElementById('sort');
 
   els.langBtns = Array.from(document.querySelectorAll('#langSwitch [data-lang]'));
   els.quickBtns = Array.from(document.querySelectorAll('#quickFilters [data-section]'));
 
   els.activeFilters = document.getElementById('activeFilters');
   els.filterChips = document.getElementById('filterChips');
   els.clearAll = document.getElementById('clearAllFilters');
+  els.pagination = document.getElementById('pagination');
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
@@ -157,114 +162,185 @@ function getActiveFilters(){
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
 
+/* =========================
+   PAGINATION
+========================= */
+
+function getPageNumbers(current, total, maxButtons = 5){
+  if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1);
+
+  const half = Math.floor(maxButtons / 2);
+  let start = Math.max(1, current - half);
+  let end = Math.min(total, current + half);
+
+  if (end - start + 1 < maxButtons){
+    if (start === 1){
+      end = Math.min(total, start + maxButtons - 1);
+    } else if (end === total){
+      start = Math.max(1, end - maxButtons + 1);
+    }
+  }
+
+  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
+}
+
+function renderPagination(){
+  if (!els.pagination) return;
+
+  const total = state.totalPages;
+  if (total <= 1){
+    els.pagination.classList.add('hidden');
+    els.pagination.innerHTML = '';
+    return;
+  }
+
+  const current = state.page;
+  const pages = getPageNumbers(current, total, 5);
+  const showStartEllipsis = pages[0] > 1;
+  const showEndEllipsis = pages[pages.length - 1] < total;
+
+  const numbers = [
+    showStartEllipsis ? `<span class="page-ellipsis">…</span>` : '',
+    ...pages.map(p => `
+      <button type="button" data-page="${p}" class="${p === current ? 'active' : ''}" aria-current="${p === current ? 'page' : 'false'}">
+        ${p}
+      </button>
+    `),
+    showEndEllipsis ? `<span class="page-ellipsis">…</span>` : ''
+  ].join('');
+
+  els.pagination.innerHTML = `
+    <button type="button" data-page="prev" ${current === 1 ? 'disabled' : ''} aria-label="Předchozí stránka">‹</button>
+    ${numbers}
+    <button type="button" data-page="next" ${current === total ? 'disabled' : ''} aria-label="Další stránka">›</button>
+    <span class="page-info">Strana ${current} z ${total}</span>
+  `;
+
+  els.pagination.classList.remove('hidden');
+}
+
+function renderCurrentPage(){
+  if (!window.OfferUI?.renderCardsInto) return;
+
+  const start = (state.page - 1) * state.pageSize;
+  const pageData = state.cardsData.slice(start, start + state.pageSize);
+
+  if (!pageData.length){
+    els.cards.innerHTML = `<p style="opacity:.7">Nic jsme nenašli 😕</p>`;
+    return;
+  }
+
+  window.OfferUI.renderCardsInto(els.cards, pageData, { size: 'md' });
+}
+
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
-    loadCards();
+    loadCards(true);
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
-    loadCards();
+    loadCards(true);
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
@@ -300,169 +376,195 @@ async function loadEditionsIntoFilter(){
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
    LOAD CARDS
 ========================= */
 
-async function loadCards(){
+async function loadCards(resetPage = false){
   let q = sb
     .from('cards')
     .select('id,name,price,image_url,language,condition,created_at,hot,status,psa_grade,set,serie')
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
 
   const { data, error } = await q;
   if (error){
     console.error('Supabase error:', error?.message || error, error);
     if (window.OfferUI?.renderCardsInto) window.OfferUI.renderCardsInto(els.cards, []);
     else els.cards.innerHTML = `<p style="opacity:.7">Nic jsme nenašli 😕</p>`;
+    state.cardsData = [];
+    state.totalPages = 1;
+    state.page = 1;
+    renderPagination();
     return;
   }
 
   if (!window.OfferUI?.renderCardsInto) {
     console.error('OfferUI not loaded. Add <script src="js/offerfun.js"></script> before collectionfun.js');
     els.cards.innerHTML = `<p style="opacity:.7">Chybí offerfun.js 😕</p>`;
     return;
   }
 
-  window.OfferUI.renderCardsInto(els.cards, data || [], { size: 'md' });
+  state.cardsData = data || [];
+  state.totalPages = Math.max(1, Math.ceil(state.cardsData.length / state.pageSize));
+  if (resetPage) state.page = 1;
+  if (state.page > state.totalPages) state.page = state.totalPages;
+
+  renderCurrentPage();
+  renderPagination();
   renderFilterChips();
 }
 
 /* =========================
    EVENTS
 ========================= */
 
 function wireEvents(){
   els.toggleFilters.addEventListener('click', () => setFiltersOpen(!state.filtersOpen));
   els.closeFilters.addEventListener('click', () => setFiltersOpen(false));
 
   els.applyFilters.addEventListener('click', () => {
     setFiltersOpen(false);
-    loadCards();
+    loadCards(true);
   });
 
   els.clearAll.addEventListener('click', clearAllFilters);
 
   els.filterChips.addEventListener('click', (e) => {
     const btn = e.target.closest('button');
     if (!btn) return;
     const chip = e.target.closest('.chip');
     if (!chip) return;
     clearSingleFilter(chip.dataset.key);
   });
 
   let t = null;
   els.search.addEventListener('input', () => {
     clearTimeout(t);
-    t = setTimeout(loadCards, 250);
+    t = setTimeout(() => loadCards(true), 250);
     renderFilterChips();
   });
 
   els.serie.addEventListener('change', async () => {
     els.set.value = '';
     await loadEditionsIntoFilter();
     renderFilterChips();
-    loadCards();
+    loadCards(true);
   });
 
   [els.set, els.condition, els.priceMin, els.priceMax, els.sort].forEach(el => {
     el.addEventListener('change', () => {
       renderFilterChips();
-      loadCards();
+      loadCards(true);
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
-      loadCards();
+      loadCards(true);
     });
   });
 
   els.quickBtns.forEach(btn => {
     btn.addEventListener('click', () => {
       const sec = btn.dataset.section;
       state.section = (state.section === sec) ? null : sec;
 
       setActive(els.quickBtns, b => b.dataset.section === state.section);
       renderFilterChips();
-      loadCards();
+      loadCards(true);
     });
   });
 
+  if (els.pagination){
+    els.pagination.addEventListener('click', (e) => {
+      const btn = e.target.closest('button[data-page]');
+      if (!btn) return;
+      const target = btn.dataset.page;
+
+      if (target === 'prev') state.page = Math.max(1, state.page - 1);
+      else if (target === 'next') state.page = Math.min(state.totalPages, state.page + 1);
+      else state.page = Number.parseInt(target, 10) || 1;
+
+      renderCurrentPage();
+      renderPagination();
+      els.cards.scrollIntoView({ behavior: 'smooth', block: 'start' });
+    });
+  }
+
   document.addEventListener('keydown', (e) => {
     if (e.key === 'Escape' && state.filtersOpen) setFiltersOpen(false);
   });
 }
 
 document.addEventListener('DOMContentLoaded', async () => {
   grabEls();
   wireEvents();
 
   // ✅ nejdřív načteme filtry normálně
   await refreshDependentOptions();
 
   // ✅ pak aplikujeme URL parametry (?serie=...&set=...)
   await applyUrlFilters();
 
   // ✅ vykreslíme chipy
   renderFilterChips();
 
   // ✅ až TEĎ loadujeme karty
   loadCards();
 });
