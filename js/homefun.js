const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = supabase.createClient(supabaseUrl, supabaseKey);

function shuffle(arr){
  return [...arr].sort(() => Math.random() - 0.5);
}

async function loadHotOffers(){
  if (!window.OfferUI || typeof window.OfferUI.renderCards !== 'function'){
    console.error('❌ OfferUI není načteno – zkontroluj pořadí scriptů');
    return;
  }

  const { data, error } = await sb
    .from('cards')
    .select('id,name,price,image_url,status,condition,psa_grade')
    .eq('hot', true)
    .neq('status', 'Prodáno');

  if (error){
    console.error('Chyba při načítání hot karet:', error);
    return;
  }

  const container = document.getElementById('hot-cards');
  if (!container) return;

  const picked = shuffle(data || []).slice(0, 4);

  // ✅ JEDINÉ místo, kde se renderuje
  window.OfferUI.renderCards(container, picked);
}

document.addEventListener('DOMContentLoaded', loadHotOffers);
