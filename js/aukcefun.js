// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const AUC_BUCKET = 'auctions';

// ===================== UI =====================
const $ = (id) => document.getElementById(id);

const els = {
  // cards/sections
  currentTitle: $('currentTitle'),
  currentMeta: $('currentMeta'),
  currentList: $('currentList'),

  historyMeta: $('historyMeta'),
  historyList: $('historyList'),

  pageMsg: $('pageMsg'),

  // modal (description)
  descModal: $('descModal'),
  closeModalBtn: $('closeModalBtn'),
  modalTitle: $('modalTitle'),
  modalMeta: $('modalMeta'),
  modalDesc: $('modalDesc'),
  modalGoBtn: $('modalGoBtn'),

  // lightbox
  lightbox: $('lightbox'),
  lightboxImg: $('lightboxImg'),

  // tabs
  tabs: Array.from(document.querySelectorAll('.auc-tab')),
};

function setMsg(type, text) {
  if (!els.pageMsg) return;
  els.pageMsg.className = 'page-msg ' + (type || '');
  els.pageMsg.textContent = text || '';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function fmtDt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('cs-CZ', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit'
  });
}

function normalizeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u; // fix relative link issue
}

function publicImgUrl(path) {
  if (!path) return '';
  const p = encodeURIComponent(path).replaceAll('%2F','/');
  return `${SUPABASE_URL}/storage/v1/object/public/${AUC_BUCKET}/${p}`;
}

function aucState(a) {
  const now = Date.now();
  const starts = a.starts_at ? new Date(a.starts_at).getTime() : null;
  const ends = a.ends_at ? new Date(a.ends_at).getTime() : null;

  if (!ends || Number.isNaN(ends)) return 'ended';
  if (ends <= now) return 'ended';
  if (starts && !Number.isNaN(starts) && starts > now) return 'scheduled';
  return 'live';
}

function badgeHtml(state) {
  if (state === 'live') return `<span class="badge live">LIVE</span>`;
  if (state === 'scheduled') return `<span class="badge scheduled">PLÁNOVÁNO</span>`;
  return `<span class="badge ended">UKONČENO</span>`;
}

function clampText(text, limit = 170) {
  const s = String(text || '');
  if (s.length <= limit) return { short: s, cut: false };
  return { short: s.slice(0, limit).trim() + '…', cut: true };
}

function countdownParts(ms) {
  const safe = Math.max(0, ms);
  const totalSec = Math.floor(safe / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { d, h, m, s };
}

function fmtCountdown(ms) {
  const { d, h, m, s } = countdownParts(ms);
  const pad = (n) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ===================== DATA =====================
let AUCTIONS = [];
let TICKER = null;

const PAGE_SIZE = 4;
let ACTIVE_TAB = 'live';
let historyPage = 1;

// ===================== MODAL (DESC) =====================
function openDescModal({ title, meta, desc, url }) {
  els.modalTitle.textContent = title || '—';
  els.modalMeta.textContent = meta || '—';
  els.modalDesc.textContent = desc || '';

  const link = normalizeUrl(url);
  els.modalGoBtn.href = link || '#';
  els.modalGoBtn.style.opacity = link ? '1' : '.6';
  els.modalGoBtn.style.pointerEvents = link ? 'auto' : 'none';

  els.descModal.classList.remove('hidden');
}

function closeDescModal() {
  els.descModal.classList.add('hidden');
}

// ===================== LIGHTBOX =====================
function openLightbox(url) {
  if (!url) return;
  els.lightboxImg.src = url;
  els.lightbox.classList.remove('hidden');
}

function closeLightbox() {
  els.lightbox.classList.add('hidden');
  els.lightboxImg.src = '';
}

// ===================== RENDER =====================
function renderAuctionCard(a) {
  const st = aucState(a);
  const images = Array.isArray(a.auction_images) ? a.auction_images : [];
  const imgUrls = images.map(x => publicImgUrl(x.path)).filter(Boolean);

  const main = imgUrls[0] || '';
  const fb = normalizeUrl(a.fb_url);

  const { short, cut } = clampText(a.description || '', 190);

  const startsTxt = a.starts_at ? fmtDt(a.starts_at) : '—';
  const endsTxt = a.ends_at ? fmtDt(a.ends_at) : '—';

  const endsMs = a.ends_at ? new Date(a.ends_at).getTime() : 0;
  const startsMs = a.starts_at ? new Date(a.starts_at).getTime() : 0;

  // countdown target:
  // - live: ends_at
  // - scheduled: starts_at (odpočet do startu)
  // - ended: 0
  let cdLabel = 'Do konce';
  let cdTarget = endsMs;

  if (st === 'scheduled') {
    cdLabel = 'Do startu';
    cdTarget = startsMs || endsMs;
  }
  if (st === 'ended') {
    cdLabel = 'Ukončeno';
    cdTarget = 0;
  }

  const safeId = escapeHtml(a.id);
  const title = escapeHtml(a.title || '—');

  return `
    <article class="auc-card" data-auc-id="${safeId}">
      <div class="auc-inner">

        <div class="auc-left">
          <div class="auc-title">${title}</div>

          <div class="badges">
            ${badgeHtml(st)}
          </div>

          <div class="gallery" data-gallery="${safeId}">
            ${
              main
                ? `<img class="gallery-main" data-main src="${main}" data-full="${main}" alt="">`
                : `<div class="gallery-main" style="display:flex; align-items:center; justify-content:center; opacity:.7;">
                     Bez fotek
                   </div>`
            }

            ${
              imgUrls.length > 1
                ? `<div class="gallery-thumbs">
                    ${imgUrls.map((u, i) => `
                      <img class="thumb ${i===0?'active':''}" data-thumb src="${u}" data-full="${u}" alt="">
                    `).join('')}
                  </div>`
                : (imgUrls.length === 1
                    ? `<div class="gallery-thumbs"><span class="muted small">1 fotka</span></div>`
                    : `<div class="gallery-thumbs"><span class="muted small">Nahraj fotky a bude to tu sexy.</span></div>`
                  )
            }
          </div>
        </div>

        <aside class="auc-right">
          <div class="kv">
            <div class="kv-row"><span>Start</span><strong>${escapeHtml(startsTxt)}</strong></div>
            <div class="kv-row"><span>Konec</span><strong>${escapeHtml(endsTxt)}</strong></div>
          </div>

          <div class="cta">
            <div class="desc">
              ${escapeHtml(short).replaceAll('\n','<br>')}
            </div>

            ${
              cut
                ? `<div class="desc-actions">
                    <button class="btn-link" type="button" data-act="more"
                      data-title="${escapeHtml(a.title || '')}"
                      data-meta="${escapeHtml(`${st.toUpperCase()} • konec: ${endsTxt}`)}"
                      data-desc="${escapeHtml(a.description || '')}"
                      data-url="${escapeHtml(fb)}"
                    >Zobrazit více</button>
                  </div>`
                : ''
            }

            <a class="btn-primary" href="${escapeHtml(fb || '#')}" target="_blank" rel="noopener">
              Otevřít aukci na FB
            </a>

            <div class="countdown ${st}" data-cd-target="${cdTarget}">
              <div class="label">${escapeHtml(cdLabel)}</div>
              <div class="time" data-cd-time>—</div>
            </div>

            <div class="muted small">
              Tip: na mobilu to otevři v aplikaci Facebook (lepší UX).
            </div>
          </div>
        </aside>

      </div>
    </article>
  `;
}

function renderPagination(totalPages) {
  // když pagination nepotřebuješ, smaž
  const prevDisabled = historyPage <= 1 ? 'disabled' : '';
  const nextDisabled = historyPage >= totalPages ? 'disabled' : '';

  return `
    <div class="auc-pager" style="display:flex; gap:10px; justify-content:center; align-items:center; margin-top:14px;">
      <button class="btn-ghost" type="button" data-page="prev" ${prevDisabled}>← Předchozí</button>
      <div class="muted small">Strana <b>${historyPage}</b> / ${totalPages}</div>
      <button class="btn-ghost" type="button" data-page="next" ${nextDisabled}>Další →</button>
    </div>
  `;
}

function showOnlyCurrentCard(show) {
  const card = els.currentList?.closest('.card');
  if (!card) return;
  card.classList.toggle('hidden', !show);
}

function showOnlyHistoryCard(show) {
  const card = els.historyList?.closest('.card');
  if (!card) return;
  card.classList.toggle('hidden', !show);
}

function setActiveTab(tab) {
  ACTIVE_TAB = tab;

  els.tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  // Live/scheduled používají current card, historie používá history card
  if (tab === 'history') {
    showOnlyCurrentCard(false);
    showOnlyHistoryCard(true);
  } else {
    showOnlyCurrentCard(true);
    showOnlyHistoryCard(false);
  }

  // rerender
  renderByTab();
  restartTicker();
}

function renderByTab() {
  const live = AUCTIONS.filter(a => aucState(a) === 'live')
    .sort((a,b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());

  const scheduled = AUCTIONS.filter(a => aucState(a) === 'scheduled')
    .sort((a,b) => new Date(a.starts_at || a.ends_at).getTime() - new Date(b.starts_at || b.ends_at).getTime());

  const ended = AUCTIONS.filter(a => aucState(a) === 'ended')
    .sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());

  // vyčistit meta texty (už nechceš počty)
  if (els.currentMeta) els.currentMeta.textContent = '';
  if (els.historyMeta) els.historyMeta.textContent = '';

  // LIVE
  if (ACTIVE_TAB === 'live') {
    els.currentTitle.textContent = 'Aktuální aukce (LIVE)';
    if (!live.length) {
      els.currentList.innerHTML = `<div class="muted">Teď nic neběží.</div>`;
    } else {
      els.currentList.innerHTML = live.map(renderAuctionCard).join('');
    }
    return;
  }

  // SCHEDULED
  if (ACTIVE_TAB === 'scheduled') {
    els.currentTitle.textContent = 'Plánované aukce';
    if (!scheduled.length) {
      els.currentList.innerHTML = `<div class="muted">Zatím nic naplánovaného.</div>`;
    } else {
      els.currentList.innerHTML = scheduled.map(renderAuctionCard).join('');
    }
    return;
  }

  // HISTORY (pagination)
  if (ACTIVE_TAB === 'history') {
    const total = ended.length;
    if (!total) {
      els.historyList.innerHTML = `<div class="muted">Zatím žádná historie.</div>`;
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    historyPage = Math.min(historyPage, totalPages);
    historyPage = Math.max(historyPage, 1);

    const start = (historyPage - 1) * PAGE_SIZE;
    const slice = ended.slice(start, start + PAGE_SIZE);

    // meta můžeš použít pro info
    els.historyMeta.textContent = `Ukončené aukce: ${total}`;

    els.historyList.innerHTML = slice.map(renderAuctionCard).join('') + renderPagination(totalPages);
    return;
  }
}

// ===================== COUNTDOWNS =====================
function tickCountdowns() {
  const nodes = document.querySelectorAll('[data-cd-target]');
  const now = Date.now();

  nodes.forEach(box => {
    const target = Number(box.getAttribute('data-cd-target') || 0);
    const timeEl = box.querySelector('[data-cd-time]');
    if (!timeEl) return;

    if (!target) {
      timeEl.textContent = '—';
      return;
    }

    const diff = target - now;

    if (diff <= 0) {
      timeEl.textContent = '00:00:00';
      return;
    }

    timeEl.textContent = fmtCountdown(diff);
  });
}

function restartTicker() {
  if (TICKER) clearInterval(TICKER);
  tickCountdowns();
  TICKER = setInterval(tickCountdowns, 1000);
}

// ===================== LOAD =====================
async function loadAuctions() {
  setMsg('', '');

  const { data, error } = await sb
    .from('auctions')
    .select(`
      id, created_at, title, description, fb_url, starts_at, ends_at, published,
      auction_images ( id, path, sort_order, created_at )
    `)
    .order('ends_at', { ascending: false });

  if (error) throw error;

  const rows = (data || []).filter(a => a.published === true);

  rows.forEach(a => {
    if (!Array.isArray(a.auction_images)) a.auction_images = [];
    a.auction_images.sort((x,y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
  });

  AUCTIONS = rows;
}

// ===================== EVENTS =====================
document.addEventListener('DOMContentLoaded', async () => {
  // Tabs click
  if (els.tabs?.length) {
    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        if (tab === 'history') historyPage = 1; // reset page when entering history
        setActiveTab(tab);
      });
    });
  }

  // modal close
  els.closeModalBtn.addEventListener('click', closeDescModal);
  els.descModal.addEventListener('click', (e) => {
    if (e.target === els.descModal) closeDescModal();
  });

  // lightbox close
  els.lightbox.addEventListener('click', (e) => {
    if (e.target === els.lightbox || e.target === els.lightboxImg) closeLightbox();
  });

  // ESC closes modal/lightbox
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!els.descModal.classList.contains('hidden')) closeDescModal();
      if (!els.lightbox.classList.contains('hidden')) closeLightbox();
    }
  });

  // delegation: thumbs, main image (lightbox), show more, pagination
  document.body.addEventListener('click', (e) => {
    // pagination buttons (history)
    const pg = e.target.closest('[data-page]');
    if (pg && ACTIVE_TAB === 'history') {
      const dir = pg.getAttribute('data-page');
      if (dir === 'prev') historyPage = Math.max(1, historyPage - 1);
      if (dir === 'next') historyPage = historyPage + 1;
      renderByTab();
      restartTicker();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // thumb click -> change main
    const t = e.target.closest('[data-thumb]');
    if (t) {
      const gallery = t.closest('[data-gallery]');
      const main = gallery?.querySelector('[data-main]');
      if (!main) return;

      const url = t.getAttribute('data-full');
      if (url) {
        main.src = url;
        main.setAttribute('data-full', url);
      }

      gallery.querySelectorAll('.thumb').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      return;
    }

    // main image click -> lightbox
    const mainImg = e.target.closest('.gallery-main[data-full]');
    if (mainImg) {
      const url = mainImg.getAttribute('data-full') || mainImg.getAttribute('src');
      openLightbox(url);
      return;
    }

    // show more -> open modal
    const more = e.target.closest('[data-act="more"]');
    if (more) {
      const title = more.getAttribute('data-title') || '';
      const meta = more.getAttribute('data-meta') || '';
      const desc = more.getAttribute('data-desc') || '';
      const url = more.getAttribute('data-url') || '';
      openDescModal({ title, meta, desc, url });
      return;
    }
  });

  try {
    await loadAuctions();

    // default: LIVE only
    historyPage = 1;
    setActiveTab('live');

  } catch (err) {
    console.error(err);
    setMsg('err', `Nešlo načíst aukce: ${err?.message || err}`);
    if (els.currentList) els.currentList.innerHTML = `<div class="muted">Chyba načítání.</div>`;
    if (els.historyList) els.historyList.innerHTML = `<div class="muted">Chyba načítání.</div>`;
  }
});
