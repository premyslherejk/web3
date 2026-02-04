const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3amJmcmhiZ2VjenVrY2prbWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDU5MjQsImV4cCI6MjA4NTAyMTkyNH0.BlgIov7kFq2EUW17hLs6o1YujL1i9elD7wILJP6h-lQ';

const sb = supabase.createClient(supabaseUrl, supabaseKey);

function shuffle(arr){
  return [...arr].sort(() => Math.random() - 0.5);
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function waitForOfferUI(timeoutMs = 2000){
  const start = Date.now();
  while (Date.now() - start < timeoutMs){
    if (window.OfferUI && typeof window.OfferUI.renderCards === 'function') return true;
    await sleep(50);
  }
  return false;
}

async function loadHotOffers(){
  const container = document.getElementById('hot-cards');
  if (!container) return;

  // počkej na OfferUI (kdyby se načítalo pomaleji)
  const ok = await waitForOfferUI(2000);
  if (!ok){
    console.error('❌ OfferUI není načteno. Nejčastěji: špatná cesta js/offerfun.js nebo 404.');
    container.innerHTML = `<p style="opacity:.7">Chybí renderer karet (OfferUI). Mrkni do Console/Network 😕</p>`;
    return;
  }

  const { data, error } = await sb
    .from('cards')
    .select('id,name,price,image_url,status,condition,psa_grade')
    .eq('hot', true)
    .neq('status', 'Prodáno');

  if (error){
    console.error('Chyba při načítání hot karet:', error);
    container.innerHTML = `<p style="opacity:.7">Chyba při načítání karet 😕</p>`;
    return;
  }

  const picked = shuffle(data || []).slice(0, 4);
  OfferUI.renderCardsInto(container, picked, { size: 'md' });
}

document.addEventListener('DOMContentLoaded', loadHotOffers);

