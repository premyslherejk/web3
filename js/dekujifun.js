// ===================== SUPABASE (zatím jen kvůli budoucnu; teď čteme sessionStorage) =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== BANK CONFIG (upraviš později) =====================
// Doporučení: dej IBAN + BIC, nebo aspoň účet.
// QR platba string: SPD*1.0*ACC:...*AM:...*CC:CZK*X-VS:...*MSG:...
const BANK_ACC_IBAN = 'CZ0000000000000000000000'; // <- sem dej IBAN
const BANK_MSG_PREFIX = 'PokeKusovky objednávka';  // <- volitelné

function formatKc(n) {
  const x = Number(n || 0);
  return `${x} Kč`;
}

function getQs() {
  const p = new URLSearchParams(location.search);
  return {
    order_id: p.get('order_id'),
    order_number: p.get('order_number')
  };
}

function readLastOrder() {
  const raw = sessionStorage.getItem('last_order');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function firstPartVs(orderNumber) {
  // 10001-110226 -> VS = 10001
  if (!orderNumber) return '';
  return String(orderNumber).split('-')[0] || '';
}

function formatDeadline(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  // CZ lokální formát:
  return d.toLocaleString('cs-CZ', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function buildSpd({ amount, vs, msg }) {
  // QR Platba (SPD)
  // Pozn: některé banky chtějí AM s tečkou jako desetinná, ale ty máš integer -> posíláme bez desetin
  const am = Number(amount || 0);
  const cleanMsg = (msg || '').slice(0, 60);

  return [
    'SPD*1.0',
    `ACC:${BANK_ACC_IBAN}`,
    `AM:${am}`,
    'CC:CZK',
    vs ? `X-VS:${vs}` : '',
    cleanMsg ? `MSG:${cleanMsg}` : ''
  ].filter(Boolean).join('*');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function show(elId, yes) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.toggle('hidden', !yes);
}

function setupPrintOnlyBankBox() {
  const btn = document.getElementById('printBank');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // Vytiskne stránku, ale CSS (print) si zvolíme tak,
    // aby zůstala jen bank box část.
    window.print();
  });
}

function installPrintCssForBankOnly() {
  // přidáme print style dynamicky:
  const style = document.createElement('style');
  style.textContent = `
@media print{
  body * { visibility: hidden !important; }
  #bankBox, #bankBox * { visibility: visible !important; }
  #bankBox { position: absolute !important; left: 0; top: 0; width: 100% !important; }
}
`;
  document.head.appendChild(style);
}

function setupCopySpd(spdText) {
  const btn = document.getElementById('copySpd');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(spdText);
      btn.textContent = 'Zkopírováno ✅';
      setTimeout(() => (btn.textContent = 'Zkopírovat QR text'), 1200);
    } catch {
      alert('Kopírování se nepovedlo. Zkus to ručně.');
    }
  });
}

function renderSteps(payment) {
  if (payment === 'bank') {
    return [
      'Otevři banku a zaplať QR (nebo opis VS + částku).',
      'Po zaplacení to ručně označíme jako zaplacené a posíláme.',
      'Když to nebude uhrazené do deadline, objednávka se automaticky zruší a karty se vrátí do prodeje.',
      'Chceš to urychlit? Pošli potvrzení platby na e-mail (volitelné).'
    ];
  }

  // COD
  return [
    'Hotovo. Objednávka je vytvořená a karty jsou rezervované.',
    'Až to odešleme, přijde e-mail „Odesláno“.',
    'Dobírku zaplatíš při převzetí.',
    'Když zásilku nepřevezmeš, objednávka se ručně označí jako vrácená a karty se vrátí do prodeje.'
  ];
}

document.addEventListener('DOMContentLoaded', async () => {
  const qs = getQs();
  const last = readLastOrder();

  // preferujeme data z last_order (protože user nemá přístup k orders kvůli RLS)
  const data = last || {};

  const orderNumber = data.order_number || qs.order_number || '—';
  const email = data.email || '—';
  const payment = data.payment_method || '—';
  const delivery = data.delivery_method || '—';
  const total = (data.total != null) ? formatKc(data.total) : '—';
  const deadline = formatDeadline(data.reserved_until);

  setText('orderNumber', orderNumber);
  setText('orderEmail', email);
  setText('orderPayment', payment === 'bank' ? 'bank (QR / převod)' : (payment === 'cod' ? 'dobírka' : payment));
  setText('orderDelivery', delivery === 'zasilkovna' ? 'Zásilkovna' : (delivery === 'balikovna' ? 'Balíkovna' : delivery));
  setText('orderTotal', total);

  const deadlineRow = document.getElementById('orderDeadlineRow');
  if (deadline && payment === 'bank') {
    deadlineRow.textContent = `Deadline pro platbu: ${deadline}`;
  } else {
    deadlineRow.textContent = '';
  }

  // steps
  const steps = renderSteps(payment);
  setHtml('simpleSteps', steps.map(s => `<li>${escapeHtml(s)}</li>`).join(''));

  // bank QR box
  if (payment === 'bank') {
    show('bankBox', true);

    const vs = firstPartVs(orderNumber);
    const msg = `${BANK_MSG_PREFIX} ${orderNumber}`;
    const spd = buildSpd({ amount: data.total, vs, msg });

    setText('payAmount', formatKc(data.total));
    setText('payVS', vs || '—');
    setText('payAcc', BANK_ACC_IBAN);
    setText('payMsg', msg);

    // QR render
    const canvas = document.getElementById('qrCanvas');
    if (canvas && window.QRCode) {
      QRCode.toCanvas(canvas, spd, { width: 260, margin: 1 }, (err) => {
        if (err) console.error(err);
      });
    }

    setupCopySpd(spd);
    installPrintCssForBankOnly();
    setupPrintOnlyBankBox();
  } else {
    show('bankBox', false);
  }
});

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
