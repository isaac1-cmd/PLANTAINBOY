const $=s=>document.querySelector(s);
const naira=n=>'₦'+Number(n).toLocaleString('en-NG');
let EVENT_DATE=new Date('2026-12-27T12:00:00+01:00'),TIERS=[],cur=null,qty=1;

// marquee
$('#marq').innerHTML=Array(16).fill('<span>PLANTAIN BOY EXPERIENCE</span><span>27 DEC</span><span>&bull;</span>').join('');
$('#yr').textContent=new Date().getFullYear();
$('#burger').onclick=()=>$('#links').classList.toggle('on');
document.querySelectorAll('#links a').forEach(a=>a.onclick=()=>$('#links').classList.remove('on'));

// countdown
function tick(){
  let d=Math.max(0,EVENT_DATE-new Date());
  const p=n=>String(n).padStart(2,'0');
  $('#cd').textContent=p(Math.floor(d/864e5));$('#ch').textContent=p(Math.floor(d/36e5%24));
  $('#cm').textContent=p(Math.floor(d/6e4%60));$('#cs').textContent=p(Math.floor(d/1e3%60));
}
setInterval(tick,1000);tick();

// tickets from the server (prices live only on the server)
fetch('/api/tiers').then(r=>r.json()).then(({event,tiers})=>{
  TIERS=tiers;EVENT_DATE=new Date(event.date);tick();
  $('#venueTag').textContent=event.venue;
  $('#tgrid').innerHTML=tiers.map(t=>`
    <div class="tick ${t.id==='regular'?'hot':''} reveal">
      <span class="tag">${t.tag}</span><h3>${t.name}</h3><div class="price">${naira(t.price)}</div>
      <ul>${t.perks.map(p=>`<li>${p}</li>`).join('')}</ul>
      <button class="btn" data-id="${t.id}">Buy ${t.name}</button>
    </div>`).join('');
  document.querySelectorAll('#tgrid .btn').forEach(b=>b.onclick=()=>openModal(b.dataset.id));
  observe();
}).catch(()=>{$('#tgrid').innerHTML='<p>Could not load tickets. Please refresh.</p>'});

// checkout modal
function upd(){$('#qv').textContent=qty;$('#mTier').textContent=`${cur.name} × ${qty}`;$('#mTotal').textContent=naira(cur.price*qty)}
function openModal(id){cur=TIERS.find(t=>t.id===id);qty=1;upd();$('#cmsg').textContent='';$('#modal').classList.add('on')}
$('#close').onclick=()=>$('#modal').classList.remove('on');
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.remove('on')};
$('#minus').onclick=()=>{if(qty>1){qty--;upd()}};
$('#plus').onclick=()=>{if(qty<10){qty++;upd()}};
$('#cform').onsubmit=async e=>{
  e.preventDefault();const b=$('#pay'),m=$('#cmsg');
  b.disabled=true;b.textContent='Redirecting to Paystack…';m.className='msg';m.textContent='';
  try{
    const f=Object.fromEntries(new FormData(e.target));
    const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,tier:cur.id,qty})});
    const j=await r.json();if(!r.ok)throw new Error(j.error);
    location.href=j.url;
  }catch(err){m.className='msg err';m.textContent=err.message||'Something went wrong';b.disabled=false;b.textContent='Pay with Paystack'}
};

// vendor form
$('#vform').onsubmit=async e=>{
  e.preventDefault();const m=$('#vmsg');m.className='msg';m.textContent='Sending…';
  try{
    const r=await fetch('/api/vendor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});
    const j=await r.json();if(!r.ok)throw new Error(j.error);
    m.className='msg ok';m.textContent='Thank you! We\'ll be in touch soon.';e.target.reset();
  }catch(err){m.className='msg err';m.textContent=err.message}
};

// scroll reveal
let io;function observe(){io=io||new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.12});document.querySelectorAll('.reveal:not(.in)').forEach(el=>io.observe(el))}
observe();
