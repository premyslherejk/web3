// SUPABASE
const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub25uIiwiZXhwIjoxNzY5NDU5MjQwfQ.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';
const sb = supabase.createClient(supabaseUrl, supabaseKey);

async function loadHotOffers(){
  const { data, error } = await sb
    .from('cards')
    .select('id,name,price,image_url,status')
    .eq('status','Skladem')
    .eq('hot', true)  // tady je změna
    .limit(4);

  if(error){
    console.error('Chyba při načítání karet:', error);
    return;
  }

  const container = document.getElementById('hot-cards');
  container.innerHTML = '';

  data.forEach(card => {
    const div = document.createElement('div');
    div.className = 'hot-card';
    div.onclick = () => window.location.href = `card.html?id=${card.id}`;

    div.innerHTML = `
      <div class="tag">${card.status}</div>
      <img src="${card.image_url}" alt="${card.name}">
      <div class="info">
        <h3>${card.name}</h3>
        <p>Cena: ${card.price} Kč</p>
      </div>
    `;
    container.appendChild(div);
  });
}

document.addEventListener('DOMContentLoaded', loadHotOffers);
