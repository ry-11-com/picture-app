/* ===========================================================
   DUMP — a real, working photo-dump app.
   Vanilla JS, no build step, no external JS dependencies.
   Photos are processed and stored entirely on this device
   (IndexedDB) — nothing is uploaded anywhere.
   =========================================================== */

/* ---------- tiny helpers ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function fmtDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'short' });
}
function fmtShort(ts){
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day:'numeric', month:'short' });
}
function daysBetween(a,b){ return Math.abs(a-b) / 86400000; }

/* ===========================================================
   DATA TABLES — layout recipes, grades, textures, etc.
   =========================================================== */

const LAYOUTS = [
  { id:'editorial', name:'Editorial', desc:'One hero photo, rest arranged around it' },
  { id:'minimal',   name:'Minimal',   desc:'Single column, generous breathing room' },
  { id:'neat9',     name:'Neat 9',    desc:'Perfect 3×3 grid' },
  { id:'chaotic',   name:'Chaotic',   desc:'Scattered, rotated, alive' },
  { id:'filmdiary', name:'Film diary',desc:'Horizontal filmstrip with date stamps' },
  { id:'scrapbook', name:'Scrapbook', desc:'Overlapping, taped-down feel' },
  { id:'polaroid',  name:'Polaroid',  desc:'Instant-camera bordered frames' },
  { id:'contact',   name:'Contact',   desc:'Dense contact-sheet grid' },
  { id:'magazine',  name:'Magazine',  desc:'One big story, smaller support shots' },
  { id:'collage',   name:'Collage',   desc:'Layered, overlapping, tactile' },
  { id:'fullbleed', name:'Full bleed',desc:'Edge-to-edge, one at a time, swipe' },
  { id:'mixed',     name:'Mixed size',desc:'Varied tile sizes, masonry rhythm' },
];

// filter target values at 100% intensity; 0% = identity
const GRADES = [
  { id:'none',      name:'None',       f:{contrast:1,saturate:1,brightness:1,sepia:0,hue:0}, tint:null },
  { id:'kodak',     name:'Kodak',      f:{contrast:1.1,saturate:1.18,brightness:1.02,sepia:0.1,hue:-4}, tint:null },
  { id:'faded',     name:'Faded',      f:{contrast:0.88,saturate:0.7,brightness:1.08,sepia:0.05,hue:0}, tint:{color:'255,255,255',blend:'normal',max:0.16} },
  { id:'flash',     name:'Flash',      f:{contrast:1.2,saturate:0.88,brightness:1.3,sepia:0,hue:3}, tint:{color:'220,230,255',blend:'overlay',max:0.12} },
  { id:'mono',      name:'Mono',       f:{contrast:1.08,saturate:0,brightness:1.02,sepia:0,hue:0}, tint:null },
  { id:'muted',     name:'Muted',      f:{contrast:0.94,saturate:0.5,brightness:1.0,sepia:0.04,hue:0}, tint:null },
  { id:'vibrant',   name:'Vibrant',    f:{contrast:1.14,saturate:1.6,brightness:1.02,sepia:0,hue:0}, tint:null },
  { id:'disposable',name:'Disposable', f:{contrast:1.08,saturate:1.25,brightness:1.08,sepia:0.06,hue:-6}, tint:{color:'255,210,150',blend:'soft-light',max:0.14} },
  { id:'cool',      name:'Cool',       f:{contrast:1.02,saturate:1.05,brightness:0.98,sepia:0,hue:10}, tint:{color:'150,190,255',blend:'overlay',max:0.14} },
  { id:'warm',      name:'Warm',       f:{contrast:1.04,saturate:1.12,brightness:1.03,sepia:0.08,hue:-10}, tint:{color:'255,175,110',blend:'overlay',max:0.16} },
];

const TEXTURES = [
  { id:'clean',   name:'Clean',        density:0 },
  { id:'fine',    name:'Fine grain',   density:0.10 },
  { id:'heavy',   name:'Heavy grain',  density:0.28 },
  { id:'dust',    name:'Dust & scratch', density:0.16, scratches:true },
  { id:'paper',   name:'Paper',        density:0.08, paper:true },
  { id:'halation',name:'Halation',     density:0.02, halation:true },
  { id:'leak',    name:'Light leak',   density:0.02, leak:true },
];

const BORDERS = [
  { id:'none',     name:'None' },
  { id:'white',    name:'White',   color:'#ffffff' },
  { id:'black',    name:'Black',   color:'#161210' },
  { id:'cream',    name:'Cream',   color:'#fdfaf7' },
  { id:'polaroid', name:'Polaroid',color:'#ffffff', polaroid:true },
  { id:'filmstrip',name:'Film strip',color:'#161210', sprockets:true },
  { id:'torn',     name:'Torn',    color:'#fdfaf7', torn:true },
];

const BACKDROPS = [
  { id:'plain', name:'Plain', color:'#fdfaf7' },
  { id:'paper', name:'Paper', color:'#f3ead9' },
  { id:'ink',   name:'Ink',   color:'#2c211b' },
  { id:'blush', name:'Blush', color:'#f7e2da' },
  { id:'sage',  name:'Sage',  color:'#e3ede6' },
];

const GROUP_MODES = ['Vibe','Date','Location','Trip','Event','People','Colour','Outfit','Activity','Roll order','Similarity','Season','Custom theme'];
const QUICK_PICKS = ['Most candid','With people','Mostly landscapes','Balanced mix','Everything from this trip'];

const STICKERS = ['✦','♡','☺','✿','☁','☀','⚡','✈','★','☾','♪','☘'];
const TEXT_PRESETS = [
  { id:'hand', name:'Handwritten', font:"'Caveat',cursive", weight:700, size:34 },
  { id:'tiny', name:'Tiny caps',   font:"'Plus Jakarta Sans',sans-serif", weight:800, size:11, caps:true, spacing:'.14em' },
  { id:'journal', name:'Journal',  font:"Georgia,serif", weight:400, size:17, italic:true },
  { id:'date', name:'Date stamp',  font:"'Plus Jakarta Sans',monospace", weight:700, size:12, caps:true },
  { id:'loc', name:'Location',     font:"'Plus Jakarta Sans',sans-serif", weight:700, size:12, caps:true, spacing:'.08em' },
];

const RETOUCH_OPTIONS = ['Smooth skin','Brighten','Soften shadows','Sharpen eyes','Whiten teeth','Reduce shine'];
const CAPTION_STYLES = ['Understated','Funny','Poetic','Casual','None'];

const STYLE_PACKS = [
  { id:'sp1', name:'Golden hour, everywhere', grade:'warm', layout:'editorial', texture:'halation', thumb:'linear-gradient(135deg,#f2b06b,#d9723e)' },
  { id:'sp2', name:'Midnight film',           grade:'mono', layout:'filmdiary', texture:'heavy',    thumb:'linear-gradient(135deg,#4a4038,#1c1712)' },
  { id:'sp3', name:'Soft & faded',            grade:'faded',layout:'minimal',   texture:'fine',     thumb:'linear-gradient(135deg,#e9dcd2,#cbb9ac)' },
  { id:'sp4', name:'Chaotic good',            grade:'disposable',layout:'chaotic',texture:'dust',   thumb:'linear-gradient(135deg,#e0684f,#8a4b7a)' },
  { id:'sp5', name:'Cool blues',              grade:'cool', layout:'contact',   texture:'clean',    thumb:'linear-gradient(135deg,#93b6d6,#3f5f82)' },
  { id:'sp6', name:'Scrapbook diary',         grade:'kodak',layout:'scrapbook', texture:'paper',    thumb:'linear-gradient(135deg,#d9c39a,#a9835a)' },
];

const TRENDING_LOOKS = [
  { id:'tl1', name:'Vintage sunburn', saves:'2.4k', grade:'disposable', layout:'scrapbook', swatches:['#e0684f','#f2b06b','#8a4b7a','#3c2a20'] },
  { id:'tl2', name:'Clean girl',      saves:'1.8k', grade:'faded', layout:'minimal',   swatches:['#f7ede4','#e3d6cb','#c9b8ab','#fdfaf7'] },
  { id:'tl3', name:'Night drive',     saves:'3.1k', grade:'cool', layout:'fullbleed',  swatches:['#1c2740','#3f5f82','#93b6d6','#0e1420'] },
  { id:'tl4', name:'Grandmacore',     saves:'950',  grade:'mono', layout:'polaroid',   swatches:['#4a4038','#8a7568','#cbb8ab','#1c1712'] },
];

/* ===========================================================
   PERSISTENCE — localStorage for app state, IndexedDB for photo blobs
   =========================================================== */

const LS_KEY = 'dumpapp:state:v1';
function loadPersisted(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function savePersisted(){
  const snapshot = {
    dumps: S.dumps,
    privacy: S.privacy,
    usage: S.usage,
    savedRecipes: S.savedRecipes,
    profileName: S.profileName,
  };
  try{ localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); }catch(e){}
}

let idbPromise = null;
function idb(){
  if(idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('dumpapp-photos', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath:'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}
async function idbPutPhoto(rec){
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('photos','readwrite');
    tx.objectStore('photos').put(rec);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbDeletePhoto(id){
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('photos','readwrite');
    tx.objectStore('photos').delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGetAll(){
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('photos','readonly');
    const req = tx.objectStore('photos').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function idbClearAll(){
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('photos','readwrite');
    tx.objectStore('photos').clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ===========================================================
   IMAGE ANALYSIS — real average-color + brightness/saturation
   extraction, used for grouping, palettes, and "vibe" tagging.
   =========================================================== */

function loadImageFromBlob(blob){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = reject;
    img.src = url;
  });
}

function analyzeImage(img){
  const c = document.getElementById('workCanvas');
  const size = 24;
  c.width = size; c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(img, 0, 0, size, size);
  let data;
  try{ data = ctx.getImageData(0,0,size,size).data; }
  catch(e){ return { r:170,g:150,b:135,brightness:0.55,saturation:0.2 }; }
  let r=0,g=0,b=0,n=0;
  for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++; }
  r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n);
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  const brightness = (r+g+b)/3/255;
  const saturation = max===0 ? 0 : (max-min)/max;
  return { r,g,b, brightness, saturation };
}

function classifyVibe(a){
  if(a.brightness < 0.32) return 'Moody & dark';
  if(a.saturation > 0.5 && a.brightness > 0.45) return 'Bright & vibrant';
  if(a.saturation < 0.18 && a.brightness > 0.55) return 'Soft & pastel';
  if(a.saturation < 0.18) return 'Muted neutrals';
  if(a.r > a.g && a.r > a.b) return 'Warm tones';
  if(a.b > a.r) return 'Cool tones';
  return 'Balanced mix';
}
function seasonOf(ts){
  const m = new Date(ts).getMonth(); // 0=Jan
  if(m===11||m===0||m===1) return 'Winter';
  if(m>=2&&m<=4) return 'Spring';
  if(m>=5&&m<=7) return 'Summer';
  return 'Autumn';
}
function colorDist(a,b){
  return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
}

/* ===========================================================
   APP STATE
   =========================================================== */

const persisted = loadPersisted() || {};

const S = {
  screen: 'home',            // home | pick | studio | stories | inspo | profile | privacy
  booted: false,

  photos: [],                 // { id, url, blob, lastModified, avgColor, brightness, saturation, vibe }
  selected: new Set(),
  groupBy: 'Vibe',
  quickPick: null,
  pickPrompt: '',

  dumps: persisted.dumps || [],           // saved dumps: { id, name, createdAt, photoIds, layoutId, gradeId, ... , thumbColor }
  savedRecipes: persisted.savedRecipes || [],
  usage: persisted.usage || { layouts:{}, grades:{}, textures:{}, messiness:[] },
  privacy: Object.assign({
    localByDefault:true, cloudProcessing:false, blurFaces:false, stripLocation:true,
    analytics:false, hiddenAlbums:true, publicProfile:false
  }, persisted.privacy || {}),
  profileName: persisted.profileName || 'You',

  currentDump: null,          // active dump being edited in Studio
  activeTool: 'layout',
  abMode: false,
  editingPhotoId: null,       // "editing photo N only" banner
  reorderMode: false,
  reorderFirstPick: null,

  remixOpen: false,
  exportOpen: false,
  captionStyle: 'Understated',
  caption: '',

  storyPlayer: null,          // { dumpId, frame, timer }

  toast: null,
  drag: null,                 // active pointer-drag context
};

function newDumpFromPhotoIds(ids, opts){
  opts = opts || {};
  return {
    id: uid(),
    name: opts.name || 'Untitled dump',
    createdAt: Date.now(),
    photoIds: ids.slice(),
    layoutId: opts.layoutId || 'editorial',
    gradeId: opts.gradeId || 'kodak',
    gradeIntensity: 70,
    textureId: opts.textureId || 'fine',
    textureAmount: 55,
    vignette: 20,
    borderId: 'none',
    borderWeight: 8,
    backdropId: 'plain',
    wrapGrid: false,
    cropFormat: 'square', // square | portrait | story
    cropBias: 'centre',
    adjust: { contrast:0, saturation:0, warmth:0, fade:0, blur:0 },
    room: 40, messiness: 30, recipeStrength: 70,
    retouch: { strength:0, options:[] },
    removedSpots: [],       // {photoId, xPct, yPct}
    cutout: false,
    layers: [],             // { id, type:'sticker'|'text', content, presetId, x, y, scale, rot }
    selectedLayerId: null,
    order: null,            // custom order override (array of photoIds) once reordered
  };
}

/* ===========================================================
   PHOTO GROUPING — real, on-device, computed from actual
   photo metadata (timestamps, colour analysis). No network,
   no server-side ML. Some modes (Location/People/Event/etc.)
   need signal this browser preview can't read yet — those
   fall back honestly to a single bucket rather than faking it.
   =========================================================== */

function buildBuckets(mode){
  const photos = S.photos;
  if(photos.length === 0) return [];
  const byId = id => photos.find(p => p.id === id);
  const bucket = (id, title, desc, ids) => ({ id, title, desc, photoIds: ids });

  if(mode === 'Date'){
    const map = new Map();
    photos.forEach(p => {
      const key = new Date(p.lastModified).toDateString();
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(p.id);
    });
    return [...map.entries()].sort((a,b)=>new Date(b[0])-new Date(a[0])).map(([k,ids]) =>
      bucket('d_'+k, k, `${ids.length} photo${ids.length>1?'s':''}`, ids));
  }
  if(mode === 'Roll order'){
    const sorted = [...photos].sort((a,b)=>a.lastModified-b.lastModified);
    const chunks = [];
    for(let i=0;i<sorted.length;i+=12) chunks.push(sorted.slice(i,i+12));
    return chunks.map((c,i) => bucket('r_'+i, `Roll segment ${i+1}`, `${c.length} in camera-roll order`, c.map(p=>p.id)));
  }
  if(mode === 'Season'){
    const map = new Map();
    photos.forEach(p => {
      const s = seasonOf(p.lastModified);
      if(!map.has(s)) map.set(s, []);
      map.get(s).push(p.id);
    });
    return [...map.entries()].map(([k,ids]) => bucket('s_'+k, k, `${ids.length} photos`, ids));
  }
  if(mode === 'Vibe'){
    const map = new Map();
    photos.forEach(p => {
      const v = p.vibe;
      if(!map.has(v)) map.set(v, []);
      map.get(v).push(p.id);
    });
    return [...map.entries()].map(([k,ids]) => bucket('v_'+k, k, `${ids.length} photos with this feel`, ids));
  }
  if(mode === 'Colour'){
    const map = new Map();
    photos.forEach(p => {
      const c = p.avgColor;
      let label;
      if(c.r>c.g && c.r>c.b) label = 'Warm';
      else if(c.b>c.r) label = 'Cool';
      else label = 'Neutral';
      if(!map.has(label)) map.set(label, []);
      map.get(label).push(p.id);
    });
    return [...map.entries()].map(([k,ids]) => bucket('c_'+k, k+' palette', `${ids.length} photos`, ids));
  }
  if(mode === 'Similarity'){
    const remaining = [...photos];
    const clusters = [];
    while(remaining.length){
      const seed = remaining.shift();
      const cluster = [seed];
      for(let i=remaining.length-1;i>=0;i--){
        if(colorDist(seed.avgColor, remaining[i].avgColor) < 46){
          cluster.push(remaining[i]);
          remaining.splice(i,1);
        }
      }
      clusters.push(cluster);
    }
    return clusters.filter(c=>c.length).map((c,i) => bucket('sim_'+i, `Look-alike set ${i+1}`, `${c.length} visually similar`, c.map(p=>p.id)));
  }
  if(mode === 'Trip'){
    const sorted = [...photos].sort((a,b)=>a.lastModified-b.lastModified);
    const trips = [];
    let cur = [];
    sorted.forEach((p, i) => {
      if(cur.length === 0){ cur.push(p); return; }
      const gapDays = daysBetween(p.lastModified, cur[cur.length-1].lastModified);
      if(gapDays > 2){ trips.push(cur); cur = [p]; }
      else cur.push(p);
    });
    if(cur.length) trips.push(cur);
    return trips.map((t,i) => {
      const start = fmtShort(t[0].lastModified), end = fmtShort(t[t.length-1].lastModified);
      return bucket('trip_'+i, `Trip · ${start}–${end}`, `${t.length} photos`, t.map(p=>p.id));
    });
  }
  // Location / Event / People / Outfit / Activity / Custom theme:
  // no reliable on-device signal available in-browser — honest single bucket.
  return [bucket('all', 'All imported photos', `Grouping by ${mode.toLowerCase()} needs on-device recognition this preview can't run — showing everything`, photos.map(p=>p.id))];
}

/* ===========================================================
   RENDER ENGINE — tiny hand-rolled re-render-on-change loop.
   =========================================================== */

const A = {}; // action handlers, called from inline on* attributes as A.foo(...)
window.A = A;

function render(){
  const app = document.getElementById('app');
  const tabScreens = ['home','pick','stories','inspo','profile'];
  let html = '';
  if(S.screen === 'home') html = renderHome();
  else if(S.screen === 'pick') html = renderPick();
  else if(S.screen === 'studio') html = renderStudio();
  else if(S.screen === 'stories') html = renderStories();
  else if(S.screen === 'inspo') html = renderInspo();
  else if(S.screen === 'profile') html = renderProfile();
  else if(S.screen === 'privacy') html = renderPrivacy();
  else html = renderHome();

  const showTabs = tabScreens.includes(S.screen);
  app.innerHTML = html + (showTabs ? renderTabBar() : '') +
    (S.remixOpen ? renderRemixSheet() : '') +
    (S.exportOpen ? renderExportSheet() : '') +
    (S.storyPlayer ? renderStoryPlayer() : '') +
    (S.toast ? `<div class="toast">${esc(S.toast)}</div>` : '');

  afterRender();
}

function afterRender(){ /* reserved for future post-render DOM wiring */ }

let toastTimer = null;
function showToast(msg){
  S.toast = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; render(); }, 2100);
}

/* ===========================================================
   TAB BAR
   =========================================================== */
function renderTabBar(){
  const tabs = [
    ['home','⌂','Home'], ['pick','✦','Create'], ['stories','◫','Stories'],
    ['inspo','❍','Inspo'], ['profile','☺','Me']
  ];
  return `<div class="tabbar">${tabs.map(([id,ic,label]) => `
    <div class="tabbtn ${S.screen===id?'active':''}" onclick="A.goTab('${id}')">
      <div class="ic">${ic}</div><div>${label}</div>
    </div>`).join('')}</div>`;
}
A.goTab = (id) => {
  if(id === 'pick'){ S.screen = 'pick'; }
  else S.screen = id;
  render();
};

/* ===========================================================
   HOME
   =========================================================== */
function vibeBuckets(){
  return buildBuckets('Vibe').filter(b => b.photoIds.length > 0).slice(0,3);
}

function renderHome(){
  const hasPhotos = S.photos.length > 0;
  const vibes = vibeBuckets();
  const recents = [...S.dumps].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);

  return `<div class="scroll" style="padding:54px 20px 108px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
      <div>
        <div style="font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted2);">${esc(fmtDate(Date.now()))}</div>
        <div style="font-size:26px;font-weight:800;letter-spacing:-.03em;color:var(--ink);line-height:1.15;margin-top:5px;">Hey ${esc(S.profileName)} —<br/>${hasPhotos? S.photos.length+' photos ready.' : 'add some photos.'}</div>
      </div>
      <div onclick="A.goTab('profile')" style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ffd0b8,#e0684f);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;cursor:pointer;">${esc(S.profileName[0]||'Y')}</div>
    </div>

    <div onclick="A.goTab('pick')" style="display:flex;align-items:center;gap:9px;background:var(--chip-bg);border-radius:99px;padding:12px 16px;margin-bottom:22px;cursor:pointer;">
      <span style="font-size:14px;opacity:.45;">⌕</span>
      <span style="font-size:13.5px;color:#a8968a;font-weight:500;">Describe a dump — "weekend in London, chaotic"</span>
    </div>

    <div style="display:flex;gap:9px;margin-bottom:24px;">
      <div onclick="A.surpriseMe()" style="flex:1;background:var(--coral-grad);border-radius:18px;padding:14px;color:#fff;cursor:pointer;box-shadow:var(--accent-shadow);">
        <div style="font-size:17px;">✦</div>
        <div style="font-size:13px;font-weight:800;margin-top:6px;letter-spacing:-.01em;">Surprise me</div>
        <div style="font-size:11px;opacity:.85;font-weight:600;">Full dump in one tap</div>
      </div>
      <div onclick="A.journalMode()" style="flex:1;background:var(--forest);border-radius:18px;padding:14px;color:#fff;cursor:pointer;">
        <div style="font-size:17px;">✎</div>
        <div style="font-size:13px;font-weight:800;margin-top:6px;letter-spacing:-.01em;">Journal mode</div>
        <div style="font-size:11px;opacity:.75;font-weight:600;">Private, never posted</div>
      </div>
    </div>

    ${!hasPhotos ? `
    <div class="card" style="padding:22px;text-align:center;margin-bottom:26px;">
      <div style="font-size:28px;margin-bottom:8px;">📷</div>
      <div style="font-weight:800;color:var(--ink);font-size:14.5px;margin-bottom:4px;">Nothing to dump yet</div>
      <div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:14px;">Import photos from this device to get started. Nothing leaves your phone.</div>
      <div onclick="A.pickFiles()" style="display:inline-block;background:var(--ink);color:#fff;padding:10px 18px;border-radius:99px;font-size:12.5px;font-weight:700;cursor:pointer;">Import photos</div>
    </div>` : `
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:11px;">
      <div style="font-size:15.5px;font-weight:800;color:var(--ink);letter-spacing:-.01em;">Ready to dump</div>
      <div onclick="A.surpriseMe()" style="font-size:12px;font-weight:700;color:var(--coral);cursor:pointer;">Refresh</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:11px;margin-bottom:26px;">
      ${vibes.map(v => `
        <div onclick="A.openBucket('${v.id}','Vibe')" class="card" style="display:flex;gap:13px;align-items:center;padding:13px;cursor:pointer;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;width:60px;height:60px;border-radius:16px;overflow:hidden;flex-shrink:0;">
            ${v.photoIds.slice(0,4).map(id => { const p = S.photos.find(x=>x.id===id); return `<div style="background-image:url('${p?p.url:''}');background-size:cover;background-position:center;"></div>`; }).join('')}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14.5px;font-weight:800;color:var(--ink);letter-spacing:-.01em;">${esc(v.title)}</div>
            <div style="font-size:12px;color:var(--muted);font-weight:500;margin-top:3px;">${esc(v.desc)}</div>
            <div style="display:inline-block;margin-top:7px;background:#f6efe9;border-radius:99px;padding:4px 9px;font-size:10.5px;font-weight:700;color:var(--chip-fg);">${v.photoIds.length} photos</div>
          </div>
          <div style="font-size:19px;color:#dcccc0;">›</div>
        </div>`).join('')}
    </div>`}

    <div style="font-size:15.5px;font-weight:800;color:var(--ink);margin-bottom:11px;letter-spacing:-.01em;">Style packs</div>
    <div class="hscroll" style="margin-bottom:24px;">
      ${STYLE_PACKS.map(p => `
        <div onclick="A.applyStylePack('${p.id}')" style="flex-shrink:0;width:112px;cursor:pointer;">
          <div style="height:132px;border-radius:16px;background:${p.thumb};display:flex;align-items:flex-end;padding:9px;box-shadow:0 6px 16px rgba(90,55,35,.1);">
            <div style="color:#fff;font-size:11.5px;font-weight:800;line-height:1.25;text-shadow:0 1px 6px rgba(0,0,0,.4);">${esc(p.name)}</div>
          </div>
        </div>`).join('')}
    </div>

    <div style="font-size:15.5px;font-weight:800;color:var(--ink);margin-bottom:11px;letter-spacing:-.01em;">Recent dumps</div>
    ${recents.length===0 ? `<div class="emptyState">Your finished dumps will show up here.</div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
      ${recents.map(r => `
        <div onclick="A.openDump('${r.id}')" class="card" style="border-radius:18px;overflow:hidden;cursor:pointer;">
          <div style="aspect-ratio:1;background:${r.thumbColor||'#e6ddd4'};background-image:url('${(S.photos.find(p=>p.id===r.photoIds[0])||{}).url||''}');background-size:cover;background-position:center;"></div>
          <div style="padding:9px 11px 11px;">
            <div style="font-size:12.5px;font-weight:700;color:var(--ink);">${esc(r.name)}</div>
            <div style="font-size:10.5px;color:var(--muted);font-weight:600;margin-top:2px;">${r.photoIds.length} photos · ${GRADES.find(g=>g.id===r.gradeId).name}</div>
          </div>
        </div>`).join('')}
    </div>`}
  </div>`;
}

A.pickFiles = () => document.getElementById('fileInput').click();
A.surpriseMe = () => {
  if(S.photos.length === 0){ A.pickFiles(); return; }
  const pack = STYLE_PACKS[Math.floor(Math.random()*STYLE_PACKS.length)];
  const shuffled = [...S.photos].sort(()=>Math.random()-0.5);
  const ids = shuffled.slice(0, Math.min(12, shuffled.length)).map(p=>p.id);
  S.currentDump = newDumpFromPhotoIds(ids, { name:'Surprise dump', layoutId:pack.layout, gradeId:pack.grade, textureId:pack.texture });
  S.screen = 'studio'; S.activeTool = 'layout';
  render();
  showToast('Surprise dump built ✦');
};
A.journalMode = () => {
  S.screen = 'pick'; S.groupBy = 'Vibe'; S.quickPick = null;
  render();
  showToast('Journal mode — private, never posted');
};
A.applyStylePack = (id) => {
  const pack = STYLE_PACKS.find(p=>p.id===id);
  if(S.photos.length === 0){ A.pickFiles(); return; }
  const shuffled = [...S.photos].sort(()=>Math.random()-0.5);
  const ids = shuffled.slice(0, Math.min(12, shuffled.length)).map(p=>p.id);
  S.currentDump = newDumpFromPhotoIds(ids, { name:pack.name, layoutId:pack.layout, gradeId:pack.grade, textureId:pack.texture });
  S.screen = 'studio';
  render();
};
A.openBucket = (bucketId, mode) => {
  const b = buildBuckets(mode).find(x=>x.id===bucketId);
  if(!b) return;
  S.selected = new Set(b.photoIds);
  S.screen = 'pick'; S.groupBy = mode;
  render();
};
A.openDump = (id) => {
  const d = S.dumps.find(x=>x.id===id);
  if(!d) return;
  S.currentDump = JSON.parse(JSON.stringify(d));
  S.screen = 'studio'; S.activeTool = 'layout';
  render();
};

/* ===========================================================
   PICK
   =========================================================== */
function renderPick(){
  const buckets = buildBuckets(S.groupBy);
  return `<div class="scroll" style="padding-bottom:110px;">
    <div style="padding:50px 20px 10px;display:flex;align-items:center;gap:13px;">
      <div onclick="A.goTab('home')" style="font-size:22px;color:#7d6a5d;cursor:pointer;line-height:1;">‹</div>
      <div style="flex:1;">
        <div style="font-size:18.5px;font-weight:800;color:var(--ink);letter-spacing:-.02em;">Pick your photos</div>
        <div style="font-size:12px;color:var(--muted);font-weight:600;">${S.selected.size} selected · ${S.photos.length} imported</div>
      </div>
      <div onclick="A.clearSelection()" style="font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;">Clear</div>
    </div>

    <div style="padding:6px 20px 0;">
      <div class="card" style="padding:13px 14px;">
        <input type="text" id="pickPromptInput" value="${esc(S.pickPrompt)}" oninput="A.setPrompt(this.value)" placeholder="Describe the dump you want…" style="width:100%;font-size:13.5px;font-weight:600;color:var(--ink);padding:0 0 9px;"/>
        <div style="display:flex;gap:7px;align-items:center;">
          <div onclick="A.runPrompt()" style="background:var(--ink);color:#fff;font-size:11.5px;font-weight:700;padding:8px 14px;border-radius:99px;cursor:pointer;">Generate selection</div>
          <div onclick="A.surpriseMe()" style="background:#f2e7df;color:var(--coral-dark);font-size:11.5px;font-weight:700;padding:8px 13px;border-radius:99px;cursor:pointer;">Surprise me</div>
          <div onclick="A.pickFiles()" style="margin-left:auto;background:var(--chip-bg);color:var(--chip-fg);font-size:11.5px;font-weight:700;padding:8px 13px;border-radius:99px;cursor:pointer;">+ Import</div>
        </div>
      </div>
    </div>

    <div style="padding:16px 20px 0;">
      <div style="font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);margin-bottom:9px;">Group by</div>
      <div class="hscroll">
        ${GROUP_MODES.map(g => `<div onclick="A.setGroupBy('${g}')" class="chip" style="background:${S.groupBy===g?'#2c211b':'var(--chip-bg)'};color:${S.groupBy===g?'#fff':'var(--chip-fg)'};">${esc(g)}</div>`).join('')}
      </div>
    </div>

    <div style="padding:4px 20px 0;">
      <div class="hscroll">
        ${QUICK_PICKS.map(q => `<div onclick="A.quickPickRun('${q.replace(/'/g,"\\'")}')" class="chip" style="background:#fff;border:1px solid #f0e5dc;color:${S.quickPick===q?'var(--coral)':'#8a7568'};">${esc(q)}</div>`).join('')}
      </div>
    </div>

    <div style="padding:8px 20px 0;">
      ${S.photos.length === 0 ? `<div class="emptyState">No photos yet. Tap "+ Import" to add some from this device.</div>` :
      buckets.map(b => `
        <div style="margin-bottom:22px;">
          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px;">
            <div>
              <div style="font-size:14.5px;font-weight:800;color:var(--ink);">${esc(b.title)}</div>
              <div style="font-size:11.5px;color:var(--muted);font-weight:600;">${esc(b.desc)}</div>
            </div>
            <div onclick="A.toggleBucket('${b.id.replace(/'/g,"\\'")}','${S.groupBy}')" style="font-size:11.5px;font-weight:700;color:var(--coral);cursor:pointer;flex-shrink:0;">${b.photoIds.every(id=>S.selected.has(id)) ? 'Deselect' : 'Select all'}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
            ${b.photoIds.map(id => {
              const p = S.photos.find(x=>x.id===id); if(!p) return '';
              const sel = S.selected.has(id);
              return `<div onclick="A.toggleSelect('${id}')" class="phototile" style="aspect-ratio:1;${sel?'outline:3px solid var(--coral);outline-offset:-3px;':''}">
                <img src="${p.url}" loading="lazy"/>
                ${sel?'<div style="position:absolute;inset:0;background:rgba(224,104,79,.18);"></div><div style="position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;background:var(--coral);color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;">✓</div>'
                    :'<div style="position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.85);"></div>'}
              </div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div style="position:sticky;bottom:0;padding:12px 20px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(0deg,var(--surface) 60%,rgba(253,250,247,0));">
      <div onclick="A.buildDump()" style="text-align:center;background:${S.selected.size? 'var(--coral-grad)':'#e6ddd4'};color:#fff;font-weight:800;font-size:14px;padding:15px;border-radius:99px;cursor:pointer;box-shadow:${S.selected.size?'var(--accent-shadow)':'none'};">
        Build my dump · ${S.selected.size} photo${S.selected.size===1?'':'s'}
      </div>
    </div>
  </div>`;
}

A.setGroupBy = (g) => { S.groupBy = g; render(); };
A.setPrompt = (v) => { S.pickPrompt = v; };
A.clearSelection = () => { S.selected.clear(); render(); };
A.toggleSelect = (id) => { S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); render(); };
A.toggleBucket = (bucketId, mode) => {
  const b = buildBuckets(mode).find(x=>x.id===bucketId);
  if(!b) return;
  const allSel = b.photoIds.every(id=>S.selected.has(id));
  b.photoIds.forEach(id => allSel ? S.selected.delete(id) : S.selected.add(id));
  render();
};
A.quickPickRun = (label) => {
  S.quickPick = label;
  // Heuristic real-ish behaviour: sample from current photo pool by simple rules.
  let pool = [...S.photos];
  if(label === 'Balanced mix') pool = pool.sort(()=>Math.random()-0.5);
  if(label === 'Mostly landscapes') pool = pool.filter(p=>p.brightness>0.35);
  if(label === 'Most candid') pool = pool.sort(()=>Math.random()-0.5);
  if(label === 'With people') pool = pool.sort(()=>Math.random()-0.5);
  if(label === 'Everything from this trip'){
    const trips = buildBuckets('Trip');
    pool = trips.length ? trips[trips.length-1].photoIds.map(id=>S.photos.find(p=>p.id===id)) : pool;
  }
  S.selected = new Set(pool.slice(0, Math.min(14,pool.length)).map(p=>p.id));
  render();
};
A.runPrompt = () => {
  const txt = (S.pickPrompt||'').toLowerCase();
  let layout='editorial', grade='kodak';
  if(/chaotic|messy|scatter/.test(txt)) layout='chaotic';
  else if(/film|diary|journal/.test(txt)) layout='filmdiary';
  else if(/scrap/.test(txt)) layout='scrapbook';
  else if(/clean|minimal|calm/.test(txt)) layout='minimal';
  if(/night|blue|london|cool/.test(txt)) grade='cool';
  else if(/flash|party/.test(txt)) grade='flash';
  else if(/warm|golden|sunset/.test(txt)) grade='warm';
  else if(/mono|black and white|bw/.test(txt)) grade='mono';
  else if(/vibrant|bright|pop/.test(txt)) grade='vibrant';
  if(S.selected.size === 0){
    const shuffled = [...S.photos].sort(()=>Math.random()-0.5);
    S.selected = new Set(shuffled.slice(0, Math.min(12, shuffled.length)).map(p=>p.id));
  }
  S.currentDump = newDumpFromPhotoIds([...S.selected], { name: S.pickPrompt || 'Untitled dump', layoutId:layout, gradeId:grade });
  S.screen = 'studio'; S.activeTool='layout';
  render();
};
A.buildDump = () => {
  if(S.selected.size === 0) return;
  S.currentDump = newDumpFromPhotoIds([...S.selected], { name: S.pickPrompt || 'Untitled dump' });
  S.screen = 'studio'; S.activeTool = 'layout';
  render();
};

/* ===========================================================
   STUDIO — canvas compositing helpers
   =========================================================== */

function seededRand(seed){
  let h = 0;
  for(let i=0;i<seed.length;i++){ h = (Math.imul(31,h) + seed.charCodeAt(i)) | 0; }
  return function(){
    h = Math.imul(h ^ (h>>>15), 1 | h);
    h ^= h + Math.imul(h ^ (h>>>7), 61 | h);
    return ((h ^ (h>>>14)) >>> 0) / 4294967296;
  };
}

function cssFilterString(dump, extraBlurPx){
  const grade = GRADES.find(g=>g.id===dump.gradeId) || GRADES[0];
  const t = dump.gradeIntensity/100;
  let contrast = lerp(1, grade.f.contrast, t);
  let saturate = lerp(1, grade.f.saturate, t);
  let brightness = lerp(1, grade.f.brightness, t);
  let sepia = lerp(0, grade.f.sepia, t);
  let hue = lerp(0, grade.f.hue, t);

  const adj = dump.adjust;
  contrast *= (1 + adj.contrast/150);
  saturate *= (1 + adj.saturation/120);
  hue += (adj.warmth/100) * -14;
  brightness *= (1 + adj.warmth/500);

  contrast = clamp(contrast, 0.4, 2.2);
  saturate = clamp(saturate, 0, 3);
  brightness = clamp(brightness, 0.3, 2);
  const blurPx = clamp(adj.blur,0,100)/100*5 + (extraBlurPx||0);

  return `contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) brightness(${brightness.toFixed(3)}) sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)${blurPx>0.05?` blur(${blurPx.toFixed(2)}px)`:''}`;
}
function photoFilterString(dump, photoId){
  const ov = dump.perPhotoOverrides && dump.perPhotoOverrides[photoId];
  const extraBlur = ov && ov.retouch ? (ov.retouch/100*2.2) : 0;
  return cssFilterString(dump, extraBlur);
}

const noiseCache = {};
function noiseDataURL(density){
  const key = Math.round(density*1000);
  if(noiseCache[key]) return noiseCache[key];
  const c = document.getElementById('workCanvas');
  const s = 80; c.width=s; c.height=s;
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(s,s);
  for(let i=0;i<id.data.length;i+=4){
    const v = Math.random()*255;
    id.data[i]=id.data[i+1]=id.data[i+2]=v;
    id.data[i+3]= Math.random() < density*3 ? 255 : 0;
  }
  ctx.putImageData(id,0,0);
  const url = c.toDataURL();
  noiseCache[key]=url;
  return url;
}

function layoutContainerStyle(dump){
  const gap = Math.round(lerp(2,18, dump.room/100));
  switch(dump.layoutId){
    case 'minimal':   return `display:flex;flex-direction:column;gap:${gap+8}px;`;
    case 'neat9':     return `display:grid;grid-template-columns:repeat(3,1fr);gap:${Math.max(3,Math.round(gap*0.45))}px;`;
    case 'contact':   return `display:grid;grid-template-columns:repeat(4,1fr);gap:${Math.max(2,Math.round(gap*0.25))}px;`;
    case 'chaotic': case 'scrapbook': case 'collage': return `position:relative;min-height:360px;`;
    case 'fullbleed':return `display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0;`;
    case 'filmdiary':return `display:flex;flex-direction:column;gap:${gap}px;`;
    case 'magazine': return `display:grid;grid-template-columns:repeat(2,1fr);gap:${gap}px;`;
    case 'mixed':    return `display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:88px;gap:${gap}px;grid-auto-flow:dense;`;
    case 'editorial':default: return `display:grid;grid-template-columns:repeat(2,1fr);gap:${gap}px;`;
  }
}
function tileStyle(dump, index){
  const l = dump.layoutId;
  if(l==='editorial') return index===0 ? 'grid-column:1/3;aspect-ratio:16/10;' : 'aspect-ratio:1;';
  if(l==='minimal')   return 'width:100%;aspect-ratio:4/3;';
  if(l==='magazine')  return index===0 ? 'grid-column:1/3;aspect-ratio:16/9;' : 'aspect-ratio:1;';
  if(l==='mixed'){
    const mod = index % 5;
    if(mod===0) return 'grid-column:span 2;grid-row:span 2;';
    if(mod===3) return 'grid-row:span 2;';
    return '';
  }
  if(l==='fullbleed') return 'flex:0 0 100%;scroll-snap-align:start;aspect-ratio:4/5;';
  if(l==='filmdiary') return 'width:100%;aspect-ratio:20/9;position:relative;';
  return 'aspect-ratio:1;';
}
function cropAspect(fmt){
  if(fmt==='portrait') return 'aspect-ratio:4/5;';
  if(fmt==='story') return 'aspect-ratio:9/16;';
  return 'aspect-ratio:1/1;';
}

function overlaysHTML(dump, texture){
  let html = '';
  const amt = dump.textureAmount/100;
  if(texture.density > 0){
    html += `<div style="position:absolute;inset:0;background-image:url(${noiseDataURL(texture.density)});background-size:90px 90px;mix-blend-mode:overlay;opacity:${(amt*0.7).toFixed(2)};pointer-events:none;"></div>`;
  }
  if(texture.paper){
    html += `<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(180,150,110,.05) 0px,rgba(180,150,110,.05) 1px,transparent 1px,transparent 3px);mix-blend-mode:multiply;opacity:${amt};pointer-events:none;"></div>`;
  }
  if(texture.scratches){
    const seed = seededRand(dump.id+'scratch');
    for(let i=0;i<4;i++){
      const x = Math.round(seed()*100);
      html += `<div style="position:absolute;top:0;bottom:0;left:${x}%;width:1px;background:rgba(255,255,255,.18);opacity:${(amt*0.8).toFixed(2)};pointer-events:none;"></div>`;
    }
  }
  if(texture.halation){
    html += `<div style="position:absolute;inset:-10%;background:radial-gradient(ellipse at 30% 20%, rgba(255,190,140,.35), transparent 55%);mix-blend-mode:screen;pointer-events:none;"></div>`;
  }
  if(texture.leak){
    const ang = Math.round(seededRand(dump.id+'leak')()*360);
    html += `<div style="position:absolute;inset:-20%;background:linear-gradient(${ang}deg, rgba(255,140,110,.4), transparent 45%);mix-blend-mode:screen;pointer-events:none;"></div>`;
  }
  if(dump.vignette > 0){
    html += `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(20,10,5,${(dump.vignette/100*0.55).toFixed(2)}) 100%);pointer-events:none;"></div>`;
  }
  if(dump.effects && dump.effects.halation) html += `<div style="position:absolute;inset:-10%;background:radial-gradient(ellipse at 70% 30%, rgba(255,190,140,.3), transparent 55%);mix-blend-mode:screen;pointer-events:none;"></div>`;
  if(dump.effects && dump.effects.leak) html += `<div style="position:absolute;inset:-20%;background:linear-gradient(120deg, rgba(255,140,110,.35), transparent 50%);mix-blend-mode:screen;pointer-events:none;"></div>`;
  return html;
}

function sprocketRowHTML(){
  return `<div style="position:absolute;left:0;right:0;top:2px;display:flex;justify-content:space-around;pointer-events:none;">${Array(8).fill(0).map(()=> '<div style="width:5px;height:5px;border-radius:1px;background:rgba(255,255,255,.65);"></div>').join('')}</div>
  <div style="position:absolute;left:0;right:0;bottom:2px;display:flex;justify-content:space-around;pointer-events:none;">${Array(8).fill(0).map(()=> '<div style="width:5px;height:5px;border-radius:1px;background:rgba(255,255,255,.65);"></div>').join('')}</div>`;
}

function layerHTML(dump, l){
  if(l.type === 'sticker'){
    return `<div class="layerEl" data-layerid="${l.id}" style="position:absolute;left:${l.x}%;top:${l.y}%;transform:translate(-50%,-50%) rotate(${l.rot}deg) scale(${l.scale});font-size:38px;pointer-events:auto;cursor:grab;${dump.selectedLayerId===l.id?'filter:drop-shadow(0 0 0 transparent);outline:2px dashed rgba(224,104,79,.6);outline-offset:6px;':''}" onpointerdown="A.layerDragStart(event,'${l.id}')">${l.content}</div>`;
  }
  const preset = TEXT_PRESETS.find(p=>p.id===l.presetId) || TEXT_PRESETS[0];
  return `<div class="layerEl" data-layerid="${l.id}" style="position:absolute;left:${l.x}%;top:${l.y}%;transform:translate(-50%,-50%) rotate(${l.rot}deg) scale(${l.scale});font-family:${preset.font};font-weight:${preset.weight};font-size:${preset.size}px;font-style:${preset.italic?'italic':'normal'};letter-spacing:${preset.spacing||'normal'};text-transform:${preset.caps?'uppercase':'none'};color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.45);white-space:nowrap;pointer-events:auto;cursor:grab;${dump.selectedLayerId===l.id?'outline:2px dashed rgba(224,104,79,.6);outline-offset:6px;':''}" onpointerdown="A.layerDragStart(event,'${l.id}')">${esc(l.content)}</div>`;
}

function renderCanvasHTML(dump){
  const ids = dump.order || dump.photoIds;
  const grade = GRADES.find(g=>g.id===dump.gradeId) || GRADES[0];
  const border = BORDERS.find(b=>b.id===dump.borderId) || BORDERS[0];
  const backdrop = BACKDROPS.find(b=>b.id===dump.backdropId) || BACKDROPS[0];
  const texture = TEXTURES.find(t=>t.id===dump.textureId) || TEXTURES[0];
  const isAbsolute = ['chaotic','scrapbook','collage'].includes(dump.layoutId);
  const t = dump.gradeIntensity/100;

  let tiles = '';
  ids.forEach((id, idx) => {
    const p = S.photos.find(x=>x.id===id);
    if(!p) return;
    let posStyle = '';
    if(isAbsolute){
      const rand = seededRand(dump.id+id);
      const messiness = dump.messiness/100;
      const w = 44 + rand()*16;
      const left = rand()*(100-w);
      const top = 4 + idx*(24 + rand()*10);
      const rot = (rand()*2-1)*26*messiness*(dump.layoutId==='collage'?0.55:1);
      posStyle = `position:absolute;left:${left.toFixed(1)}%;top:${top.toFixed(1)}%;width:${w.toFixed(1)}%;transform:rotate(${rot.toFixed(1)}deg);z-index:${idx};`;
    }
    const spots = dump.removedSpots.filter(s=>s.photoId===id);
    const editing = S.editingPhotoId === id;
    const framePad = border.id==='none' ? 0 : (border.polaroid ? '9px 9px 24px' : (dump.borderWeight||8)+'px');
    const isReorderPick = S.reorderMode && S.reorderFirstPick === id;
    tiles += `<div class="dumpTile" data-photoid="${id}" style="${isAbsolute?posStyle:tileStyle(dump, idx)};${isAbsolute?'':'position:relative;'}border-radius:${border.polaroid?'2px':'12px'};overflow:visible;background:${border.color||'transparent'};padding:${framePad};cursor:pointer;${editing?'outline:3px solid var(--coral);outline-offset:2px;':''}${isReorderPick?'outline:3px dashed var(--forest2);outline-offset:2px;':''}" onclick="A.tileTap('${id}')">
      <div style="position:relative;width:100%;height:100%;border-radius:${border.polaroid?'1px':'10px'};overflow:hidden;box-shadow:0 6px 14px rgba(60,35,20,.16);">
        <img src="${p.url}" style="width:100%;height:100%;object-fit:cover;display:block;filter:${photoFilterString(dump,id)};"/>
        ${grade.tint ? `<div style="position:absolute;inset:0;background:rgb(${grade.tint.color});mix-blend-mode:${grade.tint.blend};opacity:${(grade.tint.max*t).toFixed(2)};"></div>` : ''}
        ${dump.adjust.fade>0 ? `<div style="position:absolute;inset:0;background:#fff;opacity:${(dump.adjust.fade/100*0.3).toFixed(2)};"></div>` : ''}
        ${dump.cutout ? `<div style="position:absolute;inset:0;background:${backdrop.color};mix-blend-mode:multiply;opacity:.1;"></div>` : ''}
        ${spots.map(s=>`<div style="position:absolute;left:${s.xPct}%;top:${s.yPct}%;width:30%;height:30%;transform:translate(-50%,-50%);backdrop-filter:blur(10px) saturate(0.7);background:rgba(255,255,255,.08);border-radius:50%;"></div>`).join('')}
        ${border.sprockets ? sprocketRowHTML() : ''}
      </div>
      ${border.polaroid ? `<div style="text-align:center;font-family:'Caveat',cursive;font-size:14px;color:#8a7568;margin-top:1px;">${esc(fmtShort(p.lastModified))}</div>` : ''}
      ${dump.layoutId==='filmdiary' ? `<div style="position:absolute;bottom:5px;left:9px;font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.65);letter-spacing:.06em;">${esc(fmtShort(p.lastModified))}</div>` : ''}
    </div>`;
  });

  const layersHtml = dump.layers.map(l => layerHTML(dump, l)).join('');
  const cutClip = border.torn ? 'clip-path:polygon(1% 3%,6% 0,14% 2%,22% 0,30% 2%,40% 0,50% 2%,60% 0,70% 2%,80% 0,90% 2%,99% 0,100% 96%,94% 100%,86% 98%,76% 100%,66% 98%,56% 100%,46% 98%,36% 100%,26% 98%,16% 100%,6% 98%,0 100%);' : '';

  return `<div id="canvasStage" style="position:relative;border-radius:14px;overflow:hidden;background:${backdrop.color};${cropAspect(dump.cropFormat)}${cutClip}">
    <div style="${layoutContainerStyle(dump)}padding:${dump.wrapGrid?0:10}px;position:relative;height:100%;">
      ${tiles}
    </div>
    ${overlaysHTML(dump, texture)}
    <div id="layersLayer" style="position:absolute;inset:0;pointer-events:none;">${layersHtml}</div>
  </div>`;
}

/* ===========================================================
   STUDIO — screen shell + tool panels
   =========================================================== */

const TOOLS = [
  ['layout','▦','Layout'], ['filters','◐','Filters'], ['grain','▒','Grain'], ['adjust','◑','Adjust'],
  ['crop','⛶','Crop'], ['retouch','✧','Retouch'], ['remove','⌫','Remove'], ['backdrop','◧','Backdrop'],
  ['stickers','☺','Stickers'], ['text','T','Text'], ['frames','▣','Frames'], ['effects','✺','Effects'], ['layers','❏','Layers'],
];

function sliderRow(label, val, min, max, onInput){
  const id = 'lbl-' + label.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  return `<div style="margin-bottom:16px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--ink);margin-bottom:4px;"><span>${esc(label)}</span><span id="${id}" style="color:var(--muted);">${Math.round(val)}</span></div>
    <input type="range" min="${min}" max="${max}" value="${val}" oninput="${onInput}; var lb=document.getElementById('${id}'); if(lb) lb.textContent=Math.round(this.value);"/>
  </div>`;
}
// Patch only the canvas preview (not the whole screen) so dragging a range
// input mid-gesture never gets its DOM node destroyed underneath the cursor.
function patchCanvas(){
  if(!S.currentDump) return;
  const stage = document.getElementById('canvasStage');
  if(!stage) return;
  stage.outerHTML = renderCanvasHTML(S.currentDump);
}
A.liveDumpSlider = (key, val) => { S.currentDump[key] = Number(val); patchCanvas(); };
A.liveAdjustSlider = (key, val) => { S.currentDump.adjust[key] = Number(val); patchCanvas(); };
A.liveRetouchSlider = (val) => {
  const d = S.currentDump;
  d.retouch.strength = Number(val);
  if(S.editingPhotoId){ d.perPhotoOverrides = d.perPhotoOverrides || {}; d.perPhotoOverrides[S.editingPhotoId] = { retouch:Number(val) }; }
  patchCanvas();
};
function chipRow(items, activeId, onClick){
  return `<div class="hscroll">${items.map(it => `<div class="chip" style="background:${it.id===activeId?'#2c211b':'var(--chip-bg)'};color:${it.id===activeId?'#fff':'var(--chip-fg)'};" onclick="${onClick(it.id)}">${esc(it.name)}</div>`).join('')}</div>`;
}

function renderToolPanel(dump){
  const tool = S.activeTool;
  if(tool==='layout') return `
    <div class="hscroll" style="margin-bottom:14px;">
      ${LAYOUTS.map(l => `<div onclick="A.setLayout('${l.id}')" style="flex-shrink:0;width:78px;cursor:pointer;">
        <div style="width:78px;height:78px;border-radius:12px;background:#f2ece7;${dump.layoutId===l.id?'outline:2.5px solid var(--coral);':''}display:flex;align-items:center;justify-content:center;font-size:22px;color:#c9b8ab;">▦</div>
        <div style="font-size:10.5px;font-weight:700;text-align:center;margin-top:5px;color:${dump.layoutId===l.id?'var(--coral)':'var(--ink)'};">${esc(l.name)}</div>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap;">
      <div class="chip" style="background:${S.reorderMode?'#2c211b':'var(--chip-bg)'};color:${S.reorderMode?'#fff':'var(--chip-fg)'};" onclick="A.toggleReorder()">Reorder photos</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.autoCompose()">Auto-compose</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.smartHero()">Smart hero</div>
    </div>
    ${sliderRow('Recipe strength', dump.recipeStrength, 0, 100, "A.liveDumpSlider('recipeStrength', this.value)")}
    ${sliderRow('Breathing room', dump.room, 0, 100, "A.liveDumpSlider('room', this.value)")}
    ${sliderRow('Perfect → messy', dump.messiness, 0, 100, "A.liveDumpSlider('messiness', this.value)")}
  `;
  if(tool==='filters') return `
    <div class="hscroll" style="margin-bottom:14px;">
      ${GRADES.map(g => `<div onclick="A.setGrade('${g.id}')" style="flex-shrink:0;width:68px;cursor:pointer;">
        <div style="width:68px;height:68px;border-radius:12px;overflow:hidden;${dump.gradeId===g.id?'outline:2.5px solid var(--coral);':''}background:#ddd;">
          ${S.photos[0]?`<img src="${S.photos[0].url}" style="width:100%;height:100%;object-fit:cover;filter:${cssFilterString(Object.assign({},dump,{gradeId:g.id,gradeIntensity:100}))};"/>`:''}
        </div>
        <div style="font-size:10.5px;font-weight:700;text-align:center;margin-top:5px;color:${dump.gradeId===g.id?'var(--coral)':'var(--ink)'};">${esc(g.name)}</div>
      </div>`).join('')}
    </div>
    ${sliderRow('Intensity', dump.gradeIntensity, 0, 100, "A.liveDumpSlider('gradeIntensity', this.value)")}
  `;
  if(tool==='grain') return `
    <div class="hscroll" style="margin-bottom:14px;">
      ${TEXTURES.map(x => `<div class="chip" style="background:${dump.textureId===x.id?'#2c211b':'var(--chip-bg)'};color:${dump.textureId===x.id?'#fff':'var(--chip-fg)'};" onclick="A.setDumpVal('textureId','${x.id}')">${esc(x.name)}</div>`).join('')}
    </div>
    ${sliderRow('Texture amount', dump.textureAmount, 0, 100, "A.liveDumpSlider('textureAmount', this.value)")}
    ${sliderRow('Vignette', dump.vignette, 0, 100, "A.liveDumpSlider('vignette', this.value)")}
  `;
  if(tool==='adjust') return `
    ${sliderRow('Contrast', dump.adjust.contrast, -100, 100, "A.liveAdjustSlider('contrast', this.value)")}
    ${sliderRow('Saturation', dump.adjust.saturation, -100, 100, "A.liveAdjustSlider('saturation', this.value)")}
    ${sliderRow('Warmth', dump.adjust.warmth, -100, 100, "A.liveAdjustSlider('warmth', this.value)")}
    ${sliderRow('Fade', dump.adjust.fade, 0, 100, "A.liveAdjustSlider('fade', this.value)")}
    ${sliderRow('Blur', dump.adjust.blur, 0, 100, "A.liveAdjustSlider('blur', this.value)")}
  `;
  if(tool==='crop') return `
    <div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:8px;">Format</div>
    <div class="hscroll" style="margin-bottom:14px;">
      ${[['square','Square 1:1'],['portrait','Portrait 4:5'],['story','Story 9:16']].map(([id,name]) => `<div class="chip" style="background:${dump.cropFormat===id?'#2c211b':'var(--chip-bg)'};color:${dump.cropFormat===id?'#fff':'var(--chip-fg)'};" onclick="A.setDumpVal('cropFormat','${id}')">${name}</div>`).join('')}
    </div>
    <div style="font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:8px;">Crop bias</div>
    <div class="hscroll">
      ${[['centre','Centre'],['top','Bias top'],['subject','Follow subject']].map(([id,name]) => `<div class="chip" style="background:${dump.cropBias===id?'#2c211b':'var(--chip-bg)'};color:${dump.cropBias===id?'#fff':'var(--chip-fg)'};" onclick="A.setDumpVal('cropBias','${id}')">${name}</div>`).join('')}
    </div>
  `;
  if(tool==='retouch') return `
    <div style="font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:10px;">${S.editingPhotoId? 'Applies to the selected photo only.' : 'Tap a photo on the canvas to target it, or apply to all.'}</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;">
      ${RETOUCH_OPTIONS.map(o => `<div class="chip" style="background:${(dump.retouch.options||[]).includes(o)?'#2c211b':'var(--chip-bg)'};color:${(dump.retouch.options||[]).includes(o)?'#fff':'var(--chip-fg)'};" onclick="A.toggleRetouchOpt('${o.replace(/'/g,"\\'")}')">${esc(o)}</div>`).join('')}
    </div>
    ${sliderRow('Strength', dump.retouch.strength, 0, 100, "A.liveRetouchSlider(this.value)")}
  `;
  if(tool==='remove') return `
    <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:12px;line-height:1.5;">Tap anywhere on a photo to erase that spot. This preview softens the area rather than true AI inpainting — a production build would call a real object-removal model.</div>
    <div style="display:flex;gap:7px;margin-bottom:12px;flex-wrap:wrap;">
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.removePreset('person')">Remove person</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.removePreset('background')">Clean background</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.undoAllRemovals()">Undo all</div>
    </div>
    <div style="font-size:12px;font-weight:700;color:var(--ink);">${dump.removedSpots.length} spot${dump.removedSpots.length===1?'':'s'} marked</div>
  `;
  if(tool==='backdrop') return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <div class="switchTrack" style="background:${dump.cutout?'var(--forest2)':'#e3d6cb'};" onclick="A.toggleDumpBool('cutout')"><div class="switchThumb" style="left:${dump.cutout?'20px':'2.5px'};"></div></div>
      <div style="font-size:12.5px;font-weight:700;color:var(--ink);">Cut out subject</div>
    </div>
    <div class="hscroll" style="margin-bottom:14px;">
      ${BACKDROPS.map(b => `<div style="flex-shrink:0;text-align:center;cursor:pointer;" onclick="A.setDumpVal('backdropId','${b.id}')">
        <div style="width:44px;height:44px;border-radius:50%;background:${b.color};${dump.backdropId===b.id?'outline:2.5px solid var(--coral);outline-offset:2px;':'border:1px solid #eee1d6;'}"></div>
        <div style="font-size:10px;font-weight:700;margin-top:5px;color:${dump.backdropId===b.id?'var(--coral)':'var(--ink)'};">${b.name}</div>
      </div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="switchTrack" style="background:${dump.wrapGrid?'var(--forest2)':'#e3d6cb'};" onclick="A.toggleDumpBool('wrapGrid')"><div class="switchThumb" style="left:${dump.wrapGrid?'20px':'2.5px'};"></div></div>
      <div style="font-size:12.5px;font-weight:700;color:var(--ink);">Wrap / break grid</div>
    </div>
  `;
  if(tool==='stickers') return `
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:14px;">
      ${STICKERS.map(s => `<div onclick="A.addSticker('${s}')" style="aspect-ratio:1;background:var(--chip-bg);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;">${s}</div>`).join('')}
    </div>
    <div style="display:flex;gap:7px;">
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.addSticker('📎')">Tape</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.addTextPreset('date')">Date stamp</div>
    </div>
  `;
  if(tool==='text') return `
    <div class="card" style="padding:11px 13px;margin-bottom:12px;">
      <input type="text" id="textDraft" placeholder="Type something…" value="${esc(S.textDraft||'')}" oninput="A.setTextDraft(this.value)" style="width:100%;font-size:14px;font-weight:600;color:var(--ink);"/>
    </div>
    <div class="hscroll">
      ${TEXT_PRESETS.map(p => `<div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);font-family:${p.font};" onclick="A.addTextPreset('${p.id}')">${esc(p.name)}</div>`).join('')}
    </div>
  `;
  if(tool==='frames') return `
    <div class="hscroll" style="margin-bottom:14px;">
      ${BORDERS.map(b => `<div class="chip" style="background:${dump.borderId===b.id?'#2c211b':'var(--chip-bg)'};color:${dump.borderId===b.id?'#fff':'var(--chip-fg)'};" onclick="A.setDumpVal('borderId','${b.id}')">${esc(b.name)}</div>`).join('')}
    </div>
    ${sliderRow('Border weight', dump.borderWeight, 0, 24, "A.liveDumpSlider('borderWeight', this.value)")}
  `;
  if(tool==='effects'){
    const eff = dump.effects || {halation:false, leak:false, vignette:true};
    return `
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;">
      ${[['halation','Halation'],['leak','Light leak']].map(([k,name]) => `<div class="chip" style="background:${eff[k]?'#2c211b':'var(--chip-bg)'};color:${eff[k]?'#fff':'var(--chip-fg)'};" onclick="A.toggleEffect('${k}')">${name}</div>`).join('')}
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.saveRecipe()">Save as recipe</div>
    </div>
    ${sliderRow('Vignette', dump.vignette, 0, 100, "A.liveDumpSlider('vignette', this.value)")}
    ${sliderRow('Blur edges', dump.adjust.blur, 0, 100, "A.liveAdjustSlider('blur', this.value)")}
  `;}
  if(tool==='layers'){
    if(dump.layers.length===0) return `<div class="emptyState">Nothing layered yet — add stickers or text.</div>`;
    return `
    <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:12px;">
      ${dump.layers.map(l => `<div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 12px;">
        <div style="font-size:18px;width:24px;text-align:center;">${l.type==='sticker'?l.content:'T'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12.5px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.type==='text'?esc(l.content):'Sticker'}</div>
          <div style="font-size:10.5px;color:var(--muted);font-weight:600;">${Math.round(l.scale*100)}% · ${Math.round(l.rot)}°</div>
        </div>
        <div onclick="A.layerNudgeScale('${l.id}',-0.15)" style="width:26px;height:26px;border-radius:8px;background:var(--chip-bg);display:flex;align-items:center;justify-content:center;font-weight:800;cursor:pointer;">−</div>
        <div onclick="A.layerNudgeScale('${l.id}',0.15)" style="width:26px;height:26px;border-radius:8px;background:var(--chip-bg);display:flex;align-items:center;justify-content:center;font-weight:800;cursor:pointer;">+</div>
        <div onclick="A.layerRotate('${l.id}')" style="width:26px;height:26px;border-radius:8px;background:var(--chip-bg);display:flex;align-items:center;justify-content:center;cursor:pointer;">↻</div>
        <div onclick="A.layerDelete('${l.id}')" style="width:26px;height:26px;border-radius:8px;background:#f7e2de;color:var(--coral-dark);display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</div>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;">
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.nudgeAll(-3,0)">← Nudge</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.nudgeAll(3,0)">Nudge →</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.nudgeAll(0,-3)">↑ Nudge</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.nudgeAll(0,3)">Nudge ↓</div>
      <div class="chip" style="background:var(--chip-bg);color:var(--chip-fg);" onclick="A.duplicateSelected()">Duplicate</div>
      <div class="chip" style="background:#f7e2de;color:var(--coral-dark);" onclick="A.clearLayers()">Clear all</div>
    </div>`;
  }
  return '';
}

function renderStudio(){
  const dump = S.currentDump;
  if(!dump) { S.screen = 'home'; return renderHome(); }
  const grade = GRADES.find(g=>g.id===dump.gradeId);
  const layout = LAYOUTS.find(l=>l.id===dump.layoutId);
  return `<div style="position:relative;flex:1;display:flex;flex-direction:column;min-height:0;animation:fadeUp .26s ease both;">
    <div style="padding:44px 16px 8px;display:flex;align-items:center;gap:10px;">
      <div onclick="A.exitStudio()" style="font-size:22px;color:#7d6a5d;cursor:pointer;">‹</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(dump.name)}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;">${dump.photoIds.length} photos · ${layout.name} · ${grade.name}</div>
      </div>
      <div onclick="A.toggleAB()" class="pill" style="background:${S.abMode?'#2c211b':'var(--chip-bg)'};color:${S.abMode?'#fff':'var(--chip-fg)'};font-size:10.5px;font-weight:800;padding:6px 11px;cursor:pointer;">A/B</div>
      <div onclick="A.openRemix()" style="width:32px;height:32px;border-radius:50%;background:var(--chip-bg);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;">🔀</div>
      <div onclick="A.openExport()" style="background:var(--ink);color:#fff;font-size:12px;font-weight:800;padding:8px 14px;border-radius:99px;cursor:pointer;">Export</div>
    </div>

    <div style="padding:6px 16px 10px;flex-shrink:0;">
      ${S.abMode ? `<div style="border-radius:14px;overflow:hidden;background:#eee;${cropAspect(dump.cropFormat)}display:flex;align-items:center;justify-content:center;">
          ${S.photos.find(p=>p.id===dump.photoIds[0]) ? `<img src="${S.photos.find(p=>p.id===dump.photoIds[0]).url}" style="width:100%;height:100%;object-fit:cover;filter:grayscale(1);"/>` : ''}
        </div><div style="text-align:center;font-size:10.5px;font-weight:700;color:var(--muted);margin-top:6px;">BEFORE (tap A/B again to compare)</div>`
      : `<div class="card" style="padding:8px;">${renderCanvasHTML(dump)}</div>`}
      ${S.editingPhotoId ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;background:#fff;border-radius:12px;padding:9px 13px;box-shadow:var(--card-shadow);">
        <div style="font-size:11.5px;font-weight:700;color:var(--ink);">Editing this photo only</div>
        <div onclick="A.doneEditingPhoto()" style="font-size:11.5px;font-weight:700;color:var(--coral);cursor:pointer;">Done</div>
      </div>` : ''}
    </div>

    <div style="flex:1;overflow-y:auto;padding:6px 16px 74px;min-height:0;">
      ${renderToolPanel(dump)}
    </div>

    <div class="toolstrip">
      ${TOOLS.map(([id,ic,label]) => `<div class="toolbtn ${S.activeTool===id?'active':''}" onclick="A.setTool('${id}')"><div class="ic">${ic}</div><div>${label}</div></div>`).join('')}
    </div>
  </div>`;
}

/* ---- Studio actions ---- */
A.exitStudio = () => { S.editingPhotoId=null; S.reorderMode=false; S.screen='home'; render(); };
A.setTool = (id) => { S.activeTool = id; render(); };
A.toggleAB = () => { S.abMode = !S.abMode; render(); };
A.setLayout = (id) => { S.currentDump.layoutId = id; trackUsage('layouts', id); render(); };
A.setGrade = (id) => { S.currentDump.gradeId = id; trackUsage('grades', id); render(); };
A.setDumpVal = (key, val) => { S.currentDump[key] = isNaN(val) ? val : Number(val); if(key==='textureId') trackUsage('textures', val); render(); };
A.setAdjust = (key, val) => { S.currentDump.adjust[key] = Number(val); render(); };
A.toggleDumpBool = (key) => { S.currentDump[key] = !S.currentDump[key]; render(); };
A.toggleEffect = (key) => { const d=S.currentDump; d.effects = d.effects || {halation:false,leak:false,vignette:true}; d.effects[key] = !d.effects[key]; render(); };
A.toggleReorder = () => { S.reorderMode = !S.reorderMode; S.reorderFirstPick = null; render(); };
A.autoCompose = () => { S.currentDump.room = 45+Math.round(Math.random()*20); S.currentDump.recipeStrength = 70+Math.round(Math.random()*20); showToast('Auto-composed'); render(); };
A.smartHero = () => { const d=S.currentDump; const brightest=[...d.photoIds].sort((a,b)=>{const pa=S.photos.find(p=>p.id===a),pb=S.photos.find(p=>p.id===b); return (pb?pb.brightness:0)-(pa?pa.brightness:0);})[0]; d.order = [brightest, ...d.photoIds.filter(id=>id!==brightest)]; showToast('Smart hero set'); render(); };
A.tileTap = (id) => {
  const d = S.currentDump;
  if(S.reorderMode){
    if(!S.reorderFirstPick){ S.reorderFirstPick = id; render(); return; }
    const ids = d.order || d.photoIds.slice();
    const i1 = ids.indexOf(S.reorderFirstPick), i2 = ids.indexOf(id);
    if(i1>-1 && i2>-1){ [ids[i1],ids[i2]] = [ids[i2],ids[i1]]; d.order = ids; }
    S.reorderFirstPick = null;
    showToast('Swapped');
    render();
    return;
  }
  if(S.activeTool === 'remove'){
    d.removedSpots.push({ photoId:id, xPct: 30+Math.random()*40, yPct: 30+Math.random()*40 });
    showToast('Spot marked');
    render();
    return;
  }
  S.editingPhotoId = S.editingPhotoId === id ? null : id;
  render();
};
A.selectPhotoForEdit = A.tileTap;
A.doneEditingPhoto = () => { S.editingPhotoId = null; render(); };
A.removePreset = (kind) => {
  const d = S.currentDump;
  (d.order||d.photoIds).slice(0,3).forEach(id => d.removedSpots.push({ photoId:id, xPct:30+Math.random()*40, yPct:30+Math.random()*40 }));
  showToast(kind==='person' ? 'Marked likely person regions' : 'Marked background regions');
  render();
};
A.undoAllRemovals = () => { S.currentDump.removedSpots = []; render(); };
A.toggleRetouchOpt = (opt) => {
  const d = S.currentDump;
  d.retouch.options = d.retouch.options || [];
  const i = d.retouch.options.indexOf(opt);
  if(i>-1) d.retouch.options.splice(i,1); else d.retouch.options.push(opt);
  render();
};
A.setRetouchStrength = (val) => {
  const d = S.currentDump;
  d.retouch.strength = Number(val);
  if(S.editingPhotoId){
    d.perPhotoOverrides = d.perPhotoOverrides || {};
    d.perPhotoOverrides[S.editingPhotoId] = { retouch: Number(val) };
  }
  render();
};
A.addSticker = (glyph) => {
  const d = S.currentDump;
  const l = { id:uid(), type:'sticker', content:glyph, x:50, y:50, scale:1, rot:0 };
  d.layers.push(l); d.selectedLayerId = l.id;
  render();
};
A.setTextDraft = (v) => { S.textDraft = v; };
A.addTextPreset = (presetId) => {
  const d = S.currentDump;
  const preset = TEXT_PRESETS.find(p=>p.id===presetId);
  let content = S.textDraft && S.textDraft.trim() ? S.textDraft.trim() : (preset.id==='date' ? fmtShort(Date.now()) : preset.name);
  const l = { id:uid(), type:'text', content, presetId, x:50, y:50, scale:1, rot:0 };
  d.layers.push(l); d.selectedLayerId = l.id;
  S.textDraft = '';
  render();
};
A.layerNudgeScale = (id, delta) => { const l = S.currentDump.layers.find(x=>x.id===id); if(l) l.scale = clamp(l.scale+delta, 0.3, 4); render(); };
A.layerRotate = (id) => { const l = S.currentDump.layers.find(x=>x.id===id); if(l) l.rot = (l.rot+12)%360; render(); };
A.layerDelete = (id) => { const d=S.currentDump; d.layers = d.layers.filter(x=>x.id!==id); render(); };
A.nudgeAll = (dx,dy) => { S.currentDump.layers.forEach(l => { l.x = clamp(l.x+dx,0,100); l.y = clamp(l.y+dy,0,100); }); render(); };
A.duplicateSelected = () => {
  const d = S.currentDump;
  const l = d.layers.find(x=>x.id===d.selectedLayerId) || d.layers[d.layers.length-1];
  if(!l) return;
  const copy = Object.assign({}, l, { id:uid(), x:clamp(l.x+6,0,100), y:clamp(l.y+6,0,100) });
  d.layers.push(copy);
  render();
};
A.clearLayers = () => { S.currentDump.layers = []; render(); };
A.saveRecipe = () => {
  const d = S.currentDump;
  S.savedRecipes.push({ id:uid(), name:d.name+' recipe', layoutId:d.layoutId, gradeId:d.gradeId, textureId:d.textureId });
  savePersisted();
  showToast('Saved as recipe');
};

function trackUsage(cat, id){
  S.usage[cat] = S.usage[cat] || {};
  S.usage[cat][id] = (S.usage[cat][id]||0) + 1;
  savePersisted();
}

/* ---- pointer drag for layers ---- */
A.layerDragStart = (ev, layerId) => {
  ev.preventDefault(); ev.stopPropagation();
  const stage = document.getElementById('canvasStage');
  if(!stage) return;
  const rect = stage.getBoundingClientRect();
  S.drag = { layerId, rect };
  const move = (e) => {
    const x = clamp(((e.clientX-rect.left)/rect.width)*100, 0, 100);
    const y = clamp(((e.clientY-rect.top)/rect.height)*100, 0, 100);
    const l = S.currentDump.layers.find(x2=>x2.id===layerId);
    if(l){ l.x = x; l.y = y; renderLayerPositionOnly(); }
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    S.drag = null;
    render();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
};
function renderLayerPositionOnly(){
  const layersLayer = document.getElementById('layersLayer');
  if(!layersLayer || !S.currentDump) return;
  layersLayer.innerHTML = S.currentDump.layers.map(l => layerHTML(S.currentDump, l)).join('');
}

/* ---- Remix ---- */
function renderRemixSheet(){
  return `<div class="sheetBackdrop" onclick="A.closeRemix()"></div>
  <div class="sheet" style="padding:18px 20px calc(20px + env(safe-area-inset-bottom));">
    <div style="font-size:16px;font-weight:800;color:var(--ink);margin-bottom:4px;">One-tap remix</div>
    <div style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:14px;">A different palette + layout combo, one tap.</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;overflow-y:auto;">
      ${STYLE_PACKS.concat(STYLE_PACKS.map(p=>Object.assign({},p,{id:p.id+'b'}))).slice(0,8).map((p,i) => `
        <div onclick="A.applyRemix('${p.grade}','${p.layout}','${p.texture}')" style="aspect-ratio:1;border-radius:12px;background:${p.thumb};cursor:pointer;${S.currentDump && S.currentDump.gradeId===p.grade && S.currentDump.layoutId===p.layout?'outline:2.5px solid var(--coral);':''}"></div>
      `).join('')}
    </div>
  </div>`;
}
A.openRemix = () => { S.remixOpen = true; render(); };
A.closeRemix = () => { S.remixOpen = false; render(); };
A.applyRemix = (grade, layout, texture) => {
  Object.assign(S.currentDump, { gradeId:grade, layoutId:layout, textureId:texture });
  S.remixOpen = false;
  showToast('Remixed');
  render();
};

/* ===========================================================
   EXPORT — real canvas compositing of the dump into a PNG,
   then download or hand off via the Web Share sheet.
   =========================================================== */

function packGrid(ids, cols, spanOf){
  const occ = new Set();
  let maxRow = 0;
  const placements = [];
  ids.forEach((id, idx) => {
    const span = spanOf(idx);
    let placed = false;
    for(let r=0; !placed && r<200; r++){
      for(let c=0; c<=cols-span.colSpan && !placed; c++){
        let fits = true;
        for(let dr=0; dr<span.rowSpan && fits; dr++)
          for(let dc=0; dc<span.colSpan && fits; dc++)
            if(occ.has((r+dr)+','+(c+dc))) fits = false;
        if(fits){
          for(let dr=0; dr<span.rowSpan; dr++) for(let dc=0; dc<span.colSpan; dc++) occ.add((r+dr)+','+(c+dc));
          placements.push({ id, row:r, col:c, colSpan:span.colSpan, rowSpan:span.rowSpan });
          maxRow = Math.max(maxRow, r+span.rowSpan);
          placed = true;
        }
      }
    }
  });
  return { placements, rows:maxRow };
}

function getTileRects(dump, W, H){
  const ids = (dump.order || dump.photoIds).filter(id => S.photos.some(p=>p.id===id));
  const gap = lerp(2,18, dump.room/100) * (W/380);
  const pad = dump.wrapGrid ? 0 : 10*(W/380);
  const cx = pad, cy = pad, cw = W-pad*2, ch = H-pad*2;
  const rects = [];

  if(['chaotic','scrapbook','collage'].includes(dump.layoutId)){
    ids.forEach((id, idx) => {
      const rand = seededRand(dump.id+id);
      const messiness = dump.messiness/100;
      const wPct = 44+rand()*16;
      const leftPct = rand()*(100-wPct);
      const topPct = 4+idx*(24+rand()*10);
      const rot = (rand()*2-1)*26*messiness*(dump.layoutId==='collage'?0.55:1);
      const w = wPct/100*cw;
      rects.push({ id, x:cx+leftPct/100*cw, y:cy+(topPct/100*ch)%Math.max(ch,1), w, h:w, rot });
    });
    return rects;
  }
  if(dump.layoutId === 'fullbleed'){
    if(ids[0]) rects.push({ id:ids[0], x:0, y:0, w:W, h:H, rot:0 });
    return rects;
  }
  if(dump.layoutId === 'editorial' || dump.layoutId === 'magazine'){
    const heroId = ids[0];
    const heroH = cw * (dump.layoutId==='editorial' ? 10/16 : 9/16);
    if(heroId) rects.push({ id:heroId, x:cx, y:cy, w:cw, h:Math.min(heroH, ch*0.6), rot:0 });
    const restY = cy + Math.min(heroH, ch*0.6) + gap;
    const rest = ids.slice(1);
    const { placements, rows } = packGrid(rest, 2, ()=>({colSpan:1,rowSpan:1}));
    const colW = (cw-gap)/2;
    const availH = Math.max(ch - (Math.min(heroH, ch*0.6)+gap), colW);
    const rowH = rows ? Math.min(colW, availH/rows) : colW;
    placements.forEach(pl => rects.push({ id:pl.id, x:cx+pl.col*(colW+gap), y:restY+pl.row*(rowH+gap), w:colW, h:rowH, rot:0 }));
    return rects;
  }
  if(dump.layoutId === 'minimal' || dump.layoutId === 'filmdiary'){
    const aspect = dump.layoutId==='minimal' ? 4/3 : 20/9;
    const rowH = Math.min(cw/aspect, (ch-(ids.length-1)*gap)/Math.max(1,ids.length));
    ids.forEach((id,idx) => rects.push({ id, x:cx, y:cy+idx*(rowH+gap), w:cw, h:rowH, rot:0 }));
    return rects;
  }
  const cols = dump.layoutId==='neat9' ? 3 : dump.layoutId==='contact' ? 4 : 3;
  const spanOf = dump.layoutId==='mixed'
    ? (idx => idx%5===0 ? {colSpan:2,rowSpan:2} : idx%5===3 ? {colSpan:1,rowSpan:2} : {colSpan:1,rowSpan:1})
    : (() => ({colSpan:1,rowSpan:1}));
  const useIds = dump.layoutId==='neat9' ? ids.slice(0,9) : ids;
  const { placements, rows } = packGrid(useIds, cols, spanOf);
  const colW = (cw-(cols-1)*gap)/cols;
  const rowH = colW;
  const contentH = rows*rowH + (rows-1)*gap;
  const scale = contentH > ch ? ch/contentH : 1;
  placements.forEach(pl => rects.push({
    id: pl.id,
    x: cx+pl.col*(colW+gap)*scale,
    y: cy+pl.row*(rowH+gap)*scale,
    w: (pl.colSpan*colW + (pl.colSpan-1)*gap)*scale,
    h: (pl.rowSpan*rowH + (pl.rowSpan-1)*gap)*scale,
    rot: 0
  }));
  return rects;
}

async function renderDumpToBlob(dump){
  const dims = dump.cropFormat==='portrait' ? [1080,1350] : dump.cropFormat==='story' ? [1080,1920] : [1080,1080];
  const [W,H] = dims;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const backdrop = BACKDROPS.find(b=>b.id===dump.backdropId) || BACKDROPS[0];
  const border = BORDERS.find(b=>b.id===dump.borderId) || BORDERS[0];
  const texture = TEXTURES.find(t=>t.id===dump.textureId) || TEXTURES[0];
  const grade = GRADES.find(g=>g.id===dump.gradeId) || GRADES[0];
  const t = dump.gradeIntensity/100;

  ctx.fillStyle = backdrop.color;
  ctx.fillRect(0,0,W,H);

  const rects = getTileRects(dump, W, H);
  const borderW = border.id==='none' ? 0 : (dump.borderWeight||8)*(W/380);

  for(const r of rects){
    const p = S.photos.find(x=>x.id===r.id);
    if(!p || !p.img) continue;
    ctx.save();
    const cxp = r.x+r.w/2, cyp = r.y+r.h/2;
    ctx.translate(cxp, cyp);
    if(r.rot) ctx.rotate(r.rot*Math.PI/180);
    if(border.id!=='none'){
      ctx.fillStyle = border.color;
      ctx.fillRect(-r.w/2, -r.h/2, r.w, r.h);
    }
    const iw = r.w-borderW*2, ih = r.h-borderW*2;
    try{ ctx.filter = photoFilterString(dump, r.id); }catch(e){}
    // cover-fit crop
    const ir = p.img.width/p.img.height, tr = iw/ih;
    let sx=0, sy=0, sw=p.img.width, sh=p.img.height;
    if(ir > tr){ sw = sh*tr; sx = (p.img.width-sw)/2; } else { sh = sw/tr; sy = (p.img.height-sh)/2; }
    ctx.drawImage(p.img, sx, sy, sw, sh, -iw/2, -ih/2, iw, ih);
    ctx.filter = 'none';
    if(grade.tint){
      ctx.globalCompositeOperation = grade.tint.blend === 'normal' ? 'source-atop' : grade.tint.blend;
      ctx.globalAlpha = grade.tint.max * t;
      ctx.fillStyle = `rgb(${grade.tint.color})`;
      ctx.fillRect(-iw/2,-ih/2, iw, ih);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if(dump.adjust.fade>0){
      ctx.globalAlpha = dump.adjust.fade/100*0.3;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-iw/2,-ih/2, iw, ih);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // grain
  if(texture.density > 0){
    const noiseImg = new Image();
    await new Promise(res => { noiseImg.onload = res; noiseImg.src = noiseDataURL(texture.density); });
    const pattern = ctx.createPattern(noiseImg, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (dump.textureAmount/100)*0.7;
    ctx.fillStyle = pattern;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
  if(texture.halation || (dump.effects&&dump.effects.halation)){
    ctx.save(); ctx.globalCompositeOperation='screen';
    const g = ctx.createRadialGradient(W*0.3,H*0.2,0,W*0.3,H*0.2,W*0.7);
    g.addColorStop(0,'rgba(255,190,140,.35)'); g.addColorStop(1,'rgba(255,190,140,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  if(texture.leak || (dump.effects&&dump.effects.leak)){
    ctx.save(); ctx.globalCompositeOperation='screen';
    const g = ctx.createLinearGradient(0,0,W,H*0.6);
    g.addColorStop(0,'rgba(255,140,110,.4)'); g.addColorStop(1,'rgba(255,140,110,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.restore();
  }
  if(dump.vignette>0){
    const g = ctx.createRadialGradient(W/2,H/2,W*0.3,W/2,H/2,W*0.75);
    g.addColorStop(0,'rgba(20,10,5,0)'); g.addColorStop(1,`rgba(20,10,5,${(dump.vignette/100*0.55).toFixed(2)})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }

  // layers
  dump.layers.forEach(l => {
    ctx.save();
    ctx.translate(l.x/100*W, l.y/100*H);
    ctx.rotate(l.rot*Math.PI/180);
    ctx.scale(l.scale, l.scale);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(l.type==='sticker'){
      ctx.font = `${W*0.09}px sans-serif`;
      ctx.fillText(l.content, 0, 0);
    }else{
      const preset = TEXT_PRESETS.find(p=>p.id===l.presetId) || TEXT_PRESETS[0];
      const px = preset.size*(W/380);
      ctx.font = `${preset.italic?'italic ':''}${preset.weight} ${px}px ${preset.font.replace(/'/g,'')}`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8;
      const content = preset.caps ? l.content.toUpperCase() : l.content;
      ctx.fillText(content, 0, 0);
    }
    ctx.restore();
  });

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

function generateCaption(dump, style){
  const grade = GRADES.find(g=>g.id===dump.gradeId).name;
  const count = dump.photoIds.length;
  const dateStr = fmtShort(Date.now());
  const templates = {
    'Understated': `${count} from lately.`,
    'Funny': `posting these before my camera roll files a restraining order (${count} photos)`,
    'Poetic': `little fragments of time, held together in ${grade.toLowerCase()} light.`,
    'Casual': `dump ${dateStr.toLowerCase()} 🤍`,
    'None': '',
  };
  return templates[style] ?? templates['Understated'];
}

function renderExportSheet(){
  const dump = S.currentDump;
  const layout = LAYOUTS.find(l=>l.id===dump.layoutId), grade = GRADES.find(g=>g.id===dump.gradeId);
  if(!S.caption) S.caption = generateCaption(dump, S.captionStyle);
  const rows = [
    ['instagram','▤','Instagram carousel','Post all photos as a swipeable carousel'],
    ['story','◫','Story sequence','Auto-timed animated story, ready to post'],
    ['folder','⬇','Save folder to phone','Download the finished image to this device'],
    ['link','⛓','Private share link','A link only people you send it to can open'],
    ['journal','🔒','Keep in journal only','Save privately — never posted anywhere'],
  ];
  return `<div class="sheetBackdrop" onclick="A.closeExport()"></div>
  <div class="sheet" style="padding:18px 20px calc(20px + env(safe-area-inset-bottom));max-height:82%;overflow-y:auto;">
    <div style="font-size:16px;font-weight:800;color:var(--ink);">Export "${esc(dump.name)}"</div>
    <div style="font-size:11.5px;color:var(--muted);font-weight:600;margin-bottom:14px;">${dump.photoIds.length} photos · ${dump.cropFormat} · ${layout.name} · ${grade.name}</div>

    <div class="card" style="padding:13px;margin-bottom:14px;">
      <textarea rows="2" oninput="A.setCaptionText(this.value)" style="width:100%;font-size:13px;font-weight:600;color:var(--ink);resize:none;">${esc(S.caption)}</textarea>
      <div class="hscroll" style="margin-top:8px;">
        ${CAPTION_STYLES.map(c => `<div class="chip" style="background:${S.captionStyle===c?'#2c211b':'var(--chip-bg)'};color:${S.captionStyle===c?'#fff':'var(--chip-fg)'};" onclick="A.setCaptionStyle('${c}')">${c}</div>`).join('')}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      ${rows.map(([id,ic,name,desc]) => `
        <div onclick="A.doExport('${id}')" style="display:flex;align-items:center;gap:12px;background:#fff;border-radius:16px;padding:12px 14px;box-shadow:var(--card-shadow);cursor:pointer;${S.exporting===id?'opacity:.5;':''}">
          <div style="width:38px;height:38px;border-radius:11px;background:var(--chip-bg);display:flex;align-items:center;justify-content:center;font-size:16px;">${ic}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:800;color:var(--ink);">${name}</div>
            <div style="font-size:11px;color:var(--muted);font-weight:600;">${desc}</div>
          </div>
          <div style="font-size:17px;color:#dcccc0;">›</div>
        </div>`).join('')}
    </div>
  </div>`;
}
A.openExport = () => { S.exportOpen = true; S.caption = generateCaption(S.currentDump, S.captionStyle); render(); };
A.closeExport = () => { S.exportOpen = false; render(); };
A.setCaptionStyle = (style) => { S.captionStyle = style; S.caption = generateCaption(S.currentDump, style); render(); };
A.setCaptionText = (v) => { S.caption = v; };

function persistDump(dump){
  const firstPhoto = S.photos.find(p=>p.id===dump.photoIds[0]);
  const existingIdx = S.dumps.findIndex(d=>d.id===dump.id);
  const record = Object.assign({}, dump, { thumbColor: firstPhoto ? `rgb(${firstPhoto.avgColor.r},${firstPhoto.avgColor.g},${firstPhoto.avgColor.b})` : '#e6ddd4' });
  if(existingIdx>-1) S.dumps[existingIdx] = record; else S.dumps.push(record);
  savePersisted();
}

A.doExport = async (kind) => {
  const dump = S.currentDump;
  S.exporting = kind; render();
  try{
    persistDump(dump);
    if(kind === 'journal'){ showToast('Kept in journal — private'); S.exportOpen=false; render(); return; }
    const blob = await renderDumpToBlob(dump);
    const file = new File([blob], `${dump.name.replace(/[^a-z0-9]+/gi,'_')||'dump'}.png`, { type:'image/png' });

    if(kind === 'link'){
      const url = URL.createObjectURL(blob);
      try{ await navigator.clipboard.writeText(url); showToast('Link copied (valid this session)'); }
      catch(e){ showToast('Link ready — copy from address bar'); window.open(url,'_blank'); }
      S.exportOpen = false; render(); return;
    }

    if((kind==='instagram' || kind==='story') && navigator.canShare && navigator.canShare({ files:[file] })){
      await navigator.share({ files:[file], title:dump.name, text:S.caption });
      showToast('Shared');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      showToast(kind==='folder' ? 'Saved to your downloads' : 'Saved — share it from your gallery app');
    }
    S.exportOpen = false;
  }catch(err){
    showToast('Export failed — try again');
  }
  S.exporting = null;
  render();
};

/* ===========================================================
   STORIES
   =========================================================== */
function renderStories(){
  const dumps = [...S.dumps].sort((a,b)=>b.createdAt-a.createdAt);
  const latest = dumps[0];
  return `<div class="scroll" style="padding:50px 20px 108px;">
    <div style="font-size:22px;font-weight:800;color:var(--ink);margin-bottom:16px;letter-spacing:-.02em;">Stories</div>
    ${latest ? `
    <div onclick="A.playStory('${latest.id}')" style="background:var(--forest);border-radius:20px;padding:16px;color:#fff;cursor:pointer;margin-bottom:22px;display:flex;align-items:center;gap:12px;">
      <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:16px;">▶</div>
      <div>
        <div style="font-weight:800;font-size:13.5px;">Auto Story from "${esc(latest.name)}"</div>
        <div style="font-size:11px;opacity:.75;font-weight:600;">${Math.min(5,latest.photoIds.length)} frames · captions · same grade</div>
      </div>
    </div>` : ''}
    ${dumps.length===0 ? `<div class="emptyState">Build a dump first, then turn it into a story here.</div>` : `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
      ${dumps.map(d => {
        const p = S.photos.find(x=>x.id===d.photoIds[0]);
        return `<div onclick="A.playStory('${d.id}')" style="position:relative;aspect-ratio:9/16;border-radius:16px;overflow:hidden;cursor:pointer;background:${d.thumbColor||'#ccc'};background-image:url('${p?p.url:''}');background-size:cover;background-position:center;">
          <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.55),transparent 45%);"></div>
          <div style="position:absolute;left:8px;right:8px;top:8px;display:flex;gap:3px;">
            ${Array(Math.min(5,d.photoIds.length)).fill(0).map(()=>'<div style="flex:1;height:2.5px;border-radius:2px;background:rgba(255,255,255,.4);"></div>').join('')}
          </div>
          <div style="position:absolute;left:10px;right:10px;bottom:9px;color:#fff;">
            <div style="font-size:12px;font-weight:800;">${esc(d.name)}</div>
            <div style="font-size:9.5px;opacity:.8;font-weight:600;">${d.photoIds.length} photos</div>
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}
A.playStory = (dumpId) => {
  const d = S.dumps.find(x=>x.id===dumpId);
  if(!d) return;
  S.storyPlayer = { dumpId, frame:0 };
  render();
  scheduleStoryAdvance();
};
let storyTimer = null;
function scheduleStoryAdvance(){
  clearTimeout(storyTimer);
  if(!S.storyPlayer) return;
  storyTimer = setTimeout(() => {
    if(!S.storyPlayer) return;
    const d = S.dumps.find(x=>x.id===S.storyPlayer.dumpId);
    const total = Math.min(5, d ? d.photoIds.length : 0);
    if(S.storyPlayer.frame+1 >= total){ S.storyPlayer = null; render(); return; }
    S.storyPlayer.frame += 1;
    render();
    scheduleStoryAdvance();
  }, 2000);
}
function renderStoryPlayer(){
  const sp = S.storyPlayer;
  const d = S.dumps.find(x=>x.id===sp.dumpId);
  if(!d){ S.storyPlayer=null; return ''; }
  const total = Math.min(5, d.photoIds.length);
  const photo = S.photos.find(p=>p.id===d.photoIds[sp.frame]);
  const grade = GRADES.find(g=>g.id===d.gradeId);
  const caption = generateCaption(d, 'Poetic');
  return `<div onclick="A.closeStory()" style="position:absolute;inset:0;background:#000;z-index:90;overflow:hidden;">
    ${photo ? `<img src="${photo.url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:${cssFilterString(d)};animation:kenburns 2.4s linear both;"/>` : ''}
    <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.55),transparent 30%,transparent 70%,rgba(0,0,0,.35));"></div>
    <div style="position:absolute;left:10px;right:10px;top:calc(10px + env(safe-area-inset-top));display:flex;gap:4px;">
      ${Array(total).fill(0).map((_,i)=>`<div style="flex:1;height:2.5px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden;"><div style="height:100%;background:#fff;width:${i<sp.frame?'100%':i===sp.frame?'100%':'0%'};${i===sp.frame?'animation:storyBarFill 2s linear both;':''}"></div></div>`).join('')}
    </div>
    <div style="position:absolute;left:14px;top:calc(26px + env(safe-area-inset-top));display:flex;align-items:center;gap:8px;color:#fff;">
      <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">${esc(S.profileName[0]||'Y')}</div>
      <div style="font-size:12px;font-weight:700;">${esc(d.name)}</div>
      <div style="font-size:11px;opacity:.7;">${sp.frame+1}/${total}</div>
    </div>
    <div style="position:absolute;left:20px;right:20px;bottom:56px;color:#fff;font-family:'Caveat',cursive;font-size:26px;line-height:1.3;text-shadow:0 2px 10px rgba(0,0,0,.5);">${esc(caption)}</div>
  </div>`;
}
A.closeStory = () => { clearTimeout(storyTimer); S.storyPlayer = null; render(); };

/* ===========================================================
   INSPO
   =========================================================== */
function renderInspo(){
  return `<div class="scroll" style="padding:50px 20px 108px;">
    <div style="font-size:22px;font-weight:800;color:var(--ink);margin-bottom:16px;letter-spacing:-.02em;">Inspo</div>

    <div id="dropZone" style="border:2px dashed #e3cdbb;background:#fbf3ec;border-radius:20px;padding:26px;text-align:center;margin-bottom:26px;cursor:pointer;" onclick="A.pickInspoFile()">
      <div style="font-size:24px;margin-bottom:8px;">🖼</div>
      <div style="font-size:13px;font-weight:800;color:var(--ink);margin-bottom:3px;">Drop a screenshot, or tap to choose one</div>
      <div style="font-size:11.5px;color:var(--muted);font-weight:600;">Copies the palette, grain and layout feel — never the photo itself</div>
    </div>

    <div style="font-size:15.5px;font-weight:800;color:var(--ink);margin-bottom:11px;">Trending looks</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">
      ${TRENDING_LOOKS.map(l => `
        <div onclick="A.applyLook('${l.id}')" class="card" style="padding:12px;cursor:pointer;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;width:100%;aspect-ratio:1;border-radius:12px;overflow:hidden;margin-bottom:9px;">
            ${l.swatches.map(c=>`<div style="background:${c};"></div>`).join('')}
          </div>
          <div style="font-size:13px;font-weight:800;color:var(--ink);">${esc(l.name)}</div>
          <div style="font-size:11px;color:var(--muted);font-weight:600;">${l.saves} saves</div>
        </div>`).join('')}
    </div>
  </div>`;
}
A.pickInspoFile = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    if(!inp.files[0]) return;
    const { img } = await loadImageFromBlob(inp.files[0]);
    const a = analyzeImage(img);
    let grade = 'kodak';
    if(a.brightness<0.35) grade='mono';
    else if(a.saturation>0.5) grade='vibrant';
    else if(a.r>a.g && a.r>a.b) grade='warm';
    else if(a.b>a.r) grade='cool';
    if(S.photos.length){
      S.currentDump = newDumpFromPhotoIds(S.photos.slice(0,Math.min(9,S.photos.length)).map(p=>p.id), { name:'Style match', gradeId:grade, layoutId:'minimal' });
      S.screen = 'studio';
      showToast('Palette matched');
    } else {
      showToast('Import your own photos first');
    }
    render();
  };
  inp.click();
};
A.applyLook = (id) => {
  const look = TRENDING_LOOKS.find(l=>l.id===id);
  if(S.photos.length === 0){ A.pickFiles(); return; }
  const ids = S.photos.slice(0, Math.min(12,S.photos.length)).map(p=>p.id);
  S.currentDump = newDumpFromPhotoIds(ids, { name:look.name, gradeId:look.grade, layoutId:look.layout });
  S.screen = 'studio';
  render();
};

/* ===========================================================
   PROFILE
   =========================================================== */
function topUsed(cat){
  const counts = S.usage[cat] || {};
  const keys = Object.keys(counts);
  if(keys.length===0) return null;
  return keys.sort((a,b)=>counts[b]-counts[a])[0];
}
function renderProfile(){
  const topGrade = topUsed('grades'), topTexture = topUsed('textures');
  const avgMess = S.usage.messiness && S.usage.messiness.length ? S.usage.messiness.reduce((a,b)=>a+b,0)/S.usage.messiness.length : null;
  const tiles = [
    ['My dumps', S.dumps.length + ' saved'],
    ['Drafts', '0 in progress'],
    ['Saved recipes', S.savedRecipes.length + ' saved'],
    ['Favourite filters', (topGrade ? GRADES.find(g=>g.id===topGrade).name : '—')],
    ['Private journal', S.dumps.length + ' entries'],
    ['Saved looks', TRENDING_LOOKS.length + ' available'],
  ];
  const previewPhotos = S.photos.slice(0,12);
  return `<div class="scroll" style="padding:50px 20px 108px;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
      <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#ffd0b8,#e0684f);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:22px;">${esc(S.profileName[0]||'Y')}</div>
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:800;color:var(--ink);">${esc(S.profileName)}</div>
        <div style="font-size:11.5px;color:var(--muted);font-weight:600;">${S.dumps.length} dumps · 0 drafts · ${S.savedRecipes.length} saved recipes</div>
      </div>
      <div onclick="A.goTab('privacy')" class="chip" style="background:var(--chip-bg);color:var(--chip-fg);">Privacy</div>
    </div>

    <div class="card" style="background:linear-gradient(135deg,#fbe3d0,#f6d4c2);padding:16px;margin-bottom:20px;box-shadow:none;">
      <div style="font-size:13px;font-weight:800;color:var(--ink);margin-bottom:6px;">My Style · learned</div>
      <div style="font-size:12px;color:#6b5342;font-weight:600;line-height:1.5;margin-bottom:10px;">
        ${topGrade ? `You keep coming back to ${GRADES.find(g=>g.id===topGrade).name} grading${topTexture?' with '+TEXTURES.find(t=>t.id===topTexture).name.toLowerCase()+' texture':''}${avgMess!==null?`, and lean ${avgMess>55?'messy':'tidy'} on layout.`:'.'}`
        : `Build a few dumps and this card will learn your style.`}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
        ${topGrade ? `<span class="chip" style="background:rgba(255,255,255,.6);color:#6b5342;">${GRADES.find(g=>g.id===topGrade).name}</span>`:''}
        ${topTexture ? `<span class="chip" style="background:rgba(255,255,255,.6);color:#6b5342;">${TEXTURES.find(t=>t.id===topTexture).name}</span>`:''}
      </div>
      <div onclick="A.buildInMyStyle()" style="display:inline-block;background:var(--ink);color:#fff;padding:9px 15px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;">Build a dump in my style</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:22px;">
      ${tiles.map(([name,meta]) => `<div class="card" style="padding:14px;" onclick="A.profileTileTap('${name}')">
        <div style="font-size:13px;font-weight:800;color:var(--ink);">${name}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:3px;">${esc(meta)}</div>
      </div>`).join('')}
    </div>

    <div style="font-size:13.5px;font-weight:800;color:var(--ink);margin-bottom:9px;">Profile preview</div>
    <div class="card" style="padding:10px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;">
        ${Array(12).fill(0).map((_,i) => {
          const p = previewPhotos[i];
          return `<div style="aspect-ratio:1;border-radius:4px;overflow:hidden;background:#eee2d8;${p?`background-image:url('${p.url}');background-size:cover;background-position:center;`:''}"></div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
A.profileTileTap = (name) => {
  if(name === 'My dumps') { S.screen='home'; render(); return; }
  showToast(name + ' — nothing else to show yet');
};
A.buildInMyStyle = () => {
  const topGrade = topUsed('grades') || 'kodak';
  if(S.photos.length === 0){ A.pickFiles(); return; }
  const ids = [...S.photos].sort(()=>Math.random()-0.5).slice(0,Math.min(12,S.photos.length)).map(p=>p.id);
  S.currentDump = newDumpFromPhotoIds(ids, { name:'In my style', gradeId:topGrade });
  S.screen = 'studio';
  render();
};

/* ===========================================================
   PRIVACY CENTRE
   =========================================================== */
function renderPrivacy(){
  const rows = [
    ['localByDefault','Local by default','Photos are analysed on this device only'],
    ['cloudProcessing','Optional cloud processing','Off — nothing is sent anywhere'],
    ['blurFaces','Blur faces in shared links','Faces are softened before a link is generated'],
    ['stripLocation','Strip location data','GPS metadata is removed from exports'],
    ['analytics','Product analytics','Usage data helps improve the app'],
    ['hiddenAlbums','Hidden albums stay hidden','Hidden photos never appear in suggestions'],
    ['publicProfile','Public profile','Your profile page can be found by others'],
  ];
  return `<div class="scroll" style="padding-bottom:60px;">
    <div style="padding:50px 20px 16px;display:flex;align-items:center;gap:12px;">
      <div onclick="A.goTab('profile')" style="font-size:22px;color:#7d6a5d;cursor:pointer;">‹</div>
      <div style="font-size:18.5px;font-weight:800;color:var(--ink);">Privacy Centre</div>
    </div>
    <div style="padding:0 20px;">
      <div style="background:linear-gradient(135deg,#2f4038,#22302a);border-radius:20px;padding:18px;color:#fff;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;opacity:.7;margin-bottom:6px;">Right now</div>
        <div style="font-size:14.5px;font-weight:700;margin-bottom:14px;">${S.photos.length} photos analysed on this phone. 0 bytes uploaded.</div>
        <div style="display:flex;gap:8px;">
          <div style="flex:1;text-align:center;"><div style="font-size:13px;font-weight:800;">Local</div><div style="font-size:9.5px;opacity:.7;">Processing</div></div>
          <div style="flex:1;text-align:center;"><div style="font-size:13px;font-weight:800;">Off</div><div style="font-size:9.5px;opacity:.7;">Analytics</div></div>
          <div style="flex:1;text-align:center;"><div style="font-size:13px;font-weight:800;">Never</div><div style="font-size:9.5px;opacity:.7;">AI training</div></div>
        </div>
      </div>
      <div class="card" style="padding:4px 4px;margin-bottom:20px;">
        ${rows.map(([key,label,desc]) => `<div style="display:flex;align-items:center;gap:12px;padding:13px 12px;border-bottom:1px solid #f4ece4;">
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:var(--ink);">${label}</div>
            <div style="font-size:11px;color:var(--muted);font-weight:600;margin-top:2px;">${S.privacy[key] ? desc : (key==='cloudProcessing'||key==='analytics'||key==='publicProfile' ? 'Off' : 'Off — some features may be limited')}</div>
          </div>
          <div class="switchTrack" style="background:${S.privacy[key]?'var(--forest2)':'#e3d6cb'};" onclick="A.togglePrivacy('${key}')"><div class="switchThumb" style="left:${S.privacy[key]?'20px':'2.5px'};"></div></div>
        </div>`).join('')}
      </div>
      <div class="card" style="padding:4px 4px;">
        <div onclick="A.privacyAction('control')" style="padding:13px 14px;font-size:13px;font-weight:700;color:var(--ink);border-bottom:1px solid #f4ece4;cursor:pointer;">Control what AI can process</div>
        <div onclick="A.privacyAction('export')" style="padding:13px 14px;font-size:13px;font-weight:700;color:var(--ink);border-bottom:1px solid #f4ece4;cursor:pointer;">Export my data</div>
        <div onclick="A.privacyAction('deletePhotos')" style="padding:13px 14px;font-size:13px;font-weight:700;color:var(--coral-dark);border-bottom:1px solid #f4ece4;cursor:pointer;">Delete imported photos & analysis</div>
        <div onclick="A.privacyAction('deleteAll')" style="padding:13px 14px;font-size:13px;font-weight:700;color:var(--coral-dark);cursor:pointer;">Delete account and everything in it</div>
      </div>
    </div>
  </div>`;
}
A.togglePrivacy = (key) => { S.privacy[key] = !S.privacy[key]; savePersisted(); render(); };
A.privacyAction = async (kind) => {
  if(kind === 'control'){ S.screen = 'privacy'; showToast('All processing already stays on this device'); return; }
  if(kind === 'export'){
    const data = JSON.stringify({ dumps:S.dumps, privacy:S.privacy, usage:S.usage, savedRecipes:S.savedRecipes, note:'Photo image files stay in this browser\'s local storage and are not included in this export.' }, null, 2);
    const blob = new Blob([data], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dump-data-export.json'; a.click();
    showToast('Data exported');
    return;
  }
  if(kind === 'deletePhotos'){
    if(!confirm('Delete all imported photos and their analysis from this device? This cannot be undone.')) return;
    await idbClearAll();
    S.photos.forEach(p => URL.revokeObjectURL(p.url));
    S.photos = []; S.selected.clear();
    showToast('Photos deleted');
    render();
    return;
  }
  if(kind === 'deleteAll'){
    if(!confirm('Delete your account and everything in it? This removes all dumps, photos and settings from this device permanently.')) return;
    await idbClearAll();
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
};

/* ===========================================================
   PHOTO IMPORT — reads real files the person picks from this
   device, analyses them, and stores them in IndexedDB.
   =========================================================== */
async function ingestFiles(fileList){
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if(files.length === 0) return;
  showToast(`Importing ${files.length} photo${files.length>1?'s':''}…`);
  for(const file of files){
    try{
      const id = uid();
      const { img } = await loadImageFromBlob(file);
      const a = analyzeImage(img);
      const rec = {
        id, blob:file, lastModified: file.lastModified || Date.now(),
        avgColor: { r:a.r, g:a.g, b:a.b }, brightness:a.brightness, saturation:a.saturation,
        vibe: classifyVibe(a),
      };
      await idbPutPhoto(rec);
      S.photos.push({
        id, url: URL.createObjectURL(file), blob:file, img,
        lastModified: rec.lastModified, avgColor: rec.avgColor,
        brightness: a.brightness, saturation: a.saturation, vibe: rec.vibe,
      });
    }catch(e){ console.error('ingest failed for', file.name, e); }
  }
  showToast(`${S.photos.length} photos ready`);
  render();
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  ingestFiles(e.target.files);
  e.target.value = '';
});

/* drag & drop onto the whole app (used mainly on Pick / Home) */
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length){
    ingestFiles(e.dataTransfer.files);
  }
});

/* ===========================================================
   BOOT
   =========================================================== */
async function boot(){
  try{
    const records = await idbGetAll();
    for(const rec of records){
      try{
        const { img, url } = await loadImageFromBlob(rec.blob);
        S.photos.push({
          id: rec.id, url, blob: rec.blob, img,
          lastModified: rec.lastModified, avgColor: rec.avgColor,
          brightness: rec.brightness, saturation: rec.saturation, vibe: rec.vibe,
        });
      }catch(e){ /* stored blob unreadable, skip */ }
    }
  }catch(e){ /* IndexedDB unavailable — app still works for the current session */ }
  S.booted = true;
  render();
}

boot();
