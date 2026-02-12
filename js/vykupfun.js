// ===================== SUPABASE =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET = 'buy-requests';

// ===================== DOM =====================
const $ = (id) => document.getElementById(id);

const els = {
  typeGrid: $('typeGrid'),
  howBlock: $('howBlock'),

  singlesBlock: $('singlesBlock'),
  bulkBlock: $('bulkBlock'),

  addRowBtn: $('addRowBtn'),
  itemsWrap: $('itemsWrap'),

  bulkDesc: $('bulkDesc'),
  bulkCount: $('bulkCount'),
  bulkPhotos: $('bulkPhotos'),

  email: $('email'),
  phone: $('phone'),
  message: $('message'),

  form: $('buyForm'),
  submitBtn: $('submitBtn'),
  formMsg: $('formMsg'),
};

let MODE = 'singles';
let rowCounter = 0;

// ===================== UI HELPERS =====================
function setMsg(type, text) {
  els.formMsg.className = 'msg ' + (type || '');
  els.formMsg.textContent = text || '';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function howText(mode) {
  if (mode === 'bulk') {
    return `
      <b>Jak probíhá výkup (bulk):</b><br>
      1) Napíšeš co je uvnitř + odhad počtu.<br>
      2) Přidáš pár fotek (stačí hromádka + pár detailů).<br>
      3) My to zhodnotíme a ozveme se s nabídkou.<br>
      <span class="muted">Bulk je rychlej, ale výkup je “hrubší” než u kusovek.</span>
    `;
  }

  return `
    <b>Jak probíhá výkup (kusové karty):</b><br>
    1) U každé karty nahraješ <b>předek + zadek</b>.<br>
    2) Doplníš název (klidně odhad / “Charizard ex” apod.).<br>
    3) My posoudíme stav + cenu a pošleme nabídku.<br>
    <span class="muted">Bez zadní fotky se stav nedá férově určit.</span>
  `;
}

// ===================== MODE SWITCH =====================
function setMode(mode) {
  MODE = mode;

  // UI active
  [...els.typeGrid.querySelectorAll('.type-card')].forEach(b => {
    b.classList.toggle('active', b.dataset.type === mode);
  });

  // blocks
  els.singlesBlock.classList.toggle('hidden', mode !== 'singles');
  els.bulkBlock.classList.toggle('hidden', mode !== 'bulk');

  els.howBlock.innerHTML = howText(mode);
}

// ===================== ROWS (SINGLES) =====================
function makeRow() {
  rowCounter += 1;
  const idx = rowCounter;

  const wrap = document.createElement('div');
  wrap.className = 'item-row';
  wrap.dataset.row = String(idx);

  wrap.innerHTML = `
    <div class="item-top">
      <div class="item-title">Karta #${idx}</div>
      <div class="item-actions">
        <button class="btn-mini danger" type="button" data-remove="${idx}">Smazat</button>
      </div>
    </div>

    <div class="item-grid">
      <label>
        Název karty (aspoň něco)
        <input type="text" data-name="${idx}" placeholder="např. Pikachu, Charizard ex, …">
      </label>

      <label>
        Přední strana*
        <input type="file" data-front="${idx}" accept="image/*" required>
      </label>

      <label>
        Zadní strana*
        <input type="file" data-back="${idx}" accept="image/*" required>
      </label>
    </div>
  `;

  return wrap;
}

function addRow() {
  els.itemsWrap.appendChild(makeRow());
}

function removeRow(idx) {
  const el = els.itemsWrap.querySelector(`[data-row="${idx}"]`);
  if (el) el.remove();
}

function getSingleRowsData() {
  const rows = [...els.itemsWrap.querySelectorAll('.item-row')];

  const out = [];
  for (const row of rows) {
    const idx = row.dataset.row;

    const name = row.querySelector(`[data-name="${idx}"]`)?.value || '';
    const front = row.querySelector(`[data-front="${idx}"]`)?.files?.[0] || null;
    const back  = row.querySelector(`[data-back="${idx}"]`)?.files?.[0] || null;

    out.push({ idx, name: String(name).trim(), front, back });
  }
  return out;
}

// ===================== UPLOAD =====================
function safeFileName(name) {
  // jednoduchý "slug"
  return String(name || 'photo')
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // fallback
  return 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function uploadOne(folder, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const base = safeFileName(file.name.replace(/\.[^.]+$/, '')) || 'photo';
  const path = `${folder}/${base}-${Date.now()}.${ext}`;

  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  });

  if (error) throw error;
  return path;
}

// ===================== SUBMIT =====================
function validateCommon() {
  const email = String(els.email.value || '').trim();
  if (!email) return 'Chybí e-mail.';
  if (!email.includes('@')) return 'E-mail vypadá divně.';
  return null;
}

function validateSingles() {
  const rows = getSingleRowsData();
  if (!rows.length) return 'Přidej aspoň jednu kartu.';

  for (const r of rows) {
    if (!r.front) return `U karty #${r.idx} chybí přední fotka.`;
    if (!r.back) return `U karty #${r.idx} chybí zadní fotka.`;
    if (!r.name) return `U karty #${r.idx} doplň aspoň název.`;
  }
  return null;
}

function validateBulk() {
  const desc = String(els.bulkDesc.value || '').trim();
  if (!desc) return 'U bulku napiš aspoň co v tom je.';
  const files = els.bulkPhotos.files || [];
  if (!files.length) return 'U bulku přidej aspoň 1 fotku.';
  return null;
}

async function submitRequest(e) {
  e.preventDefault();
  setMsg('', '');

  const commonErr = validateCommon();
  if (commonErr) return setMsg('err', commonErr);

  if (MODE === 'singles') {
    const err = validateSingles();
    if (err) return setMsg('err', err);
  } else {
    const err = validateBulk();
    if (err) return setMsg('err', err);
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = 'Odesílám…';

  const folder = `req-${uid()}`;
  const photoPaths = [];

  try {
    let items = null;
    let bulk = null;

    if (MODE === 'singles') {
      const rows = getSingleRowsData();

      items = [];
      for (const r of rows) {
        const frontPath = await uploadOne(folder, r.front);
        const backPath  = await uploadOne(folder, r.back);
        photoPaths.push(frontPath, backPath);

        items.push({
          name: r.name,
          front_path: frontPath,
          back_path: backPath,
        });
      }
    } else {
      const desc = String(els.bulkDesc.value || '').trim();
      const count = Number(els.bulkCount.value || 0) || 0;
      const files = [...(els.bulkPhotos.files || [])];

      const bulkPhotoPaths = [];
      for (const f of files) {
        const p = await uploadOne(folder, f);
        photoPaths.push(p);
        bulkPhotoPaths.push(p);
      }

      bulk = {
        description: desc,
        count,
        photo_paths: bulkPhotoPaths
      };
    }

    const payload = {
      type: MODE,
      email: String(els.email.value || '').trim(),
      message: String(els.message.value || '').trim() || null,
      items,
      bulk,
      photo_paths: photoPaths,
      // phone si můžeš klidně přidat jako message, nebo si rozšířit tabulku
    };

    // uložíme do DB
    const { error } = await sb.from('buy_requests').insert([payload]);
    if (error) throw error;

    // UI success
    setMsg('ok', 'Díky! Žádost o výkup dorazila ✅ Ozveme se co nejdřív s nabídkou.');

    // reset form
    els.form.reset();
    els.itemsWrap.innerHTML = '';
    rowCounter = 0;
    addRow(); // 1 výchozí
    setMode(MODE);

  } catch (ex) {
    console.error(ex);
    setMsg('err', `Nešlo to odeslat: ${ex?.message || ex}`);
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = 'Odeslat žádost';
  }
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  els.howBlock.innerHTML = howText('singles');

  // default 1 row
  addRow();

  // mode switch
  els.typeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.type-card');
    if (!btn) return;
    setMode(btn.dataset.type);
  });

  // add row
  els.addRowBtn.addEventListener('click', addRow);

  // remove row (delegation)
  els.itemsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    const idx = btn.getAttribute('data-remove');
    removeRow(idx);

    // když smaže vše, dej zpět 1 řádek
    if (!els.itemsWrap.querySelector('.item-row')) addRow();
  });

  // submit
  els.form.addEventListener('submit', submitRequest);
});
