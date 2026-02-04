/* =========================
   offerfun.js
   Shared renderer for cards (badges, price, layout)
   Usage:
     const el = OfferUI.renderCard(card, { size: 'md' });
     OfferUI.renderCardsInto(container, cards, { size: 'md' });

   Extra:
     OfferUI.renderCards(container, cards, opts) // alias (for older calls)
========================= */

(function () {
  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // --- BADGES (classes match your CSS in offervis.css / collectionvis.css) ---
  function statusBadge(status) {
    const s = String(status || '').trim();
    if (s === 'Rezervováno') return { text: 'Rezervováno', cls: 'badge badge-reserved' };
    return { text: 'Skladem', cls: 'badge badge-stock' };
  }

  function conditionOrPsaBadge(psaGrade, condition) {
    const psa = String(psaGrade ?? '').trim();
    if (psa) return { text: `PSA ${psa}`, cls: 'badge badge-psa' };

    const c = String(condition || '').trim();
    const map = {
      'Excellent': { text: 'EX', cls: 'badge badge-ex' },
      'Near Mint': { text: 'NM', cls: 'badge badge-nm' },
      'Good':      { text: 'GD', cls: 'badge badge-gd' },
      'Played':    { text: 'PL', cls: 'badge badge-pl' },
      'Poor':      { text: 'PO', cls: 'badge badge-po' },
    };
    return map[c] || { text: 'RAW', cls: 'badge badge-unknown' };
  }

  // --- MAIN RENDER ---
  function renderCard(card, opts = {}) {
    const {
      size = 'md', // 'sm' | 'md' | 'lg'
      href = (c) => `card.html?id=${c.id}`,
      clickable = true,
    } = opts;

    const el = document.createElement('div');
    el.className = `card card--${size}`;

    const name = escapeHtml(card.name);
    const img = escapeHtml(card.image_url || '');
    const price = Number(card.price ?? 0);

    const b1 = statusBadge(card.status);
    const b2 = conditionOrPsaBadge(card.psa_grade, card.condition);

    el.innerHTML = `
      <img src="${img}" alt="${name}">
      <div class="card-badges">
        <span class="${escapeHtml(b1.cls)}">${escapeHtml(b1.text)}</span>
        <span class="${escapeHtml(b2.cls)}">${escapeHtml(b2.text)}</span>
      </div>
      <strong>${name}</strong>
      <div class="price">${escapeHtml(price)} Kč</div>
    `;

    if (clickable) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        location.href = href(card);
      });
    }

    return el;
  }

  function renderCardsInto(container, cards, opts = {}) {
    if (!container) return;

    container.innerHTML = '';

    if (!cards || !cards.length) {
      container.innerHTML = `<p style="opacity:.7">Nic jsme nenašli 😕</p>`;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const c of cards) frag.appendChild(renderCard(c, opts));
    container.appendChild(frag);
  }

  // ✅ alias pro kompatibilitu (homefun.js může volat renderCards)
  function renderCards(container, cards, opts = {}) {
    return renderCardsInto(container, cards, opts);
  }

  window.OfferUI = {
    escapeHtml,
    renderCard,
    renderCardsInto,
    renderCards, // ✅ přidáno
    statusBadge,
    conditionOrPsaBadge,
  };
})();
