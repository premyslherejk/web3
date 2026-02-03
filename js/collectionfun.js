const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';
const { createClient } = supabase;
const sb = createClient(supabaseUrl, supabaseKey);

let currentLang = 'EN';
let currentSection = 'all';

async function loadCards() {
  let query = sb
    .from('cards')
    .select('*')
    .eq('status', 'Skladem')
    .eq('language', currentLang);

  if (currentSection === 'new') query = query.eq('new', true);
  if (currentSection === 'hot') query = query.eq('hot', true);
  if (currentSection === 'psa') query = query.not('psa_grade', 'is', null);

  const search = document.getElementById('search').value;
  if (search) query = query.ilike('name', `%${search}%`);

  const condition = document.getElementById('condition').value;
  if (condition) query = query.eq('condition', condition);

  const rarity = document.getElementById('rarity').value;
  if (rarity) query = query.eq('rarity', rarity);

  const min = document.getElementById('priceMin').value;
  const max = document.getElementById('priceMax').value;
  if (min) query = query.gte('price', min);
  if (max) query = query.lte('price', max);

  const sort = document.getElementById('sort').value;
  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  if (sort === 'price_desc') query = query.order('price', { ascending: false });
  if (sort === 'name') query = query.order('name');
  if (sort === 'new') query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return console.error(error);

  renderCards(data);
}

function renderCards(cards) {
  const container = document.getElementById('cards');
  container.innerHTML = '';

  cards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'card';
    div.onclick = () => location.href = `card.html?id=${card.id}`;

    div.innerHTML = `
      <div class="badges">
        ${card.new ? '<span class="badge">NEW</span>' : ''}
        ${card.hot ? '<span class="badge">HOT</span>' : ''}
        ${card.psa_grade ? `<span class="badge">PSA ${card.psa_grade}</span>` : ''}
      </div>
      <img src="${card.image_url}">
      <strong>${card.name}</strong>
      <div>${card.price} Kč</div>
    `;

    container.appendChild(div);
  });
}

document.querySelectorAll('.lang-switch button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.lang-switch button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLang = btn.dataset.lang;
    loadCards();
  };
});

document.querySelectorAll('.quick-sections button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.quick-sections button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSection = btn.dataset.section;
    loadCards();
  };
});

document.getElementById('apply').onclick = loadCards;
document.addEventListener('DOMContentLoaded', loadCards);
