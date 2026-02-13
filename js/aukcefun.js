// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== UI =====================
const $ = (id) => document.getElementById(id);

const els = {
  liveWrap: $('liveWrap'),
  schedWrap: $('schedWrap'),
  histWrap: $('histWrap'),
  liveCount: $('liveCount'),
  schedCount: $('schedCount'),
  histCount: $('histCount'),
  pageMsg: $('pageMsg'),
};

function setMsg(type, text) {
  if (!els.pageMsg) return;
  els.pageMsg.className = 'msg ' + (type || '');
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

function msToCountdown(ms) {
  if (ms <= 0) return '0d 00:00:00';
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const hh = String(h).padStart(2,'0');
  const mm = String(m).padStart(2,'0');
  const ss = String(s).padStart(2,'0');
  return `${d}d ${hh}:${mm}:${ss}`;
}

function getPublicImageUrl(path) {
  if (!path) return '';
  // bucket: auctions (pokud je public)
  // path typicky: "auction-uuid/1.jpg" nebo cokoliv co ukládáš
  return `${SUPABASE_URL}/storage/v1/object/public/auctions/${encodeURIComponent(path).replaceAll('%2F','/')}`;
}

// ===================== FETCH =====================
async function fetchAuctionsWithImages() {
  // foreign table select
  const { data, error } = await sb
    .from('auctions')
    .select(`
      id, created_at, title, description, fb_url, starts_at, ends_at, is_published, sort_order,
      auction_images:auction_images ( id, path, caption, sort_order )
    `)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('ends_at', { ascending: false });

  if (error) throw error;

  // seřadit fotky per aukce
  (data || []).forEach(a => {
    if (Array.isArray(a.auction_images)) {
      a.auction_images.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    } else {
      a.auction_images = [];
    }
  });

  return data || [];
}

// ===================== RENDER =====================
function renderEmpty(wrap, text) {
  wrap.innerHTML = `<p class="muted">${escapeHtml(text)}</p>`;
}

function auctionCard(a, kind) {
  const imgs = (a.auction_images || []).map(im => {
    const url = getPublicImageUrl(im.path);
    return `<img src="${url}" alt="">`;
  }).join('');

  const ends = a.ends_at ? new Date(a.ends_at).toISOString() : '';
  const endsNice = fmtDt(a.ends_at);

  const desc = a.description ? escapeHtml(a.description) : '<span class="muted">—</span>';

  const statusClass =
    kind === 'live' ? 'live' :
    kind === 'scheduled' ? 'scheduled' : 'ended';

  const countdownHtml = kind === 'ended'
    ? `<strong class="countdown">HOTOVO ✅</strong>`
    : `<strong class="countdown" data-ends="${escapeHtml(ends)}">—</strong>`;

  const startsLine = a.starts_at ? fmtDt(a.starts_at) : '—';

  return `
    <article class="au-card ${statusClass}">
      <div class="au-images">
        ${imgs || `<div class="img-empty">Bez fotek (zatím)</div>`}
      </div>

      <div class="au-top">
        <div class="au-title">${escapeHtml(a.title || 'Aukce')}</div>
        <div class="au-desc">${desc}</div>

        <div class="au-meta">
          <div class="meta-row">
            <span>Start</span>
            <strong>${escapeHtml(startsLine)}</strong>
          </div>
          <div class="meta-row">
            <span>Konec</span>
            <strong>${escapeHtml(endsNice)}</strong>
          </div>
          <div class="meta-row">
            <span>${kind === 'scheduled' ? 'Do startu' : 'Do konce'}</span>
            ${countdownHtml}
          </div>
        </div>
      </div>

      <div class="au-actions">
        <a class="btn-primary" href="${escapeHtml(a.fb_url)}" target="_blank" rel="noopener">Otevřít aukci na FB</a>
      </div>
    </article>
  `;
}

function splitAuctions(all) {
  const now = new Date();

  const live = [];
  const scheduled = [];
  const ended = [];

  for (const a of all) {
    const starts = a.starts_at ? new Date(a.starts_at) : null;
    const ends = a.ends_at ? new Date(a.ends_at) : null;

    if (!ends || Number.isNaN(ends.getTime())) continue;

    const started = !starts || (!Number.isNaN(starts.getTime()) && starts <= now);
    const notStarted = starts && !Number.isNaN(starts.getTime()) && starts > now;

    if (ends <= now) ended.push(a);
    else if (notStarted) scheduled.push(a);
    else if (started) live.push(a);
    else scheduled.push(a);
  }

  // řazení: live nejblíž konci první (urgent)
  live.sort((a,b) => new Date(a.ends_at) - new Date(b.ends_at));
  // scheduled nejblíž startu první
  scheduled.sort((a,b) => new Date(a.starts_at || a.ends_at) - new Date(b.starts_at || b.ends_at));
  // history nejnovější nahoře (už je většinou podle ends desc)
  ended.sort((a,b) => new Date(b.ends_at) - new Date(a.ends_at));

  return { live, scheduled, ended };
}

// ===================== COUNTDOWN LOOP =====================
let ticker = null;

function startTicker() {
  if (ticker) clearInterval(ticker);

  const tick = () => {
    const now = Date.now();
    document.querySelectorAll('[data-ends]').forEach(el => {
      const iso = el.getAttribute('data-ends');
      const d = iso ? new Date(iso) : null;
      if (!d || Number.isNaN(d.getTime())) {
        el.textContent = '—';
        return;
      }
      const ms = d.getTime() - now;
      el.textContent = msToCountdown(ms);
      if (ms <= 0) el.textContent = '0d 00:00:00';
    });
  };

  tick();
  ticker = setInterval(tick, 1000);
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  setMsg('', '');

  try {
    const all = await fetchAuctionsWithImages();
    const { live, scheduled, ended } = splitAuctions(all);

    els.liveCount.textContent = String(live.length);
    els.schedCount.textContent = String(scheduled.length);
    els.histCount.textContent = String(ended.length);

    // LIVE
    if (!live.length) {
      renderEmpty(els.liveWrap, 'Teď neběží žádná aukce.');
    } else {
      els.liveWrap.innerHTML = live.map(a => auctionCard(a, 'live')).join('');
    }

    // SCHEDULED
    if (!scheduled.length) {
      renderEmpty(els.schedWrap, 'Žádná naplánovaná aukce není.');
    } else {
      els.schedWrap.innerHTML = scheduled.map(a => auctionCard(a, 'scheduled')).join('');
    }

    // HISTORY
    if (!ended.length) {
      renderEmpty(els.histWrap, 'Zatím tu není žádná historie.');
    } else {
      els.histWrap.innerHTML = ended.map(a => auctionCard(a, 'ended')).join('');
    }

    startTicker();

  } catch (e) {
    console.error(e);
    setMsg('err', `Nešlo načíst aukce: ${e?.message || e}`);
    renderEmpty(els.liveWrap, 'Chyba načítání.');
    renderEmpty(els.schedWrap, 'Chyba načítání.');
    renderEmpty(els.histWrap, 'Chyba načítání.');
  }
});
