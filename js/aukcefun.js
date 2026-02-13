// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3jbfrhbgeczukcjkmcaIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AUC_BUCKET = 'auctions';

// ===================== UI =====================
const $ = (id) => document.getElementById(id);

const els = {
  currentTitle: $('currentTitle'),
  currentMeta: $('currentMeta'),
  currentList: $('currentList'),
  historyList: $('historyList'),
  historyMeta: $('historyMeta'),
  pageMsg: $('pageMsg'),

  // modal
  descModal: $('descModal'),
  closeModalBtn: $('closeModalBtn'),
  modalTitle: $('modalTitle'),
  modalMeta: $('modalMeta'),
  modalDesc: $('modalDesc'),
  modalGoBtn: $('modalGoBtn'),
};

function setMsg(type, text) {
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
  return 'https://' + u; // ✅ fix relative link issue
}

function publicImgUrl(path) {
  if (!path) return '';
  // bucket je public → jde přes /object/public
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

// ===================== MODAL =====================
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
            ${a.published ? '' : `<span class="badge ended">SKRYTÉ</span>`}
          </div>

          <div class="gallery" data-gallery="${safeId}">
            ${
              main
                ? `<img class="gallery-main" data-main src="${main}" alt="">`
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

            <div class="countdown ${st}" data-cd-label="${escapeHtml(cdLabel)}" data-cd-target="${cdTarget}">
              <div class="label">${escapeHtml(cdLabel)}</div>
              <div class="time" data-cd-time>—</div>
            </div>

            <div class="muted small">
              Tip: když jsi na mobilu, otevři to v aplikaci Facebook pro nejlepší UX.
            </div>
          </div>
        </aside>

      </div>
    </article>
  `;
}

function renderAll() {
  const now = Date.now();

  const live = AUCTIONS.filter(a => aucState(a) === 'live');
  const scheduled = AUCTIONS.filter(a => aucState(a) === 'scheduled');
  const ended = AUCTIONS.filter(a => aucState(a) === 'ended');

  // CURRENT SECTION: live, else scheduled, else empty
  let current = [];
  let title = 'Aktuální aukce';

  if (live.length) {
    current = live.sort((a,b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
    title = 'Aktuální aukce (LIVE)';
  } else if (scheduled.length) {
    current = scheduled.sort((a,b) => new Date(a.starts_at || a.ends_at).getTime() - new Date(b.starts_at || b.ends_at).getTime());
    title = 'Plánované aukce';
  } else {
    current = [];
    title = 'Aktuální aukce';
  }

  els.currentTitle.textContent = title;
  els.currentMeta.textContent = live.length
    ? `LIVE: ${live.length} • Plánované: ${scheduled.length} • Historie: ${ended.length}`
    : scheduled.length
      ? `Plánované: ${scheduled.length} • Historie: ${ended.length}`
      : `Zatím nic • Historie: ${ended.length}`;

  if (!current.length) {
    els.currentList.innerHTML = `<div class="muted">Teď nic neběží ani není naplánované. Sleduj IG/FB, ať ti nic neuteče 👀</div>`;
  } else {
    els.currentList.innerHTML = current.map(renderAuctionCard).join('');
  }

  // HISTORY SECTION
  els.historyMeta.textContent = `Ukončené: ${ended.length}`;
  if (!ended.length) {
    els.historyList.innerHTML = `<div class="muted">Zatím žádná historie.</div>`;
  } else {
    // historie – nejnovější ukončené nahoře (podle ends_at desc)
    const hist = ended.sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());
    els.historyList.innerHTML = hist.map(renderAuctionCard).join('');
  }

  restartTicker();
}

function tickCountdowns() {
  const nodes = document.querySelectorAll('[data-cd-target]');
  const now = Date.now();

  nodes.forEach(box => {
    const target = Number(box.getAttribute('data-cd-target') || 0);
    const stateClass = box.classList.contains('ended') ? 'ended'
      : box.classList.contains('scheduled') ? 'scheduled'
      : 'live';

    const timeEl = box.querySelector('[data-cd-time]');
    if (!timeEl) return;

    if (!target || stateClass === 'ended') {
      timeEl.textContent = '—';
      return;
    }

    const diff = target - now;

    if (diff <= 0) {
      // přepne text, ale data se refetchnou až na reload (můžeš doplnit auto-refetch)
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

  const rows = (data || [])
    .filter(a => a.published === true); // veřejně jen publikované

  rows.forEach(a => {
    if (!Array.isArray(a.auction_images)) a.auction_images = [];
    a.auction_images.sort((x,y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
  });

  AUCTIONS = rows;
  renderAll();
}

// ===================== EVENTS =====================
document.addEventListener('DOMContentLoaded', async () => {
  // modal close
  els.closeModalBtn.addEventListener('click', closeModal);
  els.descModal.addEventListener('click', (e) => {
    if (e.target === els.descModal) closeModal();
  });

  // delegation: thumbs + show more
  document.body.addEventListener('click', (e) => {
    // thumbs
    const t = e.target.closest('[data-thumb]');
    if (t) {
      const card = t.closest('[data-gallery]');
      const main = card?.querySelector('[data-main]');
      if (!main) return;

      const url = t.getAttribute('data-full');
      if (url) main.src = url;

      card.querySelectorAll('.thumb').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      return;
    }

    // show more
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
    await loadAuctions();
  } catch (err) {
    console.error(err);
    setMsg('err', `Nešlo načíst aukce: ${err?.message || err}`);
    els.currentList.innerHTML = `<div class="muted">Chyba načítání.</div>`;
    els.historyList.innerHTML = `<div class="muted">Chyba načítání.</div>`;
  }
});
