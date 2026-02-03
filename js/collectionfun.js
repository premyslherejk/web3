const { createClient } = supabase;
const sb = createClient(
  'https://hwjbfrhbgeczukcjkmca.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ'
);

let currentLang = null;
let currentSection = null;
let currentSet = null;

async function loadCards() {
  let q = sb.from('cards').select('*').eq('status', 'Skladem');

  if (currentLang) q = q.eq('language', currentLang);
  if (currentSection === 'new') q = q.eq('new', true);
  if (currentSection === 'hot') q = q.eq('hot', true);
  if (currentSet) q = q.eq('set', currentSet);

  const { data } = await q.order('created_at', { ascending: false });
  renderCards(data);
}

function renderCards(cards) {
  const c = document.getElementById('cards');
  c.innerHTML = '';
  cards.forEach(card => {
    const d = document.createElement('div');
    d.className = 'card';
    d.onclick = () => location.href = `card.html?id=${card.id}`;
    d.innerHTML = `
      <img src="${card.image_url}">
      <strong>${card.name}</strong>
      <div>${card.price} Kč</div>
    `;
    c.appendChild(d);
  });
}

async function loadEditions() {
  const { data } = await sb
    .from('cards')
    .select('set')
    .eq('language', currentLang);

  const sets = [...new Set(data.map(d => d.set))];
  const container = document.getElementById('editions');
  container.innerHTML = '';
  container.classList.remove('hidden');

  sets.forEach(s => {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = () => {
      currentSet = s;
      loadCards();
    };
    container.appendChild(b);
  });
}

document.querySelectorAll('.lang-card').forEach(c => {
  c.onclick = () => {
    currentLang = c.dataset.lang;
    document.getElementById('langSelect').classList.add('hidden');
    loadEditions();
    loadCards();
  };
});

document.querySelectorAll('.quick button').forEach(b => {
  b.onclick = () => {
    currentSection = b.dataset.section;
    loadCards();
  };
});

document.getElementById('openFilters').onclick = () =>
  document.getElementById('filtersPanel').classList.toggle('hidden');

document.getElementById('applyFilters').onclick = loadCards;

loadCards();
