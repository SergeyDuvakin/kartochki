'use strict';
const tg = window.Telegram && Telegram.WebApp;
const inTG = !!(tg && tg.initData);
if (tg) { tg.ready(); tg.expand(); try{tg.setHeaderColor('#fff0f6');tg.setBackgroundColor('#fff0f6');}catch(e){} }
const $ = s => document.querySelector(s);
const SHOPS = [
 ['АШАН','#9fd3c7'],['Пятёрочка','#f4a9a8'],['Магнит','#f2b5b8'],['Перекрёсток','#a9cfb0'],['Дикси','#f8c99b'],
 ['SPAR','#b5dcae'],['Лента','#a9bde6'],['ВкусВилл','#bfe3b4'],['Метро','#a7c0e0'],['Летуаль','#d9c8e8'],
 ['Золотое яблоко','#ecd9a8'],['Рив Гош','#d6d1dc'],['Детский мир','#abc8f2'],['Спортмастер','#f3aeb0'],['Леруа Мерлен','#c6e2a6'],
 ['ИКЕА','#a9c7e8'],['Подружка','#f7b8d2'],['Читай-город','#f6c0a4'],['М.Видео','#f2afc2'],['Ozon','#adbff5']];
const PALETTE = ['#f9c5d5','#f4a7b9','#f7b2a6','#f9c9a8','#fbe0a7','#fff1c1','#f4ead5','#e9dcc9','#d9ecc2','#b7dfb9','#a8d5bd','#a6e3d8','#a9d8ea','#bcd6f5','#aec3ee','#c3c4f2','#d4c1ef','#e7c6ef','#f1d3e6','#e3d6de','#d5dde3'];
const FORMATS = [['EAN-13','ean13'],['Code128','code128'],['QRCode','qrcode'],['PDF417','pdf417'],['EAN-8','ean8'],
 ['UPC-A','upca'],['Code39','code39'],['ITF','interleaved2of5'],['DataMatrix','datamatrix'],['Aztec','azteccode'],['Codabar','rationalizedCodabar']];
const FMT_LABEL = {QRCode:'QR',PDF417:'PDF417','EAN-13':'EAN-13'};
const GUESS = [[/auchan|ашан/i,'АШАН'],[/5ka|pyaterochka|пят[её]р/i,'Пятёрочка'],[/magnit|магнит/i,'Магнит'],
 [/perekrestok|x5club|перекр/i,'Перекрёсток'],[/dixy|дикси/i,'Дикси'],[/spar/i,'SPAR'],[/lenta|лента/i,'Лента'],[/vkusvill/i,'ВкусВилл']];
const shopColor = n => (SHOPS.find(s=>s[0].toLowerCase()===String(n).trim().toLowerCase())||[])[1];

/* ---------- storage ---------- */
const CS = inTG && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;
const store = {
  async keys(){ if(CS) return new Promise(r=>CS.getKeys((e,k)=>r(e?[]:k)));
    return Object.keys(localStorage).filter(k=>k.startsWith('c_')); },
  async getMany(keys){ if(!keys.length) return {}; if(CS) return new Promise(r=>CS.getItems(keys,(e,v)=>r(e?{}:v)));
    const o={}; keys.forEach(k=>o[k]=localStorage.getItem(k)); return o; },
  async set(k,v){ if(v.length>4096) throw new Error('Слишком длинное содержимое кода'); if(CS) return new Promise((r,j)=>CS.setItem(k,v,e=>e?j(e):r()));
    localStorage.setItem(k,v); },
  async del(k){ if(CS) return new Promise(r=>CS.removeItem(k,()=>r())); localStorage.removeItem(k); }
};
let dbp; function db(){ return dbp ||= new Promise((r,j)=>{const q=indexedDB.open('kartochki',1);q.onupgradeneeded=()=>q.result.createObjectStore('p');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);}); }
async function photoPut(id,blob){ const d=await db(); return new Promise(r=>{const t=d.transaction('p','readwrite');blob?t.objectStore('p').put(blob,id):t.objectStore('p').delete(id);t.oncomplete=r;}); }
async function photoGet(id){ const d=await db(); return new Promise(r=>{const q=d.transaction('p').objectStore('p').get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);}); }

let cards = [];
const photoURLs = {};
async function load(){ /* returns promise */
  const keys = (await store.keys()).filter(k=>k.startsWith('c_'));
  const vals = await store.getMany(keys);
  cards = keys.map(k=>{try{return JSON.parse(vals[k])}catch(e){return null}}).filter(Boolean);
  for (const c of cards){ const b=await photoGet(c.id); if(b) photoURLs[c.id]=URL.createObjectURL(b); }
  render();
}
const save = c => store.set('c_'+c.id, JSON.stringify(c));
function sorted(){ // manual order once user reordered; otherwise most used first
  const man=localStorage.getItem('manualOrder');
  return [...cards].sort((a,b)=> man ? (a.order||0)-(b.order||0) : ((b.uses||0)-(a.uses||0) || (a.order||0)-(b.order||0))); }

/* ---------- render (wallet stack) ---------- */
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STRIP = 60;           // visible top strip of each stacked card
let list = [], cur = null, els = new Map();
function cardW(){ return $('#stack').clientWidth; }
function cardH(){ return Math.round(cardW()/1.586); }
function cardHTML(c){ return `<div class="sheen"></div><div class="nm">${esc(c.name)}</div>${tailOf(c)}<div class="fmt">${FMT_LABEL[c.format]||c.format}</div>`; }
function tailOf(c){ const d=String(c.display||c.number).replace(/\s/g,''); return /^[A-Za-z]?\d{6,}$/.test(d)?`<div class="tail">•••• ${d.slice(-4)}</div>`:''; }
function isLight(h){ const n=parseInt(h.slice(1),16); return (0.299*(n>>16)+0.587*(n>>8&255)+0.114*(n&255))>150; }
function grad(c){ return `linear-gradient(165deg, ${shade(c,14)} 0%, ${c} 50%, ${shade(c,-12)} 100%)`; }
function shade(hex,p){ let n=parseInt(hex.slice(1),16); const f=v=>Math.max(0,Math.min(255,v+p)); return '#'+((f(n>>16)<<16)|(f(n>>8&255)<<8)|f(n&255)).toString(16).padStart(6,'0'); }
function render(){
  const q = $('#search').value.trim().toLowerCase();
  list = sorted().filter(c=>!q||c.name.toLowerCase().includes(q));
  const st=$('#stack'); $('#empty').classList.toggle('hidden', cards.length>0);
  const keep=new Set(list.map(c=>c.id));
  for(const [id,el] of els) if(!keep.has(id)){ el.remove(); els.delete(id); }
  list.forEach(c=>{ let el=els.get(c.id); if(!el){ el=document.createElement('div'); el.className='card'; bindCard(el,c); st.appendChild(el); els.set(c.id,el); el.style.transform='translate3d(0,40px,0)'; el.style.opacity=0; }
    el._c=c; el.style.background=grad(c.color); el.classList.toggle('dark',isLight(c.color)); el.innerHTML=cardHTML(c); });
  layout();
}
function layout(){ const H=cardH(), st=$('#stack');
  if(cur){ // open: chosen card to top, others slide down to bottom
    const iy = list.findIndex(c=>c.id===cur.id); const bottom = innerHeight - (parseFloat(getComputedStyle(document.body).paddingTop)+4) - 30;
    list.forEach((c,i)=>{ const el=els.get(c.id); el.style.zIndex = c.id===cur.id?100:i;
      el.style.opacity = 1;
      el.style.transform = c.id===cur.id ? 'translate3d(0,0,0)' : `translate3d(0,${bottom + (i<iy?i:i-1)*10}px,0) scale(.94)`; });
    st.style.height=H+'px'; return; }
  list.forEach((c,i)=>{ const el=els.get(c.id); el.style.zIndex=i; el.style.opacity=1; if(el.classList.contains('dragging')) return;
    el.style.transform=`translate3d(0,${i*STRIP}px,0)`; });
  st.style.height = list.length ? ((list.length-1)*STRIP+H)+'px' : '0';
}
addEventListener('resize',layout);
function bindCard(el){ let t, sx, sy, drag=false, held=false, startIdx;
  el.addEventListener('pointerdown',e=>{ if(cur) return; held=false; drag=false; sx=e.clientX; sy=e.clientY; el.setPointerCapture(e.pointerId);
    t=setTimeout(()=>{ held=true; haptic('medium'); el.classList.add('lifted'); },420); });
  el.addEventListener('pointermove',e=>{ const dy=e.clientY-sy, dx=e.clientX-sx;
    if(!held){ if(Math.abs(dx)+Math.abs(dy)>8) clearTimeout(t); return; }
    if(!drag && Math.abs(dy)>6){ drag=true; el.classList.add('dragging'); startIdx=list.indexOf(el._c); }
    if(drag){ el.style.transform=`translate3d(0,${startIdx*STRIP+dy}px,0) scale(1.03)`;
      const ni=Math.max(0,Math.min(list.length-1,Math.round((startIdx*STRIP+dy)/STRIP))), oi=list.indexOf(el._c);
      if(ni!==oi){ list.splice(oi,1); list.splice(ni,0,el._c); haptic('light'); layout(); } } });
  const end=async e=>{ clearTimeout(t); el.classList.remove('lifted');
    if(drag){ el.classList.remove('dragging'); localStorage.setItem('manualOrder','1');
      list.forEach((c,i)=>{ if(c.order!==i){ c.order=i; save(c);} }); layout(); return; }
    if(held){ ctxMenu(e,el._c); return; }
    if(e.type==='pointerup' && !cur && Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)<8) openCard(el._c); };
  el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
function ctxMenu(e,c){ closeCtx(); const m=document.createElement('div'); m.className='ctx';
  m.innerHTML=`<button data-a="edit">Изменить</button><button data-a="del" class="danger">Удалить</button>`;
  m.style.left=Math.min(e.clientX,innerWidth-200)+'px'; m.style.top=Math.min(e.clientY,innerHeight-120)+'px';
  m.onclick=async ev=>{ const a=ev.target.dataset.a; closeCtx(); if(a==='edit') openEditor(c); if(a==='del') delCard(c); };
  document.body.appendChild(m); setTimeout(()=>document.addEventListener('pointerdown',closeCtx,{once:true}),0); }
function closeCtx(){ document.querySelectorAll('.ctx').forEach(x=>x.remove()); }
$('#search').addEventListener('input',render);
$('#searchBtn').onclick=()=>{ document.body.classList.add('searching'); setTimeout(()=>$('#search').focus(),120); };
$('#searchCancel').onclick=()=>{ document.body.classList.remove('searching'); $('#search').value=''; $('#search').blur(); render(); };
$('#moreBtn').onclick=e=>{ closeCtx(); const m=document.createElement('div'); m.className='ctx';
  m.innerHTML=`<button data-a="add">Добавить карту</button><button data-a="auto">Сортировать по частоте</button>`;
  const r=e.currentTarget.getBoundingClientRect(); m.style.right=(innerWidth-r.right)+'px'; m.style.top=(r.bottom+8)+'px'; m.style.transformOrigin='top right';
  m.onclick=ev=>{ const a=ev.target.dataset.a; closeCtx(); if(a==='add') $('#addBtn').click(); if(a==='auto'){ localStorage.removeItem('manualOrder'); render(); toast('Частые карты — наверху'); } };
  document.body.appendChild(m); setTimeout(()=>document.addEventListener('pointerdown',ev=>{ if(!m.contains(ev.target)) closeCtx(); },{once:true}),0); };

/* ---------- open card ---------- */
function drawCode(canvas,c){ const bcid=(FORMATS.find(f=>f[0]===c.format)||[0,'code128'])[1];
  const opts={bcid,text:String(c.number),scale:4,includetext:false,backgroundcolor:'FFFFFF'};
  if(bcid==='pdf417') opts.scale=3; if(!['qrcode','datamatrix','azteccode','pdf417'].includes(bcid)) opts.height=24;
  try{ bwipjs.toCanvas(canvas,opts); }catch(e){ try{bwipjs.toCanvas(canvas,{...opts,bcid:'code128'});}catch(_){} }
  const sq=['qrcode','datamatrix','azteccode'].includes(bcid); canvas.style.width = sq?'62%':'100%'; canvas.parentElement.classList.toggle('sq',sq); }
function prettyNum(c){ let n=String(c.display||'').trim(); if(!n){ n=String(c.number); if(n.length>24) return ''; }
  return /^\d{8,}$/.test(n) ? n.replace(/(\d{4})(?=\d)/g,'$1 ') : n; }
let openedAt=0;
function openCard(c){ cur=c; openedAt=Date.now(); haptic('light'); closeCtx(); 
  const st=$('#stack'), topNow=st.getBoundingClientRect().top+scrollY, want=parseFloat(getComputedStyle(document.body).paddingTop)+4;
  const lift=want-topNow; st.style.setProperty('--lift',lift+'px'); scrollTo(0,0);
  document.body.classList.add('is-open'); layout();
  const el=els.get(c.id); el.classList.remove('shine'); void el.offsetWidth; el.classList.add('shine');
  drawCode($('#vCode'),c); const n=prettyNum(c); $('#vNum').textContent=n; $('#numRow').classList.toggle('hidden',!n);
  const v=$('#viewer'); v.style.top = (want + cardH() + 18)+'px'; v.classList.remove('hidden');
  c.uses=(c.uses||0)+1; c.last=Date.now(); save(c); setBright(true); try{tg&&tg.BackButton.show();}catch(e){} }
function closeViewer(){ if(!cur) return; cur=null; document.body.classList.remove('is-open'); $('#viewer').classList.add('hidden'); setBright(false); try{tg&&tg.BackButton.hide();}catch(e){} layout(); }
function setBright(on){ try{ if(tg && tg.isVersionAtLeast('8.0') && tg.setBrightness) tg.setBrightness(on?1:-1); }catch(e){} }
document.addEventListener('click',e=>{ if(!cur||Date.now()-openedAt<400) return; if(e.target.closest('#viewer,.sheet-wrap,.ctx')) return;
  if(e.target.closest('.card')||e.target===document.body||e.target.closest('.stack')||e.target===document.documentElement) closeViewer(); });
if(tg&&tg.BackButton) tg.BackButton.onClick(()=>closeViewer());
(()=>{ let y0=null, el=null; document.addEventListener('pointerdown',e=>{ if(!cur) return; const c=e.target.closest('.card'); if(c&&c._c.id===cur.id){ y0=e.clientY; el=c; } });
  document.addEventListener('pointermove',e=>{ if(y0==null) return; const dy=Math.max(0,e.clientY-y0); el.style.transition='none'; el.style.transform=`translate3d(0,${dy*.6}px,0)`; });
  document.addEventListener('pointerup',e=>{ if(y0==null) return; const dy=e.clientY-y0; el.style.transition=''; y0=null; if(dy>70){ openedAt=0; closeViewer(); } else layout(); }); })();

$('#copyBtn').onclick=async()=>{ try{await navigator.clipboard.writeText(String(cur.display||cur.number).replace(/\s/g,''));toast('Номер скопирован');}catch(e){toast('Не удалось скопировать');} };
$('#editBtn').onclick=()=>{ const c=cur; closeViewer(); openEditor(c); };
$('#delBtn').onclick=()=>delCard(cur);
async function delCard(c){ const ok = await confirmBox(`Удалить «${c.name}»?`); if(!ok) return;
  await store.del('c_'+c.id); await photoPut(c.id,null); cards=cards.filter(x=>x.id!==c.id); closeViewer(); render(); toast('Карта удалена'); }
function confirmBox(t){ return new Promise(r=>{ if(inTG && tg.showConfirm) tg.showConfirm(t,r); else r(confirm(t)); }); }

/* ---------- add ---------- */
$('#addBtn').onclick=()=>{ $('#addMenu').classList.remove('hidden'); haptic('light'); };
$('#addMenu .backdrop').onclick=()=>$('#addMenu').classList.add('hidden');
$('#addMenu').addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(!b) return; $('#addMenu').classList.add('hidden');
  if(b.dataset.act==='cancel') return; if(b.dataset.act==='gallery') $('#fileIn').click(); if(b.dataset.act==='camera') startCam(); if(b.dataset.act==='manual') openEditor(null,{}); });
$('#fileIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(f) await fromImage(f); };

async function decode(src){ // src: Blob or ImageData
  const r = await ZXingWASM.readBarcodes(src,{tryHarder:true,maxNumberOfSymbols:1});
  const b = r.find(x=>x.isValid && x.text); return b ? {text:b.text, format:normFmt(b.format)} : null; }
function normFmt(f){ return ({'QR Code':'QRCode','QRCode':'QRCode','EAN-13':'EAN-13','EAN13':'EAN-13'}[f]) || f; }
async function fromImage(file){ toast('Распознаю…');
  const blob = await compress(file); let res=null;
  try{ res = await decode(file); }catch(e){ console.warn(e); }
  const color = await dominant(blob);
  openEditor(null,{number:res?.text||'',format:res?.format||'EAN-13',color,photo:blob,
    name:guess(res?.text||''), display:/^\d{8,14}$/.test(res?.text||'')?res.text:'', msg: res?`Код ${FMT_LABEL[res.format]||res.format} распознан`:'Код не нашёлся — введи номер вручную'});
}
function guess(t){ for(const [re,n] of GUESS) if(re.test(t)) return n; return ''; }
async function compress(file,max=900){ const img=await createImageBitmap(file); const k=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas'); c.width=img.width*k; c.height=img.height*k; c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/jpeg',.75)); }
async function dominant(blob){ // most saturated common hue bucket
  const img=await createImageBitmap(blob); const c=document.createElement('canvas'); c.width=48;c.height=48; const x=c.getContext('2d'); x.drawImage(img,0,0,48,48);
  const d=x.getImageData(0,0,48,48).data, buckets={};
  for(let i=0;i<d.length;i+=4){ const [r,g,b]=[d[i],d[i+1],d[i+2]], mx=Math.max(r,g,b), mn=Math.min(r,g,b); const s=mx?(mx-mn)/mx:0;
    if(s<.35||mx<60) continue; const k=(r>>5)+','+(g>>5)+','+(b>>5); (buckets[k] ||= {n:0,r:0,g:0,b:0}); const o=buckets[k]; o.n++;o.r+=r;o.g+=g;o.b+=b; }
  const best=Object.values(buckets).sort((a,b)=>b.n-a.n)[0]; if(!best||best.n<8) return null;
  return '#'+[best.r,best.g,best.b].map(v=>Math.round(v/best.n).toString(16).padStart(2,'0')).join(''); }

/* camera */
let stream, camLoop;
async function startCam(){ try{ stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1920}}}); }
  catch(e){ toast('Нет доступа к камере — выбери фото из галереи'); return; }
  $('#cam').classList.remove('hidden'); const v=$('#video'); v.srcObject=stream; await v.play();
  const c=document.createElement('canvas'), x=c.getContext('2d',{willReadFrequently:true}); let busy=false;
  camLoop=setInterval(async()=>{ if(busy||!v.videoWidth) return; busy=true; c.width=v.videoWidth; c.height=v.videoHeight; x.drawImage(v,0,0);
    try{ const r=await decode(x.getImageData(0,0,c.width,c.height)); if(r){ haptic('success'); const photo=await new Promise(z=>c.toBlob(z,'image/jpeg',.8)); stopCam();
      const p=await compress(photo); openEditor(null,{number:r.text,format:r.format,photo:p,color:await dominant(p),name:guess(r.text),msg:`Код ${FMT_LABEL[r.format]||r.format} распознан`}); } }catch(e){}
    busy=false; },350); }
function stopCam(){ clearInterval(camLoop); stream&&stream.getTracks().forEach(t=>t.stop()); $('#cam').classList.add('hidden'); }
$('#camClose').onclick=stopCam;

/* editor */
let edit=null, draft={};
$('#shops').innerHTML=SHOPS.map(s=>`<option value="${s[0]}">`).join('');
$('#fFmt').innerHTML=FORMATS.map(f=>`<option value="${f[0]}">${FMT_LABEL[f[0]]||f[0]}</option>`).join('');
function openEditor(card,d={}){ edit=card; draft={...d, color:card?.color||d.color||shopColor(d.name)||PALETTE[0]};
  $('#edTitle').textContent=card?'Изменить карту':'Новая карта';
  $('#fName').value=card?.name??d.name??''; $('#fNum').value=card?.number??d.number??''; $('#fDisp').value=card?.display??d.display??''; $('#fFmt').value=card?.format??d.format??'EAN-13';
  $('#edMsg').textContent=d.msg||''; drawColors(); preview(); $('#editor').classList.remove('hidden'); }
function drawColors(){ const cols=[...new Set([...PALETTE,draft.color].filter(Boolean))];
  $('#colors').innerHTML=cols.map(c=>`<button type="button" style="background:${c}" data-c="${c}" class="${c===draft.color?'on':''} ${isLight(c)?'lt':''}" aria-label="Цвет ${c}"></button>`).join(''); }
$('#colors').onclick=e=>{ const c=e.target.dataset.c; if(c){draft.color=c;drawColors();preview();} };
$('#fName').oninput=()=>{ const sc=shopColor($('#fName').value); if(sc){draft.color=sc;drawColors();} preview(); };
$('#fNum').oninput=()=>{ if($('#fNum').value.replace(/\D/g,'').length===13 && !edit && $('#fFmt').value==='Code128') $('#fFmt').value='EAN-13'; };
function preview(){ const p=$('#edPreview'); p.style.background=grad(draft.color); p.classList.toggle('dark',isLight(draft.color)); p.innerHTML=`<div class="nm">${esc($('#fName').value||'Название')}</div>`; }
$('#edCancel').onclick=()=>$('#editor').classList.add('hidden');
$('#editor .backdrop').onclick=()=>$('#editor').classList.add('hidden');
$('#form').onsubmit=async e=>{ e.preventDefault();
  let fmt=$('#fFmt').value, num=$('#fNum').value.trim();
  if(fmt==='EAN-13' && !/^\d{12,13}$/.test(num.replace(/\s/g,''))) fmt='Code128'; else if(fmt==='EAN-13') num=num.replace(/\s/g,'');
  const c = edit || {id:Date.now().toString(36)+Math.random().toString(36).slice(2,6), order:cards.length, uses:0};
  Object.assign(c,{name:$('#fName').value.trim(),number:num,format:fmt,color:draft.color,display:$('#fDisp').value.trim()||(/^\d{8,14}$/.test(num)?num:'')});
  try{ await save(c); }catch(err){ $('#edMsg').textContent=err.message; return; }
  if(draft.photo){ await photoPut(c.id,draft.photo); photoURLs[c.id]=URL.createObjectURL(draft.photo); }
  if(!edit) cards.push(c);
  $('#editor').classList.add('hidden'); render(); haptic('success'); };

/* misc */
function haptic(t){ try{ const h=tg&&tg.HapticFeedback; if(!h) return; t==='success'?h.notificationOccurred('success'):h.impactOccurred(t); }catch(e){} }
let tt; function toast(t){ const e=$('#toast'); e.textContent=t; e.classList.add('on'); clearTimeout(tt); tt=setTimeout(()=>e.classList.remove('on'),1800); }
window.__app={decode,cards:()=>cards};
async function seed(){ // optional seed.js: runs once, only when empty & not seeded
  const f=(await store.getMany(['seeded'])).seeded; if(f||cards.length) return;
  await new Promise(r=>{const s=document.createElement('script');s.src='seed.js';s.onload=r;s.onerror=r;document.head.appendChild(s);});
  if(!window.SEED) return;
  for(const [i,d] of window.SEED.entries()){ const c={id:'seed'+i,order:i,uses:0,name:d.name,number:d.number,format:d.format,color:d.color,display:d.display||''};
    await save(c); cards.push(c);
    try{ const b=await compress(await (await fetch(d.photo)).blob()); await photoPut(c.id,b); photoURLs[c.id]=URL.createObjectURL(b);}catch(e){} }
  await store.set('seeded','1'); render(); }
load().then(seed);
