// SUPABASE
const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';
const sb = supabase.createClient(supabaseUrl, supabaseKey);

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

// fallback kdyby OfferUI nebylo k dispozici
function fallbackRender(container, cards){
  container.innerHTML = '';
  cards.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card';
    div.onclick = () => location.href = `card.html?id=${c.id}`;

    div.innerHTML = `
      <img src="${c.image_url}" alt="${escapeHtml(c.name)}">
      <div class="card-badges">
        <span class="badge ${c.status === 'Rezervováno' ? 'badge-reserved' : 'badge-stock'}">
          ${escapeHtml(c.status || 'Skladem')}
        </span>
        <span class="badge ${c.psa_grade ? 'badge-psa' : 'badge-unknown'}">
          ${c.psa_grade ? `PSA ${escapeHtml(c.psa_grade)}` : escapeHtml(c.condition || 'RAW')}
        </span>
      </div>
      <strong>${escapeHtml(c.name)}</strong>
      <div class="price">${c.price} Kč</div>
    `;
    container.appendChild(div);
  });
}

async function loadHotOffers(){
  const { data, error } = await sb
    .from('cards')
    .select('id,name,price,image_url,status,condition,psa_grade,hot')
    .eq('hot', true)
    .neq('status', 'Prodáno');

  if(error){
    console.error('Chyba při načítání hot karet:', error);
    return;
  }

  const container = document.getElementById('hot-cards');
  if (!container) return;

  const all = data || [];
  const picked = shuffle(all).slice(0, 4);

  // ✅ render přes shared UI
  if (window.OfferUI && typeof window.OfferUI.renderCards === 'function'){
    window.OfferUI.renderCards(container, picked);
  } else {
    console.warn('OfferUI.renderCards není k dispozici, jedu fallback.');
    fallbackRender(container, picked);
  }
}

document.addEventListener('DOMContentLoaded', loadHotOffers);
