// ===================== SUPABASE (zatím jen kvůli budoucnu; teď čteme sessionStorage) =====================
const { createClient } = supabase;

const SUPABASE_URL = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== BANK CONFIG (upravíš později) =====================
const BANK_ACC_HUMAN  = '2978973018/3030';
const BANK_ACC_IBAN   = 'CZ7530300000002978973018';
const BANK_MSG_PREFIX = 'PokeKusovky objednávka';

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

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
  if (!orderNumber) return '';
  return String(orderNumber).split('-')[0] || '';
}

function formatDeadline(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('cs-CZ', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit'
  });
}

// QR platba string: SPD*1.0*ACC:...*AM:...*CC:CZK*X-VS:...*MSG:...
function buildSpd({ amount, vs, msg }) {
  const am = Number(amount || 0);
  const cleanMsg = (msg || '').slice(0, 60);

  return [
    'SPD*1.0',
    `ACC:${String(BANK_ACC_IBAN || '').replace(/\s+/g,'').toUpperCase()}`,
    `AM:${am.toFixed(0)}`,
    'CC:CZK',
    vs ? `X-VS:${vs}` : '',
    cleanMsg ? `MSG:${cleanMsg}` : ''
  ].filter(Boolean).join('*');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = (val ?? '—');
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

function renderSteps(payment) {
  if (payment === 'bank') {
    return [
      'Otevři banku a zaplať QR (nebo opis VS + částku).',
      'Po zaplacení objednávku ručně označíme jako zaplacenou a posíláme.',
      'Když to nebude uhrazené do deadline, objednávka se automaticky zruší a karty se vrátí do prodeje.'
    ];
  }
  return [
    'Hotovo. Objednávka je vytvořená a karty jsou rezervované.',
    'Až to odešleme, přijde e-mail „Odesláno“.',
    'Dobírku zaplatíš při převzetí.'
  ];
}

function renderQrToCanvas(canvas, text) {
  if (!canvas) throw new Error('qrCanvas nenalezen');
  if (!window.QRious) throw new Error('QR knihovna se nenačetla (QRious undefined).');

  // eslint-disable-next-line no-new
  new QRious({
    element: canvas,
    value: text,
    size: 260,
    level: 'M'
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const qs = getQs();
  const last = readLastOrder();

  if (!last && !qs.order_number) {
    setHtml(
      'simpleSteps',
      `<li>${escapeHtml('Nenašli jsme data objednávky (pravděpodobně refresh). Pokud ti přišel e-mail, řiď se jím. Jinak nám napiš.')}</li>`
    );
  }

  const data = last || {};

  const orderNumber = data.order_number || qs.order_number || '—';
  const email = data.email || '—';
  const payment = data.payment_method || '—';
  const delivery = data.delivery_method || '—';
  const total = (data.total != null) ? formatKc(data.total) : '—';
  const deadline = formatDeadline(data.reserved_until);

  setText('orderNumber', orderNumber);
  setText('orderEmail', email);

  setText(
    'orderPayment',
    payment === 'bank' ? 'bank (QR / převod)'
      : payment === 'cod' ? 'dobírka'
      : payment
  );

  setText(
    'orderDelivery',
    delivery === 'zasilkovna' ? 'Zásilkovna'
      : delivery
  );

  setText('orderTotal', total);

  const deadlineRow = document.getElementById('orderDeadlineRow');
  if (deadlineRow) {
    deadlineRow.textContent = (deadline && payment === 'bank')
      ? `Deadline pro platbu: ${deadline}`
      : '';
  }

  const steps = renderSteps(payment);
  setHtml('simpleSteps', steps.map(s => `<li>${escapeHtml(s)}</li>`).join(''));

  if (payment === 'bank') {
    show('bankBox', true);

    const vs = firstPartVs(orderNumber);
    const msg = `${BANK_MSG_PREFIX} ${orderNumber}`;
    const spd = buildSpd({ amount: data.total, vs, msg });

    setText('payAmount', formatKc(data.total));
    setText('payVS', vs || '—');
    setText('payAcc', BANK_ACC_HUMAN);
    setText('payMsg', msg);

    const canvas = document.getElementById('qrCanvas');

    try {
      renderQrToCanvas(canvas, spd);
    } catch (err) {
      console.error('QR render fail:', err);
      const wrap = canvas?.parentElement;
      if (wrap) {
        wrap.innerHTML = `
          <div style="text-align:center; opacity:.85; line-height:1.5">
            <b>QR se nepovedlo vykreslit.</b><br>
            Zaplať klasicky: účet + VS + částka.
          </div>
        `;
      }
    }
  } else {
    show('bankBox', false);
  }
});
