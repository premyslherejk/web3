const supabaseUrl = 'https://hwjbfrhbgeczukcjkmca.supabase.co';
const supabaseKey = 'TVŮJ_KLÍČ';
const sb = supabase.createClient(supabaseUrl, supabaseKey);

const id = new URLSearchParams(window.location.search).get('id');
if (!id) throw new Error('Chybí ID');

const thumbsWrap = document.getElementById('thumbs');
const mainImg = document.getElementById('current');
const light = document.getElementById('lightbox');
const lightImg = document.getElementById('lightImg');

const nameEl = document.getElementById('name');
const descEl = document.getElementById('description');
const priceEl = document.getElementById('price');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('status');
const psaEl = document.getElementById('psa');
const minOrderEl = document.getElementById('minOrder');
const addBtn = document.querySelector('.add');

let images = [];
let index = 0;
let currentCard = null;

function getCart(){
  return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart){
  localStorage.setItem('cart', JSON.stringify(cart));
}

function getCartTotal(){
  return getCart().reduce((s,i)=>s+Number(i.price||0),0);
}

async function loadCard(){
  const {data:card} = await sb.from('cards').select('*').eq('id',id).single();
  currentCard = card;

  nameEl.textContent = card.name;
  descEl.textContent = card.description;
  priceEl.textContent = `${card.price} Kč`;
  metaEl.textContent = `Edice: ${card.set || '—'}`;
  statusEl.textContent = card.status || 'Skladem';

  if(card.psa_grade){
    psaEl.textContent = `PSA ${card.psa_grade}`;
    psaEl.style.display = 'inline-flex';
  }

  images = card.real_images
    ? card.real_images.split(',').map(i=>i.trim())
    : [card.image_url];

  renderImages();
  syncAddButton();
}

function syncAddButton(){
  const cart = getCart();
  const exists = cart.find(i=>i.id===currentCard.id);
  const total = getCartTotal();

  if(exists){
    addBtn.textContent = 'Přidáno ✓';
    addBtn.disabled = true;
    addBtn.classList.add('added');
  }else{
    addBtn.textContent = 'Přidat do košíku';
    addBtn.disabled = false;
    addBtn.classList.remove('added');
  }

  if(currentCard.price < 100 && total < 99){
    minOrderEl.style.display = 'block';
  }else{
    minOrderEl.style.display = 'none';
  }
}

addBtn.onclick = ()=>{
  const cart = getCart();
  if(cart.find(i=>i.id===currentCard.id)) return;
  cart.push({
    id:currentCard.id,
    name:currentCard.name,
    price:currentCard.price,
    image:currentCard.image_url
  });
  saveCart(cart);
  document.dispatchEvent(new Event('cartUpdated'));
  syncAddButton();
};

function renderImages(){
  thumbsWrap.innerHTML='';
  mainImg.src=images[0];

  images.forEach((src,i)=>{
    const img=document.createElement('img');
    img.src=src;
    if(i===0) img.classList.add('active');
    img.onclick=()=>setImage(i);
    thumbsWrap.appendChild(img);
  });
}

function setImage(i){
  index=i;
  mainImg.src=images[i];
  [...thumbsWrap.children].forEach(e=>e.classList.remove('active'));
  thumbsWrap.children[i].classList.add('active');
}

document.getElementById('mainImage').onclick=()=>{
  lightImg.src=images[index];
  light.classList.add('active');
};

document.getElementById('close').onclick=()=>light.classList.remove('active');

loadCard();
