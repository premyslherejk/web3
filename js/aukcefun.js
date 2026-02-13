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
  currentTitle: $('currentTitle'),
  currentMeta: $('currentMeta'),
  currentList: $('currentList'),
  pageMsg: $('pageMsg'),

  // modal (popis)
  descModal: $('descModal'),
  closeModalBtn: $('closeModalBtn'),
  modalTitle: $('modalTitle'),
  modalMeta: $('modalMeta'),
  modalDesc: $('modalDesc'),
  modalGoBtn: $('modalGoBtn'),

  // lightbox (foto)
  lightbox: $('lightbox'),
  lightboxImg: $('lightboxImg'),
};

// ===================== HELPERS =====================
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
  return 'https://' + u;
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

function clampText(text, limit = 190) {
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

let ACTIVE_TAB = 'live'; // live | scheduled | history
let HISTORY_PAGE = 1;
const HISTORY_PER_PAGE = 4;

// ===================== MODAL (popis) =====================
function openModal({ title, meta, desc, url }) {
  els.modalTitle.textContent = title || '—';
  els.modalMeta.textContent = meta || '—';
  els.modalDesc.textContent = desc || '';

  const link = normalizeUrl(url);
  els.modalGoBtn.href = link || '#';
  els.modalGoBtn.style.opacity = link ? '1' : '.6';
  els.modalGoBtn.style.pointerEvents = link ? 'auto' : 'none';

  els.descModal.classList.remove('hidden');
}

function closeModal() {
  els.descModal.classList.add('hidden');
}

// ===================== LIGHTBOX (foto) =====================
function openLightbox(src) {
  if (!els.lightbox || !els.lightboxImg) return;
  if (!src) return;
  els.lightboxImg.src = src;
  els.lightbox.classList.remove('hidden');
}

function closeLightbox() {
  if (!els.lightbox) return;
  els.lightbox.classList.add('hidden');
  if (els.lightboxImg) els.lightboxImg.src = '';
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
                ? `<img class="gallery-main" data-main data-fullsrc="${escapeHtml(main)}" src="${escapeHtml(main)}" alt="">`
                : `<div class="gallery-main" style="display:flex; align-items:center; justify-content:center; opacity:.7;">
                     Bez fotek
                   </div>`
            }

            ${
              imgUrls.length > 1
                ? `<div class="gallery-thumbs">
                    ${imgUrls.map((u, i) => `
                      <img class="thumb ${i===0?'active':''}" data-thumb data-full="${escapeHtml(u)}" src="${escapeHtml(u)}" alt="">
                    `).join('')}
                  </div>`
                : (imgUrls.length === 1
                    ? `<div class="gallery-thumbs"><span class="muted small">1 fotka</span></div>`
                    : `<div class="gallery-thumbs"><span class="muted small">Zatím bez fotek.</span></div>`
                  )
            }
          </div>

          <div class="desc">
            ${escapeHtml(short).replaceAll('\n','<br>')}
          </div>

          <div class="desc-actions">
            ${
              cut
                ? `<button class="btn-link" type="button" data-act="more"
                      data-title="${escapeHtml(a.title || '')}"
                      data-meta="${escapeHtml(`${st.toUpperCase()} • konec: ${endsTxt}`)}"
                      data-desc="${escapeHtml(a.description || '')}"
                      data-url="${escapeHtml(fb)}"
                    >Zobrazit více</button>`
                : ''
            }
          </div>
        </div>

        <aside class="auc-right">
          <div class="kv">
            <div class="kv-row"><span>Start</span><strong>${escapeHtml(startsTxt)}</strong></div>
            <div class="kv-row"><span>Konec</span><strong>${escapeHtml(endsTxt)}</strong></div>
          </div>

          <div class="cta">
            <a class="btn-primary" href="${escapeHtml(fb || '#')}" target="_blank" rel="noopener">
              Otevřít aukci na FB
            </a>

            <div class="countdown ${st}" data-cd-target="${cdTarget}">
              <div class="label">${escapeHtml(cdLabel)}</div>
              <div class="time" data-cd-time>—</div>
            </div>

            <div class="muted small">
              Tip: na mobilu otevři v aplikaci Facebook pro nejlepší UX.
            </div>
          </div>
        </aside>

      </div>
    </article>
  `;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) return '';

  const prevDisabled = HISTORY_PAGE <= 1 ? 'disabled' : '';
  const nextDisabled = HISTORY_PAGE >= totalPages ? 'disabled' : '';

  return `
    <div class="pager">
      <button class="btn-ghost" data-page="prev" ${prevDisabled}>⬅ Předchozí</button>
      <span class="muted">Strana ${HISTORY_PAGE} / ${totalPages}</span>
      <button class="btn-ghost" data-page="next" ${nextDisabled}>Další ➡</button>
    </div>
  `;
}

function renderAll() {
  // meta pryč
  if (els.currentMeta) els.currentMeta.textContent = '';

  const live = AUCTIONS.filter(a => aucState(a) === 'live')
    .sort((a,b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());

  const scheduled = AUCTIONS.filter(a => aucState(a) === 'scheduled')
    .sort((a,b) => new Date(a.starts_at || a.ends_at).getTime() - new Date(b.starts_at || b.ends_at).getTime());

  const ended = AUCTIONS.filter(a => aucState(a) === 'ended')
    .sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());

  if (ACTIVE_TAB === 'live') {
    els.currentTitle.textContent = 'Aktuální aukce (LIVE)';
    els.currentList.innerHTML = live.length
      ? live.map(renderAuctionCard).join('')
      : `<div class="muted">Teď nic neběží 😅</div>`;
  }

  if (ACTIVE_TAB === 'scheduled') {
    els.currentTitle.textContent = 'Plánované aukce';
    els.currentList.innerHTML = scheduled.length
      ? scheduled.map(renderAuctionCard).join('')
      : `<div class="muted">Zatím nejsou žádné plánované aukce.</div>`;
  }

  if (ACTIVE_TAB === 'history') {
    els.currentTitle.textContent = 'Historie aukcí';

    if (!ended.length) {
      els.currentList.innerHTML = `<div class="muted">Zatím žádná historie.</div>`;
    } else {
      const totalPages = Math.ceil(ended.length / HISTORY_PER_PAGE);
      // safety clamp
      HISTORY_PAGE = Math.min(Math.max(1, HISTORY_PAGE), totalPages);

      const start = (HISTORY_PAGE - 1) * HISTORY_PER_PAGE;
      const slice = ended.slice(start, start + HISTORY_PER_PAGE);

      els.currentList.innerHTML =
        slice.map(renderAuctionCard).join('') +
        renderPagination(totalPages);
    }
  }

  restartTicker();
}

// ===================== COUNTDOWN =====================
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
  renderAll();
}

// ===================== EVENTS =====================
document.addEventListener('DOMContentLoaded', async () => {
  // MODAL close
  els.closeModalBtn?.addEventListener('click', closeModal);
  els.descModal?.addEventListener('click', (e) => {
    if (e.target === els.descModal) closeModal();
  });

  // LIGHTBOX close
  els.lightbox?.addEventListener('click', closeLightbox);

  // Tabs (LIVE / scheduled / history)
  document.querySelectorAll('.auc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auc-tab').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');

      ACTIVE_TAB = btn.dataset.tab || 'live';
      HISTORY_PAGE = 1;
      renderAll();
    });
  });

  // Delegation: thumbs, show more, gallery click, paging
  document.body.addEventListener('click', (e) => {
    // paging
    const p = e.target.closest('[data-page]');
    if (p) {
      const dir = p.getAttribute('data-page');
      if (dir === 'prev') HISTORY_PAGE = Math.max(1, HISTORY_PAGE - 1);
      if (dir === 'next') HISTORY_PAGE = HISTORY_PAGE + 1;
      renderAll();
      return;
    }

    // thumbs
    const t = e.target.closest('[data-thumb]');
    if (t) {
      const card = t.closest('[data-gallery]');
      const main = card?.querySelector('[data-main]');
      if (!main) return;

      const url = t.getAttribute('data-full');
      if (url) {
        main.src = url;
        main.setAttribute('data-fullsrc', url);
      }

      card.querySelectorAll('.thumb').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      return;
    }

    // open lightbox when clicking main image
    const mainImg = e.target.closest('img.gallery-main');
    if (mainImg) {
      const src = mainImg.getAttribute('data-fullsrc') || mainImg.src;
      openLightbox(src);
      return;
    }

    // also allow clicking thumb to open lightbox (optional)
    const thumbImg = e.target.closest('img.thumb');
    if (thumbImg && e.shiftKey) {
      const src = thumbImg.getAttribute('data-full') || thumbImg.src;
      openLightbox(src);
      return;
    }

    // show more modal
    const more = e.target.closest('[data-act="more"]');
    if (more) {
      const title = more.getAttribute('data-title') || '';
      const meta = more.getAttribute('data-meta') || '';
      const desc = more.getAttribute('data-desc') || '';
      const url = more.getAttribute('data-url') || '';
      openModal({ title, meta, desc, url });
      return;
    }
  });

  try {
    // default tab = LIVE (ať sedí i UI)
    const liveBtn = document.querySelector('.auc-tab[data-tab="live"]');
    if (liveBtn) {
      document.querySelectorAll('.auc-tab').forEach(x => x.classList.remove('active'));
      liveBtn.classList.add('active');
      ACTIVE_TAB = 'live';
    }

    await loadAuctions();
  } catch (err) {
    console.error(err);
    setMsg('err', `Nešlo načíst aukce: ${err?.message || err}`);
    if (els.currentList) els.currentList.innerHTML = `<div class="muted">Chyba načítání.</div>`;
  }
});
