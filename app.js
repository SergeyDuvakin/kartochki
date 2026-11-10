'use strict';
const APP_V = 20;
// Review build: «Праздник» stays on. Set NY_FORCE to false to follow the device date only (15 Dec–15 Jan, inclusive).
const NY_FORCE = true;
function nyInSeason(date){ const m=date.getMonth(), d=date.getDate(); return (m===11 && d>=15) || (m===0 && d<=15); }
const NY = NY_FORCE || nyInSeason(new Date());
if(NY) document.documentElement.classList.add('ny');
fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>{ if(j.v>APP_V){ const u=new URL(location.href); if(u.searchParams.get('v')!==String(j.v)){ u.searchParams.set('v',j.v); location.replace(u.toString()); } } }).catch(()=>{});
const tg = window.Telegram && Telegram.WebApp;
const inTG = !!(tg && tg.initData);
if (tg) { tg.ready(); tg.expand(); try{ if(tg.isVersionAtLeast&&tg.isVersionAtLeast('7.7')&&tg.disableVerticalSwipes) tg.disableVerticalSwipes(); }catch(e){} try{tg.setHeaderColor('#fff0f6');tg.setBackgroundColor('#fff0f6');}catch(e){} }
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
const csCall = (fn,fb,ms=6000) => new Promise(r=>{ let done=false; const t=setTimeout(()=>{ if(!done){done=true;r(fb);} },ms);
  try{ fn((e,v)=>{ if(done) return; done=true; clearTimeout(t); r(e?fb:v); }); }catch(_){ done=true; clearTimeout(t); r(fb); } });
const store = {
  async keys(){ if(CS) return csCall(cb=>CS.getKeys(cb),null);
    return Object.keys(localStorage).filter(k=>k.startsWith('c_')); },
  async getMany(keys){ if(!keys.length) return {}; if(CS) return csCall(cb=>CS.getItems(keys,cb),null);
    const o={}; keys.forEach(k=>o[k]=localStorage.getItem(k)); return o; },
  async set(k,v){ if(v.length>4096) throw new Error('Слишком длинное содержимое кода'); if(CS){ const ok=await csCall(cb=>CS.setItem(k,v,cb),'__fail'); pend(k,ok==='__fail'?'set':null); return; }
    localStorage.setItem(k,v); },
  async del(k){ if(CS){ const ok=await csCall(cb=>CS.removeItem(k,cb),'__fail'); pend(k,ok==='__fail'?'del':null); return; } localStorage.removeItem(k); }
};
// offline writes that CloudStorage did not confirm: retried on the next online sync
function pendMap(){ try{ return JSON.parse(localStorage.getItem('pending')||'{}'); }catch(e){ return {}; } }
function pend(k,op){ const m=pendMap(); if(op) m[k]=op; else delete m[k]; try{ Object.keys(m).length?localStorage.setItem('pending',JSON.stringify(m)):localStorage.removeItem('pending'); }catch(e){} }
async function flushPending(){ const m=pendMap(); for(const [k,op] of Object.entries(m)){
  if(op==='del') await store.del(k); else { const c=cards.find(x=>'c_'+x.id===k); if(c) await store.set(k,JSON.stringify(c)); else pend(k,null); } }
  return !Object.keys(pendMap()).length; }
let dbp; function db(){ return dbp ||= new Promise((r,j)=>{const q=indexedDB.open('kartochki',1);q.onupgradeneeded=()=>q.result.createObjectStore('p');q.onsuccess=()=>{ const d=q.result; d.onclose=()=>{ dbp=null; }; r(d); }; q.onerror=()=>{ dbp=null; j(q.error); }; }); }
function resetStore(){ dbp=null; }
function idbTx(d,fn){ return new Promise(r=>{ try{ const t=d.transaction('p','readwrite'); fn(t.objectStore('p')); t.oncomplete=()=>r(true); t.onerror=t.onabort=()=>r(false); }catch(e){ r(false); } }); }
async function photoPut(id,blob){ try{ const d=await db(); // never hang: some WebViews refuse Blobs in IndexedDB -> store raw bytes instead
  if(!blob) return idbTx(d,s=>s.delete(id));
  if(await idbTx(d,s=>s.put(blob,id))) return true;
  const buf=await blob.arrayBuffer(); return idbTx(d,s=>s.put({buf,type:blob.type||'image/jpeg'},id)); }catch(e){ return false; } }
async function photoGet(id){ try{ const d=await db(); const v=await new Promise(r=>{const q=d.transaction('p').objectStore('p').get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);}); return v&&v.buf?new Blob([v.buf],{type:v.type}):v; }catch(e){ return null; } }
// decorative background is a different key from the scan photo (camera/gallery), so they never overwrite each other
function bgKey(id){ return 'bg:'+id; }
async function bgPut(id, blob){ if(blob) delete bgMiss[id]; return photoPut(bgKey(id), blob); }
async function bgGet(id){ return photoGet(bgKey(id)); }

let cards = [];
const photoURLs = {};
const bgURLs = {};
const bgMiss = {};
function readMirror(){ try{ return JSON.parse(localStorage.getItem('mirror')||'null'); }catch(e){ return null; } }
const SEED_V=2;
function seedCards(){ return (window.SEED||[]).map((d,i)=>({id:'seed'+i,order:i,uses:0,name:d.name,number:d.number,format:d.format,color:d.color,display:d.display||''})); }
function boot(){ // synchronous first paint: mirror -> seed -> skeleton
  const m=readMirror();
  if(m&&m.length){ cards=m; }
  else if(!localStorage.getItem('seeded') && window.SEED){ cards=seedCards(); }
  if(cards.length) render(); else if(CS) document.body.classList.add('loading'); else render();
}
async function reconcile(){ // background sync with CloudStorage, no flicker
  if(CS && localStorage.getItem('pending') && !(await flushPending())){ document.body.classList.remove('loading'); render(); return; } // still offline: local mirror wins
  const keys=await store.keys(); if(!keys){ document.body.classList.remove('loading'); render(); return; } // offline / no answer: keep local mirror
  const ck=keys.filter(k=>k.startsWith('c_'));
  const vals=await store.getMany([...ck,'seeded','seedV']); if(!vals){ document.body.classList.remove('loading'); render(); return; }
  let remote=ck.map(k=>{try{return JSON.parse(vals[k])}catch(e){return null}}).filter(Boolean);
  if(!vals.seeded && window.SEED){ // first launch anywhere: push seed to cloud
    const have=new Set(remote.map(c=>c.id));
    const add=seedCards().filter(c=>!have.has(c.id)).map(c=>cards.find(x=>x.id===c.id)||c);
    await Promise.all(add.map(save)); remote.push(...add);
    await store.set('seeded','1'); await store.set('seedV',String(SEED_V)); vals.seedV=String(SEED_V);
  }
  if(window.SEED && +(vals.seedV||1)<SEED_V){ // later-added preset cards: once, never duplicate or bring back a deleted one
    const have=new Set(remote.map(c=>c.id)), nums=new Set(remote.map(c=>String(c.number).replace(/\s/g,'')));
    const add=seedCards().filter((c,i)=>(window.SEED[i].since||1)>+(vals.seedV||1) && !have.has(c.id) && !nums.has(String(c.number)));
    add.forEach(c=>{ c.order=remote.length+add.indexOf(c); c.upd=Date.now(); });
    await Promise.all(add.map(save)); remote.push(...add); await store.set('seedV',String(SEED_V));
  }
  localStorage.setItem('seeded','1');
  document.body.classList.remove('loading');
  const meta=c=>[c.id,c.name,c.number,c.color,c.order,c.display,c.format,!!c.pin,c.bg?1:0,c.crop?[c.crop.s,c.crop.x,c.crop.y]:0,c.bw||0,c.bh||0,c.tone||''];
  if(JSON.stringify(remote.map(meta).sort())!==JSON.stringify(cards.map(meta).sort())||!cards.length){ cards=remote; }
  render();
}
const save = c => store.set('c_'+c.id, JSON.stringify(c));
function sorted(){ // manual order once user reordered; otherwise most used first
  const man=localStorage.getItem('manualOrder');
  return [...cards].sort((a,b)=> (b.pin?1:0)-(a.pin?1:0) || (man ? (a.order||0)-(b.order||0) : ((b.uses||0)-(a.uses||0) || (a.order||0)-(b.order||0)))); }

/* ---------- render (wallet stack) ---------- */
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STRIP = 60;           // visible top strip of each stacked card
let list = [], cur = null, els = new Map(), spread = 0, activeEnd = null;
for(const ev of ['pointerup','pointercancel']) document.addEventListener(ev,e=>{ if(activeEnd) setTimeout(()=>activeEnd&&activeEnd(e),0); },true);
function cardW(){ return $('#stack').clientWidth; }
function cardH(){ return Math.round(($('.top').clientWidth||cardW())/1.586); }
function hash(s){ let h=2166136261; for(const ch of String(s)) h=Math.imul(h^ch.charCodeAt(0),16777619); return h>>>0; }
function twinkles(id){ let h=hash(id), o='';
  if(NY){ const kind=['sparkle-white','sparkle-gold'];
    for(let i=0;i<2;i++){ h=Math.imul(h^(h>>>15),2246822507)>>>0;
      const x=24+h%52, y=46+(h>>>8)%36, s=8+(h>>>16)%4, d=8+(h>>>20)%3, dl=1+(h>>>24)%10;
      o+=`<img class="tw ny-spark" alt="" draggable="false" src="assets/ny/${kind[i]}.svg?v=20" style="left:${x}%;top:${y}%;--s:${s}px;--d:${d}s;--dl:${dl}s">`; }
    return o; }
  for(let i=0;i<3;i++){ h=Math.imul(h^(h>>>15),2246822507)>>>0;
  const x=8+h%84, y=12+(h>>>8)%70, s=5+(h>>>16)%5, d=4+(h>>>20)%4, dl=(h>>>24)%50/10;
  o+=`<i class="tw" style="left:${x}%;top:${y}%;--s:${s}px;--d:${d}s;--dl:${dl}s"></i>`; } return o; }
function snowCap(id){ if(!NY) return '';
  const k='abcd'[hash(id||'x')%4];
  return `<img class="snowcap" data-cap="${k}" alt="" draggable="false" src="assets/ny/snow-cap-${k}.svg?v=20">`; }
function syncCap(el, tall){ const img=el.querySelector('.snowcap'); if(!img) return; const k=img.dataset.cap; if(!k) return;
  const want=`assets/ny/snow-cap-${k}${tall?'-tall':''}.svg?v=20`; if(img.getAttribute('src')!==want) img.setAttribute('src', want); }
function initial(name){ const s=String(name||'').trim(); return s?[...s][0].toUpperCase():'•'; }
function faceHTML(v, has){
  const name=esc(v.name||'');
  const bg=has?`<div class="bgclip"><img class="bg" alt="" draggable="false" src="${v.url}" style="${bgStyle(v.crop,v.w,v.h)}"></div>`:'';
  const head=has?`<div class="brand"><span class="logo">${esc(initial(v.name))}</span><div class="nm">${name}</div></div><i class="hole" aria-hidden="true"></i><i class="charm" aria-hidden="true"></i>`:`<div class="nm">${name}</div>`;
  return `${bg}${snowCap(v.id)}${twinkles(v.id||'x')}<div class="sheen"></div>${head}${tailOf(v)}<div class="fmt">${esc(FMT_LABEL[v.format]||v.format||'')}</div>`;
}
function mountCard(el, v){
  const has=!!(v.mode==='image' && v.url), color=v.color||PALETTE[0];
  el.style.background=grad(color);
  el.classList.toggle('has-bg', has);
  el.classList.toggle('dark', has ? v.tone!=='dark' : isLight(color));
  if(has) delete el.dataset.fell;
  el.innerHTML=faceHTML(v, has);
  const img=el.querySelector('img.bg');
  if(img) img.addEventListener('error', ()=>{ if(el.dataset.fell) return; el.dataset.fell='1'; mountCard(el,{...v,mode:'color',url:''}); }, {once:true});
}
function cardView(c){ const url=c.bg&&bgURLs[c.id]; return {id:c.id,name:c.name,number:c.number,display:c.display,format:c.format,color:c.color,mode:url?'image':'color',url:url||'',crop:c.crop,w:c.bw,h:c.bh,tone:c.tone}; }
function paintThumb(el, v){
  const has=v.mode==='image' && v.url;
  el.style.background=has?'#e7e2e4':grad(v.color||PALETTE[0]);
  el.innerHTML=has?`<img alt="" draggable="false" src="${v.url}" style="${bgStyle(v.crop,v.w,v.h)}">`:'';
}
function tailOf(c){ const d=String(c.display||c.number).replace(/\s/g,''); return /^[A-Za-z]?\d{6,}$/.test(d)?`<div class="tail">•••• ${d.slice(-4)}</div>`:''; }
function isLight(h){ const n=parseInt(h.slice(1),16); return (0.299*(n>>16)+0.587*(n>>8&255)+0.114*(n&255))>150; }
function grad(c){ return `linear-gradient(165deg, ${shade(c,14)} 0%, ${c} 50%, ${shade(c,-12)} 100%)`; }
function shade(hex,p){ let n=parseInt(hex.slice(1),16); const f=v=>Math.max(0,Math.min(255,v+p)); return '#'+((f(n>>16)<<16)|(f(n>>8&255)<<8)|f(n&255)).toString(16).padStart(6,'0'); }
function render(){
  const q = $('#search').value.trim().toLowerCase();
  list = sorted().filter(c=>!q||c.name.toLowerCase().includes(q));
  try{ localStorage.setItem('mirror',JSON.stringify(cards)); }catch(e){}
  const st=$('#stack'); $('#empty').classList.toggle('hidden', cards.length>0 || document.body.classList.contains('loading'));
  const keep=new Set(list.map(c=>c.id));
  for(const [id,el] of els) if(!keep.has(id)){ el.remove(); els.delete(id); }
  list.forEach(c=>{ let el=els.get(c.id); if(!el){ el=document.createElement('div'); el.className='card'; bindCard(el,c); st.appendChild(el); els.set(c.id,el); el.style.transform='translate3d(0,40px,0)'; el.style.opacity=0; }
    el._c=c; mountCard(el, cardView(c)); });
  layout(); scheduleHydrate();
}
let hydrateP=null;
function scheduleHydrate(){ if(hydrateP) return;
  const need=cards.filter(c=>c.bg && !bgURLs[c.id] && !bgMiss[c.id]); if(!need.length) return;
  hydrateP=(async()=>{ let changed=false;
    for(const c of need){ try{
      const b=await bgGet(c.id); if(!b||!b.size){ bgMiss[c.id]=1; continue; }
      const url=URL.createObjectURL(b); const im=await loadImage(url);
      if(!im){ URL.revokeObjectURL(url); bgMiss[c.id]=1; continue; }
      if(!c.bw) c.bw=im.naturalWidth; if(!c.bh) c.bh=im.naturalHeight;
      bgURLs[c.id]=url; changed=true;
    }catch(e){ bgMiss[c.id]=1; } }
    hydrateP=null; if(changed) render();
  })();
}
function layout(){ const H=cardH(), st=$('#stack'); document.documentElement.style.setProperty('--ch',H+'px');
  if(cur){ // open: chosen card to top, others slide down to bottom
    const iy = list.findIndex(c=>c.id===cur.id); const bottom = innerHeight - (parseFloat(getComputedStyle($('#scroller')).paddingTop)+4) - 30;
    list.forEach((c,i)=>{ const el=els.get(c.id); el.classList.toggle('open', c.id===cur.id); syncCap(el, c.id===cur.id); el.style.zIndex = c.id===cur.id?100:i;
      el.style.opacity = 1;
      el.style.transform = c.id===cur.id ? 'translate3d(0,0,0)' : `translate3d(0,${bottom + (i<iy?i:i-1)*10}px,0) scale(.94)`; });
    st.style.height=H+'px'; return; }
  list.forEach((c,i)=>{ const el=els.get(c.id); el.classList.remove('open'); syncCap(el, false); el.style.zIndex=i; el.style.opacity=1; if(el.classList.contains('dragging')) return;
    el.style.transform=`translate3d(0,${i*STRIP + i*spread*0.45 + (spread>0?spread*0.25:0)}px,0)`; });
  st.style.height = list.length ? ((list.length-1)*STRIP+H)+'px' : '0';
}
addEventListener('resize',layout); if(tg&&tg.onEvent) tg.onEvent('viewportChanged',()=>layout());
function bindCard(el){ let t, sx, sy, drag=false, held=false, startIdx;
  el.addEventListener('touchmove',e=>{ if(held||cur) e.preventDefault(); },{passive:false});
  el.addEventListener('pointerdown',e=>{ if(cur) return; held=false; drag=false; sx=e.clientX; sy=e.clientY; 
    t=setTimeout(()=>{ held=true; haptic('medium'); el.classList.add('lifted'); },420); });
  el.addEventListener('pointermove',e=>{ const dy=e.clientY-sy, dx=e.clientX-sx;
    if(!held){ if(Math.abs(dx)+Math.abs(dy)>8) clearTimeout(t); return; }
    if(!el.hasPointerCapture(e.pointerId)) try{el.setPointerCapture(e.pointerId);}catch(_){}
    if(!drag && Math.abs(dy)>6){ drag=true; el.classList.add('dragging'); startIdx=list.indexOf(el._c); el._nyT=0; }
    if(drag){ const now=performance.now();
      if(el._nyT){ const v=Math.abs(dy-el._nyY)/Math.max(now-el._nyT,16)*1000; nyMotion(v, el); }
      el._nyT=now; el._nyY=dy;
      el.style.transform=`translate3d(0,${startIdx*STRIP+dy}px,0) scale(1.03)`;
      const ni=Math.max(0,Math.min(list.length-1,Math.round((startIdx*STRIP+dy)/STRIP))), oi=list.indexOf(el._c);
      if(ni!==oi){ list.splice(oi,1); list.splice(ni,0,el._c); haptic('light'); layout(); } } });
  const end=async e=>{ clearTimeout(t); el.classList.remove('lifted'); activeEnd=null; const wasDrag=drag, wasHeld=held; drag=false; held=false;
    if(wasDrag){ el.classList.remove('dragging'); localStorage.setItem('manualOrder','1');
      list.forEach((c,i)=>{ if(c.order!==i){ c.order=i; save(c);} }); render(); offerBackup(); return; }
    if(wasHeld){ ctxMenu(e,el._c); return; }
    if(e.type==='pointerup' && !cur && Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)<8) openCard(el._c); };
  el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end);
  el.addEventListener('pointerdown',()=>{ activeEnd=(e)=>{ activeEnd=null; if(drag||held) end(e); }; });
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
function ctxMenu(e,c){ closeCtx(); const m=document.createElement('div'); m.className='ctx';
  m.innerHTML=`<button data-a="pin">${c.pin?'Открепить':'Закрепить наверху'}</button><button data-a="edit">Изменить</button><button data-a="del" class="danger">Удалить</button>`;
  m.style.left=Math.min(e.clientX,innerWidth-200)+'px'; m.style.top=Math.min(e.clientY,innerHeight-120)+'px';
  m.onclick=async ev=>{ const a=ev.target.dataset.a; closeCtx(); if(a==='pin'){ c.pin=!c.pin; c.upd=Date.now(); await save(c); render(); toast(c.pin?'Закреплено':'Откреплено'); offerBackup(); } if(a==='edit') openEditor(c); if(a==='del') delCard(c); };
  document.body.appendChild(m); const off=ev=>{ if(m.contains(ev.target)) return; document.removeEventListener('pointerdown',off,true); closeCtx(); }; setTimeout(()=>document.addEventListener('pointerdown',off,true),0); }
function closeCtx(){ document.querySelectorAll('.ctx').forEach(x=>x.remove()); }
$('#search').addEventListener('input',render);
$('#searchBtn').onclick=()=>{ document.body.classList.add('searching'); setTimeout(()=>$('#search').focus(),120); };
$('#searchCancel').onclick=()=>{ document.body.classList.remove('searching'); $('#search').value=''; $('#search').blur(); render(); };
$('#moreBtn').onclick=e=>{ closeCtx(); const m=document.createElement('div'); m.className='ctx';
  m.innerHTML=`<button data-a="add">Добавить карту</button><button data-a="auto">Сортировать по частоте</button><button data-a="bsave">Сохранить копию</button><button data-a="bload">Восстановить из копии</button>`; prepBackup();
  const r=e.currentTarget.getBoundingClientRect(); m.style.right=(innerWidth-r.right)+'px'; m.style.top=(r.bottom+8)+'px'; m.style.transformOrigin='top right';
  m.onclick=ev=>{ const a=ev.target.dataset.a; closeCtx(); if(a==='add') $('#addBtn').click(); if(a==='auto'){ localStorage.removeItem('manualOrder'); render(); toast('Частые карты — наверху'); offerBackup(); } if(a==='bsave') saveBackup(); if(a==='bload') $('#restoreIn').click(); };
  document.body.appendChild(m); const off=ev=>{ if(m.contains(ev.target)) return; document.removeEventListener('pointerdown',off,true); closeCtx(); }; setTimeout(()=>document.addEventListener('pointerdown',off,true),0); };

/* ---------- open card ---------- */
function drawCode(canvas,c){ const bcid=(FORMATS.find(f=>f[0]===c.format)||[0,'code128'])[1];
  const opts={bcid,text:String(c.number),scale:4,includetext:false,backgroundcolor:'FFFFFF'};
  if(bcid==='pdf417') opts.scale=3; if(!['qrcode','datamatrix','azteccode','pdf417'].includes(bcid)) opts.height=24;
  const sq0=['qrcode','datamatrix','azteccode'].includes(bcid); canvas.style.width = sq0?'62%':'100%'; canvas.parentElement.classList.toggle('sq',sq0);
  if(!window.bwipjs){ drawCached(canvas,c); retryCode(canvas,c); return; }
  let ok=false; try{ bwipjs.toCanvas(canvas,opts); ok=true; }catch(e){ try{bwipjs.toCanvas(canvas,{...opts,bcid:'code128'}); ok=true;}catch(_){} }
  if(ok) rememberCode(c,canvas);
  const sq=['qrcode','datamatrix','azteccode'].includes(bcid); canvas.style.width = sq?'62%':'100%'; canvas.parentElement.classList.toggle('sq',sq); }
/* offline: bundled renderer, rendered codes remembered locally, retry instead of a blank area */
let bwipP=null; function needBwip(){ if(window.bwipjs) return Promise.resolve(); return bwipP ||= new Promise((r,j)=>{ const s=document.createElement('script'); s.src='vendor/bwip-js-4.11.4.min.js?r='+Date.now(); s.onload=()=>window.bwipjs?r():j(); s.onerror=j; document.head.appendChild(s); }).catch(e=>{ bwipP=null; throw e; }); }
let retryT=0; function retryCode(canvas,c,n=0){ clearTimeout(retryT); if(cur!==c) return;
  retryT=setTimeout(()=>{ if(cur!==c) return; (window.bwipjs?Promise.resolve():needBwip()).then(()=>{ if(cur===c) drawCode(canvas,c); }).catch(()=>retryCode(canvas,c,n+1)); }, Math.min(4000,400+n*600)); }
const codeKey=c=>'code_'+hash(c.format+'|'+c.number);
function codeCache(){ try{ return JSON.parse(localStorage.getItem('codes')||'{}'); }catch(e){ return {}; } }
function rememberCode(c,canvas){ try{ const m=codeCache(), k=codeKey(c); if(m[k]) return; m[k]=canvas.toDataURL('image/png'); localStorage.setItem('codes',JSON.stringify(m)); }catch(e){} }
function drawCached(canvas,c){ const u=codeCache()[codeKey(c)]; const x=canvas.getContext('2d');
  if(!u){ canvas.width=1; canvas.height=1; return; } const im=new Image(); im.onload=()=>{ if(cur!==c) return; canvas.width=im.naturalWidth; canvas.height=im.naturalHeight; x.drawImage(im,0,0); }; im.src=u; }
function warmCodes(){ // pre-render every card's code so the next offline open has it
  if(!window.bwipjs) return; const keep={}, m=codeCache(); let changed=false;
  for(const c of cards){ const k=codeKey(c); if(m[k]){ keep[k]=m[k]; continue; }
    try{ const cv=document.createElement('canvas'); const bcid=(FORMATS.find(f=>f[0]===c.format)||[0,'code128'])[1];
      const o={bcid,text:String(c.number),scale:4,includetext:false,backgroundcolor:'FFFFFF'}; if(bcid==='pdf417') o.scale=3; if(!['qrcode','datamatrix','azteccode','pdf417'].includes(bcid)) o.height=24;
      try{ bwipjs.toCanvas(cv,o); }catch(e){ bwipjs.toCanvas(cv,{...o,bcid:'code128'}); } keep[k]=cv.toDataURL('image/png'); changed=true; }catch(e){} }
  if(changed||Object.keys(keep).length!==Object.keys(m).length) try{ localStorage.setItem('codes',JSON.stringify(keep)); }catch(e){} }
function prettyNum(c){ let n=String(c.display||'').trim(); if(!n){ n=String(c.number); if(n.length>24) return ''; }
  return /^\d{8,}$/.test(n) ? n.replace(/(\d{4})(?=\d)/g,'$1 ') : n; }
let openedAt=0;
function openCard(c){ cur=c; openedAt=Date.now(); haptic('light'); closeCtx(); 
  const sc=$('#scroller'), st=$('#stack'), topNow=st.getBoundingClientRect().top+sc.scrollTop, want=parseFloat(getComputedStyle(sc).paddingTop)+4;
  const lift=want-topNow; st.style.setProperty('--lift',lift+'px'); sc.scrollTop=0;
  document.body.classList.add('is-open'); layout();
  const el=els.get(c.id); el.classList.remove('shine'); void el.offsetWidth; el.classList.add('shine');
  setTimeout(()=>{ if(cur&&cur.id===c.id) nyCrumble(el,'open'); }, 680); setTimeout(()=>burst(el),900);
  drawCode($('#vCode'),c); const n=prettyNum(c); $('#vNum').textContent=n; $('#numRow').classList.toggle('hidden',!n);
  const v=$('#viewer'); v.style.top = (want + cardH() + 18)+'px'; v.classList.remove('hidden');
  c.uses=(c.uses||0)+1; c.last=Date.now(); save(c).catch(()=>{}); try{ localStorage.setItem('mirror',JSON.stringify(cards)); }catch(e){} setBright(true); try{tg&&tg.BackButton.show();}catch(e){} }
function closeViewer(){ if(!cur) return; cur=null; clearTimeout(retryT); document.body.classList.remove('is-open'); $('#viewer').classList.add('hidden'); setBright(false); syncBack(); layout(); }
function setBright(on){ try{ if(tg && tg.isVersionAtLeast('8.0') && tg.setBrightness) tg.setBrightness(on?1:-1); }catch(e){} }
document.addEventListener('click',e=>{ if(!cur||Date.now()-openedAt<400) return; if(e.target.closest('#viewer,.sheet-wrap,.ctx')) return;
  if(e.target.closest('.card')||e.target===document.body||e.target.closest('.stack')||e.target===document.documentElement) closeViewer(); });
if(tg&&tg.BackButton) tg.BackButton.onClick(()=>{ if(isShown('#confirm')) return answerConfirm('keep'); if(isShown('#crop')) return cancelCrop(); if(isShown('#look')) return closeLook(); if(isShown('#art')) return requestCloseArt(); if(isShown('#editor')) return requestCloseEditor(); if(isShown('#addMenu')) return closeSheet('#addMenu'); closeViewer(); });
(()=>{ let y0=null, el=null; const V=()=>$('#viewer');
  const move=dy=>{ const t=`translate3d(0,${dy}px,0)`; el.style.transition='none'; el.style.transform=t; V().style.transition='none'; V().style.transform=t; };
  const reset=()=>{ el.style.transition=''; V().style.transition='transform .5s var(--spring)'; V().style.transform=''; };
  document.addEventListener('pointerdown',e=>{ if(!cur||e.target.closest('button')||isShown('#crop')||isShown('#art')||isShown('#editor')) return; const c=e.target.closest('.card');
    if((c&&c._c&&c._c.id===cur.id)||e.target.closest('#viewer')){ y0=e.clientY; el=els.get(cur.id); } });
  document.addEventListener('touchmove',e=>{ if(y0!=null) e.preventDefault(); },{passive:false});
  document.addEventListener('pointermove',e=>{ if(y0==null) return; move(Math.max(0,e.clientY-y0)*.6); });
  document.addEventListener('pointercancel',()=>{ if(y0==null) return; y0=null; reset(); layout(); });
  document.addEventListener('pointerup',e=>{ if(y0==null) return; const dy=e.clientY-y0; y0=null; reset(); if(dy>70){ openedAt=0; closeViewer(); } else layout(); }); })();

$('#copyBtn').onclick=async()=>{ const t=String(cur.display||cur.number).replace(/\s/g,'');
  try{ await navigator.clipboard.writeText(t); toast('Номер скопирован'); return; }catch(e){}
  try{ const ta=document.createElement('textarea'); ta.value=t; ta.setAttribute('readonly',''); ta.style.cssText='position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,t.length); const ok=document.execCommand('copy'); ta.remove(); toast(ok?'Номер скопирован':'Не удалось скопировать'); }catch(e){ toast('Не удалось скопировать'); } };
$('#editBtn').onclick=()=>{ const c=cur; closeViewer(); openEditor(c); };
$('#delBtn').onclick=()=>delCard(cur);
async function delCard(c){ const ok = await confirmBox(`Удалить «${c.name}»?`); if(!ok) return;
  await store.del('c_'+c.id); await photoPut(c.id,null); await bgPut(c.id,null);
  if(bgURLs[c.id]){ URL.revokeObjectURL(bgURLs[c.id]); delete bgURLs[c.id]; }
  cards=cards.filter(x=>x.id!==c.id); closeViewer(); render(); toast('Карта удалена'); offerBackup(); }
function confirmBox(t){ return new Promise(r=>{ if(inTG && tg.showConfirm) tg.showConfirm(t,r); else r(confirm(t)); }); }

/* ---------- add ---------- */
$('#addBtn').onclick=()=>{ openSheet('#addMenu'); haptic('light'); };
$('#addMenu .backdrop').onclick=()=>closeSheet('#addMenu');
$('#addMenu').addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(!b||b.dataset.act==='gallery') return; if(b.dataset.act!=='cancel') $('#addMenu').classList.add('hidden');
  if(b.dataset.act==='cancel'){ $('#addMenu').classList.add('hidden'); return; } if(b.dataset.act==='gallery') return; if(b.dataset.act==='camera') startCam(); if(b.dataset.act==='manual') openEditor(null,{}); });
$('#fileIn').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return; $('#addMenu').classList.add('hidden'); await fromImage(f); };

const ZXO={locateFile:(f,d)=>f.endsWith('.wasm')?new URL('vendor/'+f,location.href).href:d+f};
let zxP, zxBad=false; function needZX(){ return window.ZXingWASM?Promise.resolve():(zxP ||= new Promise((r,j)=>{ const s=document.createElement('script'); s.src='vendor/zxing-wasm-2.2.4-full.js'; s.onload=()=>{ try{ ZXingWASM.prepareZXingModule({overrides:ZXO,fireImmediately:false}); }catch(e){} r(); }; s.onerror=()=>{ zxP=null; j(); }; document.head.appendChild(s); })); }
async function decode(src){ // src: Blob or ImageData
  await needZX();
  if(zxBad){ zxBad=false; try{ const pr=ZXingWASM.prepareZXingModule({overrides:ZXO,equalityFn:()=>false,fireImmediately:true}); pr&&pr.catch&&pr.catch(()=>{ zxBad=true; }); }catch(e){} }
  // if the scanner engine could not load (offline before it was cached) never hang: give up after 10 s, retry fresh next time
  const r = await Promise.race([ZXingWASM.readBarcodes(src,{tryHarder:true,maxNumberOfSymbols:1}).catch(e=>{ zxBad=true; throw e; }), new Promise((_,j)=>setTimeout(()=>{ zxBad=true; j(new Error('scanner unavailable')); },10000))]);
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

/* ---------- appearance: pastel or a local cropped photo, never the scan ---------- */
const CARD_A = 1.586, ART_MAX = 25*1024*1024, ART_EDGE = 1000;
function artFail(code, extra){ const e=new Error(extra?code+': '+extra:code); e.code=code; return e; }
function round3(n){ return Math.round(n*1000)/1000; }
function bgMetrics(crop, iw, ih){
  const s=Math.min(4, Math.max(1, round3(+crop?.s||1)));
  iw=+iw||0; ih=+ih||0;
  if(iw<2||ih<2){
    const x=Math.min(1,Math.max(0,isFinite(+crop?.x)?+crop.x:0.5)), y=Math.min(1,Math.max(0,isFinite(+crop?.y)?+crop.y:0.5));
    return {wPct:100,hPct:100,leftPct:0,topPct:0,s:1,x:round3(x),y:round3(y)};
  }
  const ai=iw/ih, wPct=100*s*Math.max(1,ai/CARD_A), hPct=100*s*Math.max(1,CARD_A/ai);
  const fw=100/wPct, fh=100/hPct;
  let x=isFinite(+crop?.x)?+crop.x:0.5, y=isFinite(+crop?.y)?+crop.y:0.5;
  x=Math.min(1-fw/2, Math.max(fw/2, x)); y=Math.min(1-fh/2, Math.max(fh/2, y));
  return {wPct,hPct,leftPct:50-x*wPct,topPct:50-y*hPct,s,x:round3(x),y:round3(y)};
}
function clampCrop(crop, iw, ih){ const m=bgMetrics(crop, iw, ih); return {s:m.s,x:m.x,y:m.y}; }
function bgStyle(crop, iw, ih){
  const m=bgMetrics(crop, iw, ih);
  if(!(+iw>1&&+ih>1)) return 'width:100%;height:100%;left:0;top:0;object-fit:cover';
  return `width:${m.wPct}%;height:${m.hPct}%;left:${m.leftPct}%;top:${m.topPct}%`;
}
function panCrop(crop, dx, dy, fw, fh, iw, ih){
  const m=bgMetrics(crop, iw, ih), dispW=fw*m.wPct/100, dispH=fh*m.hPct/100;
  if(dispW<1||dispH<1) return clampCrop(crop, iw, ih);
  return clampCrop({s:m.s,x:m.x-dx/dispW,y:m.y-dy/dispH}, iw, ih);
}
function zoomCrop(crop, factor, px, py, fw, fh, iw, ih){
  const m=bgMetrics(crop, iw, ih), dispW=fw*m.wPct/100, dispH=fh*m.hPct/100;
  const left=fw*m.leftPct/100, top=fh*m.topPct/100;
  const ix=(px-left)/dispW, iy=(py-top)/dispH;
  const s2=Math.min(4, Math.max(1, m.s*(+factor||1))), ai=(+iw)/(+ih||1);
  const dispW2=fw*s2*Math.max(1, ai/CARD_A), dispH2=fh*s2*Math.max(1, CARD_A/ai);
  return clampCrop({s:s2,x:ix-(px-fw/2)/dispW2,y:iy-(py-fh/2)/dispH2}, iw, ih);
}
function jpegMeta(buf){
  const out={orient:1,size:null};
  try{
    const v=new DataView(buf);
    if(v.byteLength<4||v.getUint16(0)!==0xFFD8) return out;
    let o=2;
    while(o+4<v.byteLength){
      const marker=v.getUint16(o);
      if(marker===0xFFD8){ o+=2; continue; }
      if(marker===0xFFD9||marker===0xFFDA) break;
      if((marker&0xFF00)!==0xFF00) break;
      const len=v.getUint16(o+2); if(len<2) break;
      const kind=marker&0xFF;
      if(marker>=0xFFC0&&marker<=0xFFCF&&kind!==0xC4&&kind!==0xC8&&kind!==0xCC&&o+9<v.byteLength)
        out.size={h:v.getUint16(o+5),w:v.getUint16(o+7)};
      if(marker===0xFFE1&&o+10<v.byteLength&&v.getUint32(o+4)===0x45786966){
        const t=o+10, le=v.getUint16(t)===0x4949, u16=p=>v.getUint16(p,le), u32=p=>v.getUint32(p,le);
        if(u16(t+2)===0x002A){ let ifd=t+u32(t+4); const n=u16(ifd);
          for(let i=0;i<n;i++){ const e=ifd+2+i*12; if(e+8>=v.byteLength) break; if(u16(e)===0x0112){ const val=u16(e+8); if(val>=1&&val<=8) out.orient=val; break; } } }
      }
      o+=2+len;
    }
  }catch(e){}
  return out;
}
function jpegOrientation(buf){ return jpegMeta(buf).orient; }
function jpegSize(buf){ return jpegMeta(buf).size; }
function loadImage(url){ return new Promise(res=>{ const im=new Image(); im.onload=()=>res(im.naturalWidth?im:null); im.onerror=()=>res(null); im.src=url; }); }
function looksImage(file){
  const t=(file.type||'').toLowerCase(), n=(file.name||'').toLowerCase();
  if(t.startsWith('image/')) return true;
  if(/\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/.test(n)) return true;
  return !t;
}
function artMessage(e, file){
  const c=e&&e.code;
  if(c==='big') return 'Файл слишком большой';
  if(c==='mem'||c==='canvas') return 'Не хватило памяти, чтобы обработать изображение';
  if(c==='type') return 'Этот формат не поддерживается. Выберите JPEG, PNG или HEIC';
  const n=((file&&file.name)||'').toLowerCase(), t=((file&&file.type)||'').toLowerCase();
  if(/\.heic$|\.heif$/.test(n)||t.includes('heic')||t.includes('heif')) return 'Не удалось открыть HEIC. Выберите JPEG или PNG';
  return 'Не удалось прочитать изображение';
}
async function bitmapOf(file, mode){
  if(typeof createImageBitmap!=='function') return null;
  const usable=bm=>{ if(bm&&bm.width>0&&bm.height>0) return bm; try{ bm&&bm.close&&bm.close(); }catch(e){} return null; };
  const opt={imageOrientation:mode};
  try{ const fast=usable(await createImageBitmap(file, {...opt, resizeWidth:ART_EDGE, resizeQuality:'high'})); if(fast) return fast; }catch(e){}
  try{ return usable(await createImageBitmap(file, opt)); }catch(e){ return null; }
}
function shrink(src, edge){
  const m=Math.max(src.width||0, src.height||0); if(!m) throw artFail('read');
  const k=Math.min(1, edge/m), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(src.width*k)); c.height=Math.max(1,Math.round(src.height*k));
  const x=c.getContext('2d'); if(!x) throw artFail('canvas');
  x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
  x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(src,0,0,c.width,c.height); return c;
}
function drawOriented(src, orient){
  const w=src.width, h=src.height, swap=orient>4;
  const c=document.createElement('canvas'); c.width=Math.max(1,swap?h:w); c.height=Math.max(1,swap?w:h);
  const x=c.getContext('2d'); if(!x) throw artFail('canvas');
  x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
  x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.save();
  switch(orient){
    case 2: x.transform(-1,0,0,1,w,0); break;
    case 3: x.transform(-1,0,0,-1,w,h); break;
    case 4: x.transform(1,0,0,-1,0,h); break;
    case 5: x.transform(0,1,1,0,0,0); break;
    case 6: x.transform(0,1,-1,0,h,0); break;
    case 7: x.transform(0,-1,-1,0,h,w); break;
    case 8: x.transform(0,-1,1,0,0,w); break;
  }
  x.drawImage(src,0,0); x.restore(); return c;
}
function dataUrlBlob(u){ const i=u.indexOf(','); const bin=atob(u.slice(i+1)); const arr=new Uint8Array(bin.length); for(let n=0;n<bin.length;n++) arr[n]=bin.charCodeAt(n); return new Blob([arr],{type:'image/jpeg'}); }
function toJpeg(canvas, q){ return new Promise((res,rej)=>{
  const viaUrl=()=>{ try{ const b=dataUrlBlob(canvas.toDataURL('image/jpeg', q)); b&&b.size?res(b):rej(artFail('canvas', canvas.width+'x'+canvas.height+' empty')); }catch(e){ rej(artFail('canvas', canvas.width+'x'+canvas.height+' '+(e&&e.message))); } };
  try{ if(!canvas.width||!canvas.height){ rej(artFail('canvas', 'zero '+canvas.width+'x'+canvas.height)); return; }
    if(canvas.toBlob) canvas.toBlob(b=>b&&b.size?res(b):viaUrl(), 'image/jpeg', q); else viaUrl();
  }catch(e){ viaUrl(); }
}); }
async function encodeJpeg(canvas){
  let cur=canvas, q=0.82, blob=await toJpeg(cur, q);
  while(blob.size>250*1024 && q>0.5){ q=Math.round((q-0.08)*100)/100; blob=await toJpeg(cur, q); }
  if(blob.size>280*1024 && Math.max(cur.width,cur.height)>480){
    cur=shrink(cur, Math.round(Math.max(cur.width,cur.height)*0.75));
    q=0.74; blob=await toJpeg(cur, q);
    while(blob.size>250*1024 && q>0.5){ q=Math.round((q-0.06)*100)/100; blob=await toJpeg(cur, q); }
  }
  return {blob,w:cur.width,h:cur.height,canvas:cur};
}
function sampleTone(source, crop, iw, ih){
  try{
    const m=bgMetrics(crop, iw, ih), c=document.createElement('canvas'); c.width=16; c.height=10;
    const x=c.getContext('2d',{willReadFrequently:true}); if(!x) return '';
    const visW=iw*(100/m.wPct), visH=ih*(100/m.hPct);
    x.drawImage(source, m.x*iw-visW/2, m.y*ih-visH/2, visW, Math.max(1,visH*0.4), 0, 0, 16, 10);
    const d=x.getImageData(0,0,16,10).data; let Y=0,n=0;
    for(let i=0;i<d.length;i+=4){ Y+=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]; n++; }
    return n&&Y/n>168?'light':'dark';
  }catch(e){ return ''; }
}
function nearA(a,b){ return Math.abs(a-b)<0.03; }
async function prepareArt(file){
  try{
    if(!file||typeof file.size!=='number') throw artFail('read');
    if(file.size>ART_MAX) throw artFail('big');
    if(file.size<16) throw artFail('read');
    if(!looksImage(file)) throw artFail('type');
    if(!document.createElement('canvas').getContext('2d')) throw artFail('canvas');
    const t=(file.type||'').toLowerCase(), name=(file.name||'').toLowerCase();
    const isJpeg=t==='image/jpeg'||t==='image/jpg'||/\.jpe?g$/.test(name);
    let meta=null; if(isJpeg){ try{ meta=jpegMeta(await file.arrayBuffer()); }catch(e){ meta=null; } }
    const orient=meta&&meta.orient||1;
    let bm=await bitmapOf(file, orient>1?'none':'from-image');
    if(!bm) bm=await bitmapOf(file,'from-image');
    let manual=1;
    if(bm&&meta&&meta.size&&orient>1){
      const rawA=meta.size.w/meta.size.h, bmA=bm.width/bm.height, oriA=orient>4?1/rawA:rawA;
      if(!nearA(rawA, oriA) && nearA(bmA, rawA)) manual=orient;
      else if(!nearA(bmA, oriA) && !nearA(bmA, rawA)){
        const alt=await bitmapOf(file,'from-image');
        if(alt){ try{bm.close&&bm.close();}catch(e){} bm=alt; }
      }
    }
    if(!bm){
      const url=URL.createObjectURL(file);
      try{ const im=await loadImage(url); if(!im) throw artFail('read'); bm=im; manual=1; }
      finally{ URL.revokeObjectURL(url); }
    }
    let canvas; try{ canvas=shrink(bm, 1600); if(manual>1) canvas=drawOriented(canvas, manual); canvas=shrink(canvas, ART_EDGE); }
    catch(e){ throw e.code?e:artFail('canvas'); }
    finally{ try{bm.close&&bm.close();}catch(e){} }
    const enc=await encodeJpeg(canvas);
    const crop=clampCrop({s:1,x:0.5,y:0.5}, enc.w, enc.h);
    return {blob:enc.blob,w:enc.w,h:enc.h,tone:sampleTone(enc.canvas, crop, enc.w, enc.h),crop};
  }catch(e){
    if(e&&e.code) throw e;
    if(/memory|quota|allocation/i.test(String(e&&e.message))) throw artFail('mem');
    throw artFail('read');
  }
}

/* editor */
let edit=null, draft={}, artS=null, cropBak=null, cropNow=null, cropDim={w:0,h:0};
$('#shops').innerHTML=SHOPS.map(s=>`<option value="${s[0]}">`).join('');
$('#fFmt').innerHTML=FORMATS.map(f=>`<option value="${f[0]}">${FMT_LABEL[f[0]]||f[0]}</option>`).join('');
function blankArt(d){ d.artMode='color'; d.artBlob=null; d.artURL=''; d.artCrop=null; d.artW=0; d.artH=0; d.artTone=''; d.artRev=0; d.artTouched=false; }
function faceOf(extra){ return {id:(edit&&edit.id)||'draft', name:$('#fName').value||'Название', number:$('#fNum').value, display:$('#fDisp').value, format:$('#fFmt').value, ...extra}; }
function preview(){
  mountCard($('#edPreview'), faceOf({color:draft.color,mode:draft.artMode,url:draft.artURL,crop:draft.artCrop,w:draft.artW,h:draft.artH,tone:draft.artTone}));
  const label=draft.artMode==='image'&&draft.artURL?'Картинка':'Цвет';
  paintThumb($('#artThumb'), {mode:draft.artMode,url:draft.artURL,crop:draft.artCrop,w:draft.artW,h:draft.artH,color:draft.color});
  $('#artVal').textContent=label; $('#artRow').setAttribute('aria-label','Оформление, '+label);
}
async function loadDraftArt(card){
  if(!card||!card.bg) return;
  const b=await bgGet(card.id); if(!b||!b.size) return;
  const url=URL.createObjectURL(b); const im=await loadImage(url);
  if(!im){ URL.revokeObjectURL(url); return; }
  draft.artMode='image'; draft.artBlob=b; draft.artURL=url;
  draft.artW=card.bw||im.naturalWidth; draft.artH=card.bh||im.naturalHeight;
  draft.artCrop=clampCrop(card.crop||{s:1,x:0.5,y:0.5}, draft.artW, draft.artH);
  draft.artTone=card.tone||sampleTone(im, draft.artCrop, draft.artW, draft.artH)||'';
  draft.artRev=1;
}
async function openEditor(card,d={}){
  edit=card; draft={...d, color:card?.color||d.color||shopColor(d.name)||shopColor(card?.name)||PALETTE[0]};
  blankArt(draft);
  $('#edTitle').textContent=card?'Изменить карту':'Новая карта';
  $('#fName').value=card?.name??d.name??''; $('#fNum').value=card?.number??d.number??''; $('#fDisp').value=card?.display??d.display??'';
  $('#fFmt').value=card?.format??d.format??'EAN-13'; if(!$('#fFmt').value) $('#fFmt').value='EAN-13';
  $('#edMsg').textContent=d.msg||'';
  try{ await loadDraftArt(card); }catch(e){}
  preview(); openSheet('#editor'); snap0=snapForm();
}
function drawColors(){
  const cur=artS?artS.color:draft.color;
  const cols=[...new Set([...PALETTE, cur].filter(Boolean))];
  $('#artColors').innerHTML=cols.map(c=>`<button type="button" style="background:${c}" data-c="${c}" class="${c===cur?'on':''} ${isLight(c)?'lt':''}" aria-label="Цвет ${c}"></button>`).join('');
}
$('#artColors').onclick=e=>{ const c=e.target.closest('button')&&e.target.dataset.c; if(!c||!artS) return; artS.color=c; drawColors(); paintArt(); };
$('#fName').oninput=()=>{ const sc=shopColor($('#fName').value); if(sc){ draft.color=sc; if(artS){ artS.color=sc; drawColors(); paintArt(); } } preview(); };
$('#fNum').oninput=()=>{ if($('#fNum').value.replace(/\D/g,'').length===13 && !edit && $('#fFmt').value==='Code128') $('#fFmt').value='EAN-13'; preview(); };
$('#fDisp').oninput=()=>preview();
$('#fFmt').onchange=()=>preview();
function artSnap(a){
  const on=a.mode==='image'&&!!a.blob;
  return JSON.stringify([on?1:0,(a.color||'').toLowerCase(),a.rev||0,on&&a.crop?[a.crop.s,a.crop.x,a.crop.y]:null]);
}
function paintArt(){
  if(!artS) return;
  const show=artS.mode==='image'&&artS.url;
  mountCard($('#artPreview'), faceOf({color:artS.color,mode:show?'image':'color',url:show?artS.url:'',crop:artS.crop,w:artS.w,h:artS.h,tone:artS.tone}));
}
function syncArtUI(){
  if(!artS) return;
  const img=artS.mode==='image', has=!!(img&&artS.blob);
  $('#artModeColor').classList.toggle('on', !img); $('#artModeImage').classList.toggle('on', img);
  $('#artModeColor').setAttribute('aria-pressed', String(!img)); $('#artModeImage').setAttribute('aria-pressed', String(img));
  $('#artColors').classList.toggle('hidden', img); $('#artImage').classList.toggle('hidden', !img);
  $('#artPick').classList.toggle('hidden', has); $('#artTools').classList.toggle('hidden', !has);
}
function setArtMode(mode){ if(!artS) return; artS.mode=mode; $('#artMsg').textContent=''; syncArtUI(); paintArt(); if(mode==='color') drawColors(); }
function openArt(){
  artS={mode:draft.artMode||'color',color:draft.color,blob:draft.artBlob||null,url:draft.artURL||'',crop:draft.artCrop?{...draft.artCrop}:null,w:draft.artW||0,h:draft.artH||0,tone:draft.artTone||'',rev:draft.artRev||0,owned:false};
  artS.base=artSnap(artS); $('#artMsg').textContent='';
  drawColors(); syncArtUI(); paintArt(); openSheet('#art');
}
function dropURL(url){
  if(!url||url===draft.artURL||(artS&&url===artS.url)) return;
  for(const k in bgURLs) if(bgURLs[k]===url) return;
  try{ URL.revokeObjectURL(url); }catch(e){}
}
function discardArt(){ if(artS&&artS.url&&artS.url!==draft.artURL) dropURL(artS.url); artS=null; closeSheet('#art'); }
function applyArt(){
  if(!artS) return;
  const changed=artSnap(artS)!==artS.base;
  draft.color=artS.color; draft.artRev=artS.rev; if(changed) draft.artTouched=true;
  if(artS.mode==='image'&&artS.blob&&artS.url){
    const prev=draft.artURL;
    draft.artMode='image'; draft.artBlob=artS.blob; draft.artURL=artS.url;
    draft.artCrop=artS.crop?{...artS.crop}:clampCrop({s:1,x:0.5,y:0.5}, artS.w, artS.h);
    draft.artW=artS.w; draft.artH=artS.h; draft.artTone=artS.tone||''; artS.owned=false;
    artS=null; if(prev&&prev!==draft.artURL) dropURL(prev);
  } else {
    const prev=draft.artURL, extra=artS.url;
    draft.artMode='color'; draft.artBlob=null; draft.artURL=''; draft.artCrop=null; draft.artW=0; draft.artH=0; draft.artTone='';
    artS=null; if(extra&&extra!==prev) dropURL(extra); if(prev) dropURL(prev);
  }
  preview(); closeSheet('#art');
}
async function requestCloseArt(){
  if(!artS) return;
  if(artSnap(artS)===artS.base){ discardArt(); return; }
  springBack('#art'); const a=await askSave();
  if(a==='save') applyArt(); else if(a==='discard') discardArt();
}
function deleteArtImage(){
  if(!artS) return;
  if(artS.owned&&artS.url&&artS.url!==draft.artURL) dropURL(artS.url);
  artS.blob=null; artS.url=''; artS.owned=false; artS.crop=null; artS.w=0; artS.h=0; artS.tone='';
  artS.mode='image'; artS.rev=(artS.rev||0)+1;
  paintArt(); syncArtUI();
}
let artBusy=false;
async function onArtFile(file){
  if(artBusy||!artS) return; artBusy=true; $('#artMsg').textContent='Обрабатываю…';
  try{
    const prep=await prepareArt(file); const url=URL.createObjectURL(prep.blob);
    beginCrop({blob:prep.blob,url,w:prep.w,h:prep.h,tone:prep.tone,crop:prep.crop});
    $('#artMsg').textContent='';
  }catch(e){ const m=artMessage(e, file); $('#artMsg').textContent=m; toast(m); }
  finally{ artBusy=false; }
}
function beginCrop(next){
  cropBak={mode:artS.mode,color:artS.color,blob:artS.blob,url:artS.url,crop:artS.crop?{...artS.crop}:null,w:artS.w,h:artS.h,tone:artS.tone,rev:artS.rev,owned:artS.owned};
  if(next){ artS.mode='image'; artS.blob=next.blob; artS.url=next.url; artS.owned=true; artS.w=next.w; artS.h=next.h; artS.tone=next.tone; artS.crop={...next.crop}; artS.rev=(artS.rev||0)+1; }
  cropNow=artS.crop?{...artS.crop}:{s:1,x:0.5,y:0.5}; cropDim={w:artS.w||0,h:artS.h||0}; openCrop();
}
function layoutCropFrame(){
  const st=$('#cropStage'); if(!st) return;
  const maxW=Math.min(Math.max(0,st.clientWidth-28),520), maxH=Math.max(120,st.clientHeight-8);
  let w=maxW, h=w/CARD_A; if(h>maxH){ h=maxH; w=h*CARD_A; }
  const f=$('#cropFrame'); f.style.width=Math.max(1,Math.round(w))+'px'; f.style.height=Math.max(1,Math.round(h))+'px';
}
function syncCrop(){
  const m=bgMetrics(cropNow, cropDim.w, cropDim.h); cropNow={s:m.s,x:m.x,y:m.y};
  const img=$('#cropImg'); img.style.width=m.wPct+'%'; img.style.height=m.hPct+'%'; img.style.left=m.leftPct+'%'; img.style.top=m.topPct+'%';
  const z=$('#cropZoom'); if(document.activeElement!==z) z.value=String(m.s);
}
function openCrop(){
  $('#crop').classList.remove('hidden'); layoutCropFrame(); const img=$('#cropImg');
  img.onload=()=>{ cropDim={w:img.naturalWidth,h:img.naturalHeight}; cropNow=clampCrop(cropNow||{s:1,x:0.5,y:0.5}, cropDim.w, cropDim.h); syncCrop(); };
  img.onerror=()=>{ const m='Не удалось прочитать изображение'; toast(m); $('#artMsg').textContent=m; cancelCrop(); };
  img.src=artS.url||''; if(img.complete&&img.naturalWidth) img.onload();
}
function closeCrop(){
  const img=$('#cropImg'); img.onload=null; img.onerror=null; img.removeAttribute('src');
  $('#crop').classList.add('hidden'); cropPts.clear(); cropPinch=0;
}
function cancelCrop(){
  if(!cropBak||!artS){ cropBak=null; closeCrop(); return; }
  const bak=cropBak, drop=artS.url; cropBak=null;
  artS.mode=bak.mode; artS.color=bak.color; artS.blob=bak.blob; artS.url=bak.url; artS.crop=bak.crop; artS.w=bak.w; artS.h=bak.h; artS.tone=bak.tone; artS.rev=bak.rev; artS.owned=bak.owned;
  closeCrop(); if(drop&&drop!==artS.url) dropURL(drop); paintArt(); syncArtUI();
}
function doneCrop(){
  if(cropNow) artS.crop=clampCrop(cropNow, cropDim.w||artS.w, cropDim.h||artS.h);
  const img=$('#cropImg');
  if(img.naturalWidth){ const t=sampleTone(img, artS.crop, img.naturalWidth, img.naturalHeight); if(t) artS.tone=t; }
  const bak=cropBak; cropBak=null; closeCrop();
  if(bak&&bak.url&&bak.url!==artS.url) dropURL(bak.url);
  paintArt(); syncArtUI();
}
const cropPts=new Map(); let cropPinch=0;
function cropBox(){ const r=$('#cropFrame').getBoundingClientRect(); return {w:r.width,h:r.height,left:r.left,top:r.top}; }
function pinchBase(){ if(cropPts.size<2){ cropPinch=0; return; } const a=[...cropPts.values()]; cropPinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); }
$('#cropFrame').addEventListener('pointerdown', e=>{
  if(e.pointerType==='mouse'&&e.button!==0) return;
  cropPts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  try{ $('#cropFrame').setPointerCapture(e.pointerId); }catch(_){}
  pinchBase(); e.stopPropagation();
});
$('#cropFrame').addEventListener('pointermove', e=>{
  if(!cropPts.has(e.pointerId)) return;
  e.preventDefault(); e.stopPropagation();
  const prev=cropPts.get(e.pointerId), now={x:e.clientX,y:e.clientY}; cropPts.set(e.pointerId, now);
  const b=cropBox(); if(b.w<2||b.h<2) return;
  if(cropPts.size>=2){
    const a=[...cropPts.values()], dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    if(cropPinch>8&&dist>8) cropNow=zoomCrop(cropNow, dist/cropPinch, (a[0].x+a[1].x)/2-b.left, (a[0].y+a[1].y)/2-b.top, b.w, b.h, cropDim.w, cropDim.h);
    cropPinch=dist; syncCrop();
  } else { cropNow=panCrop(cropNow, now.x-prev.x, now.y-prev.y, b.w, b.h, cropDim.w, cropDim.h); syncCrop(); }
});
function cropPtrEnd(e){ cropPts.delete(e.pointerId); pinchBase(); }
$('#cropFrame').addEventListener('pointerup', cropPtrEnd);
$('#cropFrame').addEventListener('pointercancel', cropPtrEnd);
$('#cropFrame').addEventListener('touchmove', e=>{ e.preventDefault(); e.stopPropagation(); }, {passive:false});
$('#cropZoom').addEventListener('input', ()=>{
  const s=parseFloat($('#cropZoom').value)||1, b=cropBox(), cur=(cropNow&&cropNow.s)||1;
  if(b.w<2) return;
  cropNow=zoomCrop(cropNow||{s:1,x:0.5,y:0.5}, s/cur, b.w/2, b.h/2, b.w, b.h, cropDim.w, cropDim.h);
  const m=bgMetrics(cropNow, cropDim.w, cropDim.h); cropNow={s:m.s,x:m.x,y:m.y};
  const img=$('#cropImg'); img.style.width=m.wPct+'%'; img.style.height=m.hPct+'%'; img.style.left=m.leftPct+'%'; img.style.top=m.topPct+'%';
});
let lookMode='open';
function lookSource(){ return artS||{mode:draft.artMode,color:draft.color,url:draft.artURL,crop:draft.artCrop,w:draft.artW,h:draft.artH,tone:draft.artTone}; }
function lookFace(){ const s=lookSource(); const show=s.mode==='image'&&s.url; return faceOf({color:s.color,mode:show?'image':'color',url:show?s.url:'',crop:s.crop,w:s.w,h:s.h,tone:s.tone}); }
function paintLookCode(canvas, c){
  const bcid=(FORMATS.find(f=>f[0]===c.format)||[0,'code128'])[1];
  const opts={bcid,text:String(c.number||'0'),scale:3,includetext:false,backgroundcolor:'FFFFFF'};
  if(bcid==='pdf417') opts.scale=2; if(!['qrcode','datamatrix','azteccode','pdf417'].includes(bcid)) opts.height=18;
  const sq=['qrcode','datamatrix','azteccode'].includes(bcid);
  canvas.style.width=sq?'62%':'100%'; canvas.parentElement.classList.toggle('sq', sq);
  const draw=()=>{ try{ bwipjs.toCanvas(canvas, opts); }catch(e){ try{ bwipjs.toCanvas(canvas,{...opts,bcid:'code128'}); }catch(_){} } };
  if(window.bwipjs) draw(); else needBwip().then(()=>{ if(isShown('#look')&&lookMode==='open') draw(); }).catch(()=>{});
}
function paintLook(){
  const v=lookFace();
  mountCard($('#lookCard'), v); mountCard($('#lookStackCard'), v);
  const n=prettyNum(v); $('#lookNum').textContent=n; $('#lookNumRow').classList.toggle('hidden', !n);
  const open=lookMode==='open';
  $('#lookOpenView').classList.toggle('hidden', !open); $('#lookStackView').classList.toggle('hidden', open);
  $('#lookOpen').classList.toggle('on', open); $('#lookStack').classList.toggle('on', !open);
  $('#lookOpen').setAttribute('aria-pressed', String(open)); $('#lookStack').setAttribute('aria-pressed', String(!open));
  if(open) paintLookCode($('#lookCode'), v);
}
function openLook(){ lookMode='open'; paintLook(); openSheet('#look'); }
function closeLook(){ return closeSheet('#look'); }
function setLookMode(mode){ lookMode=mode; paintLook(); }
$('#lookRow').onclick=()=>openLook();
$('#lookBack').onclick=()=>closeLook();
$('#look .backdrop').onclick=()=>closeLook();
$('#lookOpen').onclick=()=>setLookMode('open');
$('#lookStack').onclick=()=>setLookMode('stack');
$('#artRow').onclick=()=>openArt();
$('#artBack').onclick=()=>requestCloseArt();
$('#artDone').onclick=()=>applyArt();
$('#artModeColor').onclick=()=>setArtMode('color');
$('#artModeImage').onclick=()=>setArtMode('image');
$('#artPick').onclick=()=>$('#artFile').click();
$('#artReplace').onclick=()=>$('#artFile').click();
$('#artCrop').onclick=()=>{ if(artS&&artS.blob) beginCrop(null); };
$('#artDel').onclick=()=>deleteArtImage();
$('#artFile').onchange=e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(f) onArtFile(f); };
$('#art .backdrop').onclick=()=>requestCloseArt();
$('#cropCancel').onclick=()=>cancelCrop();
$('#cropReset').onclick=()=>{ cropNow=clampCrop({s:1,x:0.5,y:0.5}, cropDim.w, cropDim.h); syncCrop(); };
$('#cropDone').onclick=()=>doneCrop();
addEventListener('resize', ()=>{ try{ if(!$('#crop').classList.contains('hidden')) layoutCropFrame(); }catch(e){} });
$('#edCancel').onclick=()=>requestCloseEditor();
$('#editor .backdrop').onclick=()=>requestCloseEditor();
function releaseDraftURL(){
  const url=draft.artURL; let keep=false; for(const k in bgURLs) if(bgURLs[k]===url) keep=true;
  draft.artURL=''; if(url&&!keep) try{ URL.revokeObjectURL(url); }catch(e){}
}
function closeEditor(instant){
  if(!$('#crop').classList.contains('hidden')) cancelCrop();
  if(isShown('#look')) closeSheet('#look', true);
  if(artS) discardArt();
  releaseDraftURL();
  return closeSheet('#editor', instant);
}
async function commitArt(c){
  const want=!!(draft.artTouched && draft.artMode==='image' && draft.artBlob);
  const clear=!!draft.artTouched && !want;
  if(!draft.artTouched && edit){
    try{ await save(c); }catch(err){ $('#edMsg').textContent=err.message||'Не удалось сохранить'; return false; }
    return true;
  }
  if(want){
    const tmp=bgKey(c.id)+':next';
    if(!await photoPut(tmp, draft.artBlob)){ $('#edMsg').textContent='Не удалось сохранить изображение на устройстве'; return false; }
    c.bg=1; c.crop={...draft.artCrop}; c.bw=draft.artW; c.bh=draft.artH;
    if(draft.artTone==='light'||draft.artTone==='dark') c.tone=draft.artTone; else delete c.tone;
    try{ await save(c); }
    catch(err){ await photoPut(tmp, null); $('#edMsg').textContent=err.message||'Не удалось сохранить'; return false; }
    const moved=await photoPut(bgKey(c.id), draft.artBlob); await photoPut(tmp, null);
    if(!moved){
      delete c.bg; delete c.crop; delete c.bw; delete c.bh; delete c.tone;
      try{ await save(c); }catch(e){}
      $('#edMsg').textContent='Не удалось сохранить изображение на устройстве'; return false;
    }
    if(bgURLs[c.id]&&bgURLs[c.id]!==draft.artURL) URL.revokeObjectURL(bgURLs[c.id]);
    bgURLs[c.id]=draft.artURL; delete bgMiss[c.id];
    return true;
  }
  delete c.bg; delete c.crop; delete c.bw; delete c.bh; delete c.tone;
  try{ await save(c); }
  catch(err){ $('#edMsg').textContent=err.message||'Не удалось сохранить'; return false; }
  if(clear||!edit){ await bgPut(c.id, null); if(bgURLs[c.id]){ URL.revokeObjectURL(bgURLs[c.id]); delete bgURLs[c.id]; } }
  return true;
}
$('#form').onsubmit=async e=>{ e.preventDefault();
  let fmt=$('#fFmt').value, num=$('#fNum').value.trim();
  if(fmt==='EAN-13' && !/^\d{12,13}$/.test(num.replace(/\s/g,''))) fmt='Code128'; else if(fmt==='EAN-13') num=num.replace(/\s/g,'');
  const wasNew=!edit;
  const c = edit || {id:Date.now().toString(36)+Math.random().toString(36).slice(2,6), order:cards.length, uses:0};
  if(wasNew || snapForm()!==snap0) c.upd=Date.now();
  const color=/^#[0-9a-f]{6}$/i.test(draft.color||'')?draft.color:PALETTE[0];
  Object.assign(c,{name:$('#fName').value.trim(),number:num,format:fmt,color,display:$('#fDisp').value.trim()||(/^\d{8,14}$/.test(num)?num:'')});
  if(!await commitArt(c)) return;
  if(draft.photo){ await photoPut(c.id,draft.photo); photoURLs[c.id]=URL.createObjectURL(draft.photo); }
  if(wasNew) cards.push(c);
  closeEditor(); render(); haptic('success'); setTimeout(warmCodes,400); offerBackup(); };

/* misc */
function haptic(t){ try{ const h=tg&&tg.HapticFeedback; if(!h) return; t==='success'?h.notificationOccurred('success'):h.impactOccurred(t); }catch(e){} }
let tt; function toast(t){ const e=$('#toast'); e.textContent=t; e.classList.add('on'); clearTimeout(tt); tt=setTimeout(()=>e.classList.remove('on'),1800); }
window.__app={decode,cards:()=>cards,ny:{force:NY_FORCE,on:NY,inSeason:nyInSeason}};
boot(); reconcile().catch(e=>{ console.warn(e); document.body.classList.remove('loading'); render(); }).finally(()=>{ const w=()=>needBwip().then(()=>setTimeout(warmCodes,300)).catch(()=>{}); document.readyState==='complete'?w():addEventListener('load',w,{once:true}); });
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')) try{ navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).then(r=>r.update&&r.update()).catch(()=>{}); navigator.storage&&navigator.storage.persist&&navigator.storage.persist().catch(()=>{}); }catch(e){}

document.addEventListener('touchmove',e=>{ if(!window.__noDoc && !e.target.closest('#scroller,.sheet,#crop')) e.preventDefault(); },{passive:false});

/* ---- candy fx ---- */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function burst(el){ if(RM) return; const r=el.getBoundingClientRect(), B=$('#burst');
  for(let i=0;i<9;i++){ const a=Math.random()*Math.PI*2, d=40+Math.random()*70, e=document.createElement('i'); e.className='bs';
    e.style.left=(r.left+r.width*(.2+Math.random()*.6))+'px'; e.style.top=(r.top+r.height*(.2+Math.random()*.6))+'px';
    e.style.setProperty('--dx',Math.cos(a)*d+'px'); e.style.setProperty('--dy',Math.sin(a)*d+'px'); e.style.setProperty('--sc',(.5+Math.random()*.8).toFixed(2));
    e.style.animationDelay=(Math.random()*.15)+'s'; B.appendChild(e); setTimeout(()=>e.remove(),1200); } }
function bubbles(FX,N,local){
  const bs=[]; let uid=bubbles.n=(bubbles.n||0)+1;
  const svg=i=>{ i=uid+'_'+i; return `<svg viewBox="0 0 100 100"><defs>
   <linearGradient id="r${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3d6"/><stop offset=".45" stop-color="#cdb8ff"/><stop offset=".8" stop-color="#a8ecd9"/><stop offset="1" stop-color="#ffd9ef"/></linearGradient>
   <radialGradient id="f${i}" cx=".5" cy=".5" r=".5"><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset=".9" stop-color="#f3dcff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity=".6"/></radialGradient></defs>
   <circle cx="50" cy="50" r="48" fill="url(#f${i})"/><circle cx="50" cy="50" r="47.5" fill="none" stroke="url(#r${i})" stroke-width="2.4"/>
   <ellipse cx="33" cy="28" rx="13" ry="6.5" fill="#fff" opacity=".85" transform="rotate(-35 33 28)"/><circle cx="70" cy="74" r="3.2" fill="#fff" opacity=".5"/></svg>`; };
  const W=()=>local?FX.clientWidth:innerWidth, H=()=>local?FX.clientHeight:innerHeight;
  for(let i=0;i<N;i++){ const e=document.createElement('div'); e.className='bubble'; const s=14+Math.round(Math.random()*34);
    e.style.width=e.style.height=s+'px'; e.innerHTML=svg(i); FX.appendChild(e);
    bs.push({e,s,x:Math.random()*(W()||360),y:Math.random()*(H()||700),v:12+Math.random()*16,ph:Math.random()*6.28,amp:10+Math.random()*16,sw:1500+Math.random()*1200,wb:600+Math.random()*500}); }
  let last=performance.now(), run=!RM && !document.hidden;
  function place(b,t){ const w=Math.sin(t/b.wb+b.ph)*.06, p=1+Math.sin(t/1700+b.ph*2)*.05;
    b.e.style.transform=`translate3d(${b.x+Math.sin(t/b.sw+b.ph)*b.amp}px,${b.y}px,0) scale(${p*(1+w)},${p*(1-w)})`; }
  function tick(t){ const dt=Math.min(.05,(t-last)/1000); last=t;
    if(!local||FX.offsetParent){ const h=H(), w=W();
      for(const b of bs){ b.y-=b.v*dt; if(b.y<-b.s){ b.y=h+b.s; b.x=Math.random()*Math.max(1,w-b.s); } place(b,t); } }
    if(run) requestAnimationFrame(tick); }
  bs.forEach(b=>place(b,0));
  if(run) requestAnimationFrame(tick);
  document.addEventListener('visibilitychange',()=>{ const was=run; run=!RM&&!document.hidden; if(run&&!was){ last=performance.now(); requestAnimationFrame(tick);} });
}
const FLAKES=['snowflake-1','snowflake-2','snowflake-3','snowflake-4','flake-dot','flake-dot'];
function snowFall(FX,N){
  const bs=[];
  for(let i=0;i<N;i++){ const e=document.createElement('img'); e.className='flake'; e.alt=''; e.draggable=false;
    e.src='assets/ny/'+FLAKES[i%FLAKES.length]+'.svg?v=20';
    const s=11+(i*5)%14; e.style.width=e.style.height=s+'px'; FX.appendChild(e);
    bs.push({e,s,x:((i*97)%100)/100*(Math.max(FX.clientWidth,innerWidth)||360), y:((i*53)%120)/100*((FX.clientHeight||innerHeight)||700), v:7+(i%4)*2.2, ph:i, amp:8+(i%3)*4, sw:3200+i*180}); }
  const W=()=>FX.clientWidth||innerWidth, H=()=>FX.clientHeight||innerHeight;
  function place(b,t){ b.e.style.transform=`translate3d(${b.x+Math.sin(t/b.sw+b.ph)*b.amp}px,${b.y}px,0) rotate(${Math.sin(t/1400+b.ph)*18}deg)`; }
  let last=performance.now(), run=!RM && !document.hidden;
  function tick(t){ const dt=Math.min(.05,(t-last)/1000); last=t;
    if(FX.offsetParent!==null || FX===document.getElementById('fx')){ const h=H(), w=W();
      for(const b of bs){ b.y+=b.v*dt; if(b.y>h+8){ b.y=-b.s; b.x=Math.random()*Math.max(1,w-b.s); } place(b,t); } }
    if(run) requestAnimationFrame(tick); }
  bs.forEach(b=>place(b,0));
  if(run) requestAnimationFrame(tick);
  document.addEventListener('visibilitychange',()=>{ const was=run; run=!RM&&!document.hidden; if(run&&!was){ last=performance.now(); requestAnimationFrame(tick);} });
}
if(NY) snowFall($('#fx'),11);
else { bubbles($('#fx'),10,false);
  document.querySelectorAll('.sheet').forEach(sh=>{ const f=document.createElement('div'); f.className='fx-local'; f.setAttribute('aria-hidden','true'); sh.prepend(f); bubbles(f,4,true); }); }

/* Snow that leaves the caps: open-card handful, and a little more when the stack actually moves.
   Caps are never edited. Nothing here listens to the device sensors. */
const CRUMB_MAX = 22;
const nyLive = [];
let crumbRAF = 0, motionAt = 0;
function nyStill(){ return !NY || RM || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden; }
function nyCrumble(card, opt){
  if(nyStill()) return 0;
  const cap = card && card.querySelector && card.querySelector('.snowcap');
  if(!cap) return 0;
  const open = opt==='open';
  let n = open ? 5 : (opt|0);
  n = Math.min(n, CRUMB_MAX - nyLive.length);
  if(n<=0) return 0;
  const host = $('#crumbs'); if(!host) return 0;
  const r = (open ? card : cap).getBoundingClientRect();
  if(r.width<8 || r.bottom<0 || r.top>innerHeight) return 0;
  const panel = document.querySelector('#viewer:not(.hidden) .panel');
  const pb = panel ? panel.getBoundingClientRect() : null;
  let made = 0;
  for(let i=0;i<n;i++){
    const x = r.left + r.width*(open ? 0.2+Math.random()*0.6 : 0.15+Math.random()*0.7);
    const y = (open ? r.top - 1 : r.top + r.height*0.62) + Math.random()*3;
    if(pb && y>pb.top-8 && x>pb.left && x<pb.right) continue;
    const e = document.createElement('i');
    e.className = 'crumb'+(i%3===0?' bit':'');
    const s = open ? 2.4+Math.random()*3.2 : 2.4+Math.random()*1.6;
    e.style.width = e.style.height = s.toFixed(1)+'px';
    host.appendChild(e);
    nyLive.push({e,x,y,s,open,y0:y,base:open?0.4+Math.random()*0.45:1,vx:(Math.random()-.5)*(open?6:14),vy:(open?8:28)+Math.random()*(open?10:22),t:0,dur:open?0.42+Math.random()*0.18:0.42+Math.random()*0.14,rot:(Math.random()-.5)*16});
    made++;
  }
  if(!made) return 0;
  if(open) window.__app.ny.openedCrumbs = (window.__app.ny.openedCrumbs||0)+made;
  else window.__app.ny.shed = (window.__app.ny.shed||0)+made;
  nyCrumbsRun();
  return made;
}
function nyMotion(speed, card){
  if(nyStill() || speed<360) return;
  const now = performance.now();
  if(now-motionAt<80) return;
  motionAt = now;
  const n = speed>1200?3:speed>700?2:1;
  if(card){ nyCrumble(card, n); return; }
  const cards = document.querySelectorAll('#stack .card');
  let spawned = 0;
  for(const el of cards){
    if(spawned>=2) break;
    const r = el.getBoundingClientRect();
    if(r.bottom<64 || r.top>innerHeight-8) continue;
    nyCrumble(el, n); spawned++;
  }
}
function nyCrumbsRun(){
  if(crumbRAF || !nyLive.length) return;
  let last = performance.now();
  const tick = now => {
    if(document.hidden){ crumbRAF = 0; return; }
    const dt = Math.min(0.032, (now-last)/1000); last = now;
    const panel = document.querySelector('#viewer:not(.hidden) .panel');
    const pb = panel ? panel.getBoundingClientRect() : null;
    for(let i=nyLive.length-1;i>=0;i--){
      const c = nyLive[i];
      c.t += dt;
      const k = c.t/c.dur;
      if(k>=1){ c.e.remove(); nyLive.splice(i,1); continue; }
      c.vy += (c.open?18:80)*dt;
      c.x += c.vx*dt; c.y += c.vy*dt;
      const drop = c.y-c.y0;
      const far = drop > (c.open?16:24);
      if(far || (pb && c.y+c.s>pb.top && c.x>pb.left && c.x<pb.right)){ c.e.remove(); nyLive.splice(i,1); continue; }
      const fade = (c.base||1) * (c.open ? 1-k : (k<0.55 ? 1 : 1-(k-0.55)/0.45));
      c.e.style.opacity = Math.max(0, fade).toFixed(3);
      c.e.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0) rotate(${(c.rot+k*20).toFixed(1)}deg) scale(${(1-k*0.55).toFixed(3)})`;
    }
    crumbRAF = nyLive.length ? requestAnimationFrame(tick) : 0;
  };
  crumbRAF = requestAnimationFrame(tick);
}
function mountGarland(){
  const g = document.querySelector('.garland'); if(!g || g.querySelector('.bulb')) return;
  const xs = [27.23,70.57,112,154.7,193.57,228.4,271.11,314,355.94,393.72,427.4,467.61,508,548.47,580.08];
  const ys = [22.2,31.4,39.0,33.1,22.5,22.3,32.0,40.0,33.7,22.6,22.1,30.1,37.0,31.8,22.3];
  const cols = ['#FFF3D4','#E8C88A','#F0A8C0','#C5DDD4','#F6D7A6'];
  const glows = ['rgba(255,228,170,.85)','rgba(232,190,100,.7)','rgba(232,120,160,.65)','rgba(170,210,196,.7)','rgba(240,200,130,.75)'];
  const durs = [3.2,2.6,3.8,2.9,4.1,2.5,3.5,2.8,3.9,2.7,3.3,4.4,2.4,3.6,3.1];
  const delays = [0.1,1.7,0.8,2.4,1.2,2.9,0.4,1.9,3.1,0.6,2.2,1.4,2.7,0.15,1.05];
  const segs = [[8,16,48,16,78,32,112,34],[112,34,150,36,176,16,210,16],[210,16,248,16,278,33,314,35],[314,35,352,37,376,16,410,16],[410,16,446,16,474,30,508,32],[508,32,546,34,568,16,592,16]];
  const bez = (a,b,c,d,t)=>{ const u=1-t; return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d; };
  const path = [];
  for(const s of segs) for(let i=0;i<=14;i++) path.push([bez(s[0],s[2],s[4],s[6],i/14), bez(s[1],s[3],s[5],s[7],i/14)]);
  const runner = document.createElement('i'); runner.className = 'runner'; g.appendChild(runner);
  let runRaf = 0, runN = 0;
  xs.forEach((x,i)=>{
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bulb'; b.setAttribute('aria-label','Лампочка');
    b.style.left = (x/600*100).toFixed(2)+'%';
    b.style.setProperty('--cy', (ys[i]/52*100).toFixed(2));
    b.style.setProperty('--c', cols[i%cols.length]);
    b.style.setProperty('--glow', glows[i%glows.length]);
    b.style.setProperty('--dur', durs[i]+'s');
    b.style.setProperty('--delay', delays[i]+'s');
    b.dataset.i = String(i);
    b.innerHTML = '<i></i>';
    b.addEventListener('click', ev=>{
      ev.stopPropagation();
      if(nyStill()) return;
      b.classList.remove('hot'); void b.offsetWidth; b.classList.add('hot');
      clearTimeout(b._hot); b._hot = setTimeout(()=>b.classList.remove('hot'), 520);
      const bx = x, by = ys[i]-5;
      let best = 0, bd = 1e9;
      path.forEach((p,pi)=>{ const dx=p[0]-bx, dy=p[1]-by, d=dx*dx+dy*dy; if(d<bd){ bd=d; best=pi; } });
      const dir = best < path.length*0.55 ? 1 : -1;
      const end = dir>0 ? path.length-1 : 0;
      const t0 = performance.now(), dur = 1080;
      if(runRaf) cancelAnimationFrame(runRaf);
      runner.classList.add('on');
      g.dataset.run = String(++runN);
      const box = g.getBoundingClientRect();
      let lastBulb = -2;
      const step = now=>{
        if(document.hidden){ runner.classList.remove('on'); runRaf=0; return; }
        const k = Math.min(1, (now-t0)/dur);
        const e = 1-Math.pow(1-k, 3);
        const idx = Math.round(best + (end-best)*e);
        const p = path[Math.max(0, Math.min(path.length-1, idx))];
        runner.style.transform = `translate3d(${(p[0]/600*box.width).toFixed(1)}px,${(p[1]/52*box.height).toFixed(1)}px,0)`;
        const bi = Math.round(idx / ((path.length-1)/14));
        if(bi!==lastBulb){
          const prev = g.querySelector('.bulb.pass'); if(prev) prev.classList.remove('pass');
          const el = g.querySelector('.bulb[data-i="'+bi+'"]'); if(el) el.classList.add('pass');
          lastBulb = bi;
        }
        if(k<1) runRaf = requestAnimationFrame(step);
        else { runner.classList.remove('on'); const prev=g.querySelector('.bulb.pass'); if(prev) prev.classList.remove('pass'); runRaf=0; }
      };
      runRaf = requestAnimationFrame(step);
    });
    g.appendChild(b);
  });
}
if(NY){ mountGarland(); window.__app.ny.shed = 0; window.__app.ny.openedCrumbs = 0; }
document.addEventListener('visibilitychange',()=>{
  document.documentElement.classList.toggle('asleep', document.hidden);
  if(document.hidden){ if(crumbRAF){ cancelAnimationFrame(crumbRAF); crumbRAF=0; } }
  else if(nyLive.length) nyCrumbsRun();
});

/* Wallet-style elastic pull: no container rubber-band, cards spread apart */
(()=>{ const sc=$('#scroller'), st=$('#stack'); let y0=null, mode=null, raf=0;
  const rub=d=>{ const k=360; return k*(1-1/(d/k*0.55+1)); };
  const apply=()=>{ raf=0; layout(); };
  sc.addEventListener('touchstart',e=>{ if(cur||e.touches.length>1) return; y0=e.touches[0].clientY; mode=null; },{passive:true});
  sc.addEventListener('touchmove',e=>{ if(y0==null||cur) return; const dy=e.touches[0].clientY-y0;
    const max=sc.scrollHeight-sc.clientHeight;
    if(mode==null){ if(dy>0 && sc.scrollTop<=0) mode='pull'; else if(dy<0 && sc.scrollTop>=max-1) mode='edge'; else mode='scroll'; if(mode==='pull'){ st.classList.add('pulling'); y0=e.touches[0].clientY; } }
    if(mode==='pull'){ e.preventDefault(); const prev=spread; spread=rub(Math.max(0,e.touches[0].clientY-y0));
      const now=performance.now(); if(st._nyT){ nyMotion(Math.abs(spread-prev)/Math.max(now-st._nyT,16)*1000); } st._nyT=now;
      if(!raf) raf=requestAnimationFrame(apply); }
    else if(mode==='edge'){ e.preventDefault(); }
  },{passive:false});
  const end=()=>{ if(mode==='pull'){ st.classList.remove('pulling'); spread=0; layout(); } y0=null; mode=null; };
  sc.addEventListener('touchend',end); sc.addEventListener('touchcancel',end);
  let sy=sc.scrollTop, stt=performance.now();
  sc.addEventListener('scroll',()=>{ const now=performance.now(), ny=sc.scrollTop;
    const v=Math.abs(ny-sy)/Math.max(now-stt,16)*1000; sy=ny; stt=now; if(!cur) nyMotion(v); },{passive:true});
})();

/* ---------- sheets: open/close, swipe-to-dismiss, dirty prompt ---------- */
const isShown=sel=>!$(sel).classList.contains('hidden');
function syncBack(){ try{ if(!tg||!tg.BackButton) return; (cur||isShown('#editor')||isShown('#addMenu')||isShown('#confirm'))?tg.BackButton.show():tg.BackButton.hide(); }catch(e){} }
function openSheet(sel){ const w=$(sel), sh=w.querySelector('.sheet'), bd=w.querySelector('.backdrop');
  sh.style.transition='none'; sh.style.transform=''; bd.style.transition='none'; bd.style.opacity=''; w.classList.remove('hidden');
  sh.style.animation='none'; void sh.offsetWidth; sh.style.animation=''; if(sh.scrollTop) sh.scrollTop=0; syncBack(); }
function closeSheet(sel,instant){ const w=$(sel); if(w.classList.contains('hidden')) return Promise.resolve();
  const sh=w.querySelector('.sheet'), bd=w.querySelector('.backdrop'); if(document.activeElement && w.contains(document.activeElement)) document.activeElement.blur();
  if(instant||RM){ w.classList.add('hidden'); syncBack(); return Promise.resolve(); }
  return new Promise(r=>{ sh.style.transition='transform .32s cubic-bezier(.3,.6,.4,1)'; bd.style.transition='opacity .32s'; sh.style.transform='translate3d(0,100%,0)'; bd.style.opacity='0';
    setTimeout(()=>{ w.classList.add('hidden'); sh.style.transition=''; sh.style.transform=''; bd.style.transition=''; bd.style.opacity=''; syncBack(); r(); },330); }); }
function springBack(sel){ const w=$(sel), sh=w.querySelector('.sheet'), bd=w.querySelector('.backdrop');
  sh.style.transition='transform .5s var(--spring)'; bd.style.transition='opacity .35s'; sh.style.transform=''; bd.style.opacity=''; }
let snap0='';
function snapForm(){ return JSON.stringify([$('#fName').value.trim(),$('#fNum').value.trim(),$('#fDisp').value.trim(),$('#fFmt').value,(draft.color||'').toLowerCase(),draft.artMode==='image'&&draft.artBlob?1:0,draft.artRev||0,draft.artCrop?[draft.artCrop.s,draft.artCrop.x,draft.artCrop.y]:null]); }
const isDirty=()=>isShown('#editor') && snapForm()!==snap0;
let confirmRes=null;
function askSave(){ const c=$('#confirm'); c.classList.remove('hidden'); syncBack(); haptic('light'); return new Promise(r=>confirmRes=r); }
function answerConfirm(v){ $('#confirm').classList.add('hidden'); syncBack(); const r=confirmRes; confirmRes=null; r&&r(v); }
$('#confirm').addEventListener('click',e=>{ const b=e.target.closest('[data-ans]'); if(b) answerConfirm(b.dataset.ans); else if(e.target.classList.contains('backdrop')) answerConfirm('keep'); });
async function requestCloseEditor(){ if(document.activeElement) document.activeElement.blur();
  if(isShown('#look')) return closeLook();
  if(isShown('#crop')||isShown('#art')) return;
  if(!isDirty()){ return closeEditor(); }
  springBack('#editor'); const a=await askSave();
  if(a==='save'){ $('#form').requestSubmit(); }
  else if(a==='discard'){ closeEditor(); } }
function sheetSwipe(sel,onDismiss){ const w=$(sel), sh=w.querySelector('.sheet'), bd=w.querySelector('.backdrop');
  let y0=null, dy=0, active=false, lastY=0, lastT=0, vel=0, fromTouch=false;
  const begin=y=>{ if(sh.scrollTop>0) return false; y0=lastY=y; lastT=performance.now(); dy=0; active=false; vel=0; return true; };
  const drag=y=>{ if(y0==null) return; dy=y-y0;
    if(!active){ if(dy>6 && sh.scrollTop<=0){ active=true; if(document.activeElement&&sh.contains(document.activeElement)) document.activeElement.blur(); sh.style.transition='none'; bd.style.transition='none'; } else if(dy<-4){ y0=null; return; } else return; }
    const now=performance.now(); vel=(y-lastY)/Math.max(1,now-lastT); lastY=y; lastT=now;
    const d=dy>0?dy:-Math.sqrt(-dy)*3; sh.style.transform=`translate3d(0,${d}px,0)`; bd.style.opacity=String(Math.max(0,1-d/sh.offsetHeight)); };
  const end=()=>{ if(y0==null) return; y0=null; if(!active) return; active=false;
    if(dy>sh.offsetHeight*.3 || (vel>0.6 && dy>30)) onDismiss(); else springBack(sel); };
  sh.addEventListener('touchstart',e=>{ if(e.touches.length>1) return; const tgt=e.target;
    if(getSelection&&String(getSelection())) return;
    if(tgt.matches('input,select,textarea') && tgt===document.activeElement) return;
    fromTouch=true; begin(e.touches[0].clientY); },{passive:true});
  sh.addEventListener('touchmove',e=>{ if(y0==null) return; const before=y0; drag(e.touches[0].clientY); if(y0!=null&&(active||before!==y0)) e.preventDefault(); },{passive:false});
  sh.addEventListener('touchend',()=>{ fromTouch=false; end(); });
  sh.addEventListener('touchcancel',()=>{ fromTouch=false; if(active){ active=false; y0=null; springBack(sel);} });
  // mouse / desktop pointer. Real touches keep the touch path so iOS does not handle one gesture twice.
  sh.addEventListener('pointerdown',e=>{ if(fromTouch||e.pointerType==='touch'||e.button) return; const tgt=e.target;
    if(getSelection&&String(getSelection())) return;
    if(tgt.matches('input,select,textarea') && tgt===document.activeElement) return;
    begin(e.clientY); });
  sh.addEventListener('pointermove',e=>{ if(fromTouch||e.pointerType==='touch'||y0==null) return; drag(e.clientY); if(active) e.preventDefault(); });
  sh.addEventListener('pointerup',e=>{ if(e.pointerType==='touch') return; end(); });
  sh.addEventListener('pointercancel',e=>{ if(e.pointerType==='touch') return; if(active){ active=false; y0=null; springBack(sel);} });
}
sheetSwipe('#addMenu',()=>closeSheet('#addMenu'));
sheetSwipe('#editor',()=>{ if(isShown('#art')||isShown('#look')||isShown('#crop')||isShown('#confirm')) return; requestCloseEditor(); });
sheetSwipe('#art',()=>{ if(isShown('#look')||isShown('#crop')||isShown('#confirm')) return; requestCloseArt(); });
sheetSwipe('#look',()=>closeLook());

/* ---------- backup file CardsForKitty.json: save to Files / restore ---------- */
const BK_NAME='CardsForKitty.json';
const blobToDataURL=b=>new Promise(r=>{ const f=new FileReader(); f.onload=()=>r(f.result); f.onerror=()=>r(null); f.readAsDataURL(b); });
async function dataURLToBlob(u){ return (await fetch(u)).blob(); }
// what matters for "is the saved copy current": card content, photos present, sort setting (not open counters)
// cards without a background keep the previous hash shape, so an unchanged wallet is not asked to re-save
async function blobMark(b){ const u=new Uint8Array(await b.slice(0,Math.min(b.size,65536)).arrayBuffer()); let h=2166136261;
  for(let i=0;i<u.length;i+=97) h=Math.imul(h^u[i],16777619); return b.size+':'+(h>>>0); }
async function dataHash(){ const ph=[], bg=[];
  for(const c of cards){ try{ const b=await photoGet(c.id); if(b&&b.size) ph.push(c.id+':'+b.size); }catch(e){}
    try{ const b=await bgGet(c.id); if(b&&b.size) bg.push(c.id+':'+await blobMark(b)); }catch(e){} }
  const rows=[...cards].sort((x,y)=>x.id<y.id?-1:1).map(c=>{ const row=[c.id,c.name,String(c.number),c.format,c.color,c.display||'',!!c.pin,c.order||0];
    if(c.bg) row.push(1,c.crop?[c.crop.s,c.crop.x,c.crop.y]:null,c.tone||''); return row; });
  const payload=[rows, ph.sort(), !!localStorage.getItem('manualOrder')]; if(bg.length) payload.push(bg.sort());
  return String(hash(JSON.stringify(payload))); }
async function buildBackup(){ const photos={}, backgrounds={};
  for(const c of cards){ try{ const b=await photoGet(c.id); if(b&&b.size) photos[c.id]=await blobToDataURL(b); }catch(e){}
    if(c.bg) try{ const b=await bgGet(c.id); if(b&&b.size) backgrounds[c.id]=await blobToDataURL(b); }catch(e){} }
  const now=new Date().toISOString();
  const data={app:'kartochki',format:1,created:now,savedAt:now,version:APP_V,cards:cards.map(c=>({...c})),photos,backgrounds,
    settings:{manualOrder:localStorage.getItem('manualOrder')?1:0}};
  const f=new File([JSON.stringify(data)],BK_NAME,{type:'application/json'}); f._hash=await dataHash(); return f; }
let bkFile=null, bkP=null;
function prepBackup(){ bkFile=null; bkP=buildBackup().then(f=>bkFile=f).catch(()=>null); return bkP; }
function markSaved(f){ try{ localStorage.setItem('bkHash',f._hash); localStorage.setItem('bkAt',Date.now()); }catch(e){} }
async function saveBackup(force){ // called straight from a tap: share must start without long awaits (iOS gesture rule)
  hideOffer(); let f=bkFile; if(!f){ await (bkP||prepBackup()); f=bkFile; } if(!f){ toast('Не получилось собрать копию'); return; }
  if(!force && f._hash===localStorage.getItem('bkHash')){ showPill('Копия уже актуальна','Сохранить ещё раз','force','Ок'); return; }
  const done=()=>{ markSaved(f); toast(localStorage.getItem('bkHint')?'Копия сохранена':'Сохранено. В следующий раз — в ту же папку и «Заменить»'); localStorage.setItem('bkHint','1'); prepBackup(); };
  const shareData={files:[f]}; // exactly one item: with title/text iOS treats it as 2 objects and skips «Заменить»
  try{ if(navigator.canShare && navigator.canShare(shareData)){ await navigator.share(shareData); done(); return; } }
  catch(e){ if(e&&e.name==='AbortError') return; }
  const u=URL.createObjectURL(f), l=document.createElement('a'); l.href=u; l.download=BK_NAME; document.body.appendChild(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),30000);
  done(); }
function validBackup(d){ return d && d.app==='kartochki' && Array.isArray(d.cards) && d.cards.every(c=>c && typeof c.id==='string' && c.id && typeof c.name==='string' && c.number!=null && typeof c.format==='string' && String(c.number).length<=4096); }
const bkTime=d=>Date.parse(d.savedAt||d.created||'')||0;
function fmtWhen(t){ if(!t) return ''; try{ return new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
async function readBackup(file){ if(!file||file.size>30*1024*1024) return null; try{ const d=JSON.parse(await file.text()); return validBackup(d)?d:null; }catch(e){ return null; } }
async function restoreFrom(files){ // one or several files: the newest copy wins, whatever the file is called
  files=[].concat(files||[]).filter(Boolean); if(!files.length) return;
  if(files.length===1 && files[0].size>30*1024*1024){ toast('Файл слишком большой'); return; }
  const all=(await Promise.all(files.map(readBackup))).filter(Boolean);
  if(!all.length){ toast('Это не копия «Карточек»'); return; }
  const d=all.sort((x,y)=>bkTime(y)-bkTime(x))[0];
  const byId=new Map(cards.map(c=>[c.id,c])); let add=0, upd=0;
  const sameCard=new Set(cards.map(c=>c.format+'|'+String(c.number))); // a re-added card (new id, same code) is not a duplicate
  const plan=d.cards.map(b=>{ const l=byId.get(b.id); if(!l){ if(sameCard.has(b.format+'|'+String(b.number))) return null; add++; return b; } if((b.upd||0)>(l.upd||0)){ upd++; return b; } return null; }).filter(Boolean);
  const when=fmtWhen(bkTime(d));
  if(!plan.length){ toast('Всё уже есть — менять нечего'); return; }
  const ok=await confirmBox(`Копия${when?` от ${when}`:''}: ${add} новых${upd?`, ${upd} обновить`:''}. Восстановить? Остальные карты останутся.`); if(!ok) return;
  for(const b of plan){ const c={id:b.id,order:b.order??cards.length,uses:b.uses||0,name:b.name,number:String(b.number),format:b.format,color:/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color:PALETTE[0],display:b.display||''};
    if(b.pin) c.pin=true; if(b.upd) c.upd=b.upd; if(b.last) c.last=b.last;
    if(b.bg){ const bw=+b.bw, bh=+b.bh; if(bw>1&&bw<10000) c.bw=Math.round(bw); if(bh>1&&bh<10000) c.bh=Math.round(bh);
      c.bg=1; c.crop=clampCrop(b.crop, c.bw, c.bh); if(b.tone==='light'||b.tone==='dark') c.tone=b.tone; }
    try{ await save(c); }catch(e){ continue; }
    const i=cards.findIndex(x=>x.id===c.id); if(i>=0) cards[i]=c; else cards.push(c);
    const p=d.photos&&d.photos[c.id]; if(typeof p==='string'&&p.startsWith('data:image/')) try{ const bl=await dataURLToBlob(p); await photoPut(c.id,bl); photoURLs[c.id]=URL.createObjectURL(bl); }catch(e){}
    if(c.bg){ const g=d.backgrounds&&d.backgrounds[c.id]; let ok=false;
      if(typeof g==='string'&&g.startsWith('data:image/')) try{ const bl=await dataURLToBlob(g);
        if(bl&&bl.size&&await bgPut(c.id,bl)){ if(bgURLs[c.id]) URL.revokeObjectURL(bgURLs[c.id]); bgURLs[c.id]=URL.createObjectURL(bl); delete bgMiss[c.id]; ok=true; }
      }catch(e){}
      if(!ok){ delete c.bg; delete c.crop; delete c.bw; delete c.bh; delete c.tone; await bgPut(c.id,null);
        if(bgURLs[c.id]){ URL.revokeObjectURL(bgURLs[c.id]); delete bgURLs[c.id]; } try{ await save(c); }catch(e){} }
    } else { await bgPut(c.id,null); if(bgURLs[c.id]){ URL.revokeObjectURL(bgURLs[c.id]); delete bgURLs[c.id]; } } }
  if(d.settings&&d.settings.manualOrder) localStorage.setItem('manualOrder','1');
  localStorage.setItem('seeded','1'); render(); setTimeout(warmCodes,300); haptic('success'); toast(`Готово: ${add} новых${upd?`, ${upd} обновлено`:''}`); setTimeout(offerBackup,1900); }
$('#restoreIn').onchange=e=>{ const f=[...e.target.files]; e.target.value=''; restoreFrom(f); };
// gentle reminder after every real change (differs from the last saved copy); one pill, restarted, never stacked
let offerT=0, pillAct='save';
function showPill(text,primary,act,second){ const o=$('#bkOffer'); o.querySelector('span').textContent=text; const [b1,b2]=o.querySelectorAll('button'); b1.textContent=primary; b2.textContent=second||'Позже'; pillAct=act;
  o.classList.add('on'); clearTimeout(offerT); offerT=setTimeout(hideOffer,7000); }
async function offerBackup(){ if(inTG) return; const h=await dataHash(); if(h===localStorage.getItem('bkHash')){ hideOffer(); return; }
  prepBackup(); showPill('Обновить копию в Файлах?','Сохранить','save'); }
function hideOffer(){ clearTimeout(offerT); $('#bkOffer').classList.remove('on'); }
$('#bkOffer').addEventListener('click',e=>{ const b=e.target.closest('[data-b]'); if(!b) return; if(b.dataset.b==='save') saveBackup(pillAct==='force'); else hideOffer(); });
window.__app.art={prepareArt,clampCrop,bgMetrics,bgStyle,panCrop,zoomCrop,jpegOrientation,jpegSize,ART_MAX,ART_EDGE,artMessage,
  session:()=>artS?{mode:artS.mode,rev:artS.rev,crop:artS.crop?{...artS.crop}:null,w:artS.w,h:artS.h,color:artS.color,bytes:artS.blob?artS.blob.size:0,tone:artS.tone}:null,
  draft:()=>({mode:draft.artMode,rev:draft.artRev,crop:draft.artCrop?{...draft.artCrop}:null,color:draft.color,bytes:draft.artBlob?draft.artBlob.size:0,touched:!!draft.artTouched,tone:draft.artTone})};
window.__app.backup={buildBackup,restoreFrom,validBackup,photoPut,photoGet,dataHash,bgPut,bgGet,resetStore};
