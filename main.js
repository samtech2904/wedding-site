/* CONFIG: change these to point at YOUR backend (when ready) */
const CONFIG = {
  weddingDateISO: "2025-09-20T10:00:00", // 20 Sept 2025
  apiMessages: "/api/messages",          // HIGHLIGHT: Replace with your server endpoint
  apiPreferences: "/api/preferences",    // HIGHLIGHT: Replace with your server endpoint
  ownerEmail: "OWNER_EMAIL@exemple.com"  // HIGHLIGHT: Replace with your email if using server-side email
};

/* ===== Utilities ===== */
const $ = id => document.getElementById(id);
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function qs(sel){ return document.querySelector(sel); }

/* ===== QR code (uses qrcode lib) ===== */
function initQRCode() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || location.href;
  const qEl = $('qrcode');
  if(!qEl) return;
  // generate QR from id (or URL)
  QRCode.toCanvas(qEl, String(id), { width: 120 }, function (error) {
    if (error) console.error(error);
  });
}

/* ===== Countdown ===== */
function startCountdown(){
  const target = new Date(CONFIG.weddingDateISO).getTime();
  const set = ()=> {
    const now = Date.now();
    const diff = target - now;
    if(diff<=0){
      $('countDays').textContent = '0';
      $('countHours').textContent = '0';
      $('countMinutes').textContent = '0';
      $('countSeconds').textContent = '0';
      return;
    }
    const days = Math.floor(diff/(1000*60*60*24));
    const hours = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
    const mins = Math.floor((diff%(1000*60*60))/(1000*60));
    const secs = Math.floor((diff%(1000*60))/1000);
    $('countDays').textContent = days;
    $('countHours').textContent = hours;
    $('countMinutes').textContent = mins;
    $('countSeconds').textContent = secs;
  };
  set(); setInterval(set,1000);
}

/* ===== Hearts decorative ===== */
function createHearts(cnt=24){
  const container = document.getElementById('heartsContainer');
  const w = window.innerWidth;
  for(let i=0;i<cnt;i++){
    const el = document.createElement('div');
    el.className = 'heart';
    el.style.left = Math.round(Math.random()*w)+'px';
    el.style.fontSize = (10 + Math.random()*20) + 'px';
    const dur = 6 + Math.random()*8;
    el.style.animationDuration = dur + 's';
    el.style.animationDelay = (Math.random()*5)+'s';
    el.innerHTML = '❤';
    container.appendChild(el);
    setTimeout(()=> el.remove(), (dur+6)*1000);
  }
}

/* ===== Audio control ===== */
function setupAudio(){
  const audio = $('bgAudio');
  const btn = $('audioToggle');
  if(!audio || !btn) return;
  const tryPlay = ()=> audio.play().then(()=> {
    btn.textContent='🔊'; btn.setAttribute('aria-pressed','true');
  }).catch(()=> { btn.textContent='🔇'; btn.setAttribute('aria-pressed','false'); });
  window.addEventListener('load', tryPlay);
  btn.addEventListener('click', ()=> {
    if(audio.paused){ audio.play(); btn.textContent='🔊'; btn.setAttribute('aria-pressed','true'); }
    else { audio.pause(); btn.textContent='🔇'; btn.setAttribute('aria-pressed','false'); }
  });
}

/* ===== Download invitation (html2canvas) =====
   Captures the hero section and downloads PNG.
*/
function setupDownload(){
  const btn = $('downloadBtn');
  if(!btn) return;
  btn.addEventListener('click', async ()=>{
    const hero = document.querySelector('.hero');
    btn.disabled = true; btn.textContent = 'Génération...';
    try {
      const canvas = await html2canvas(hero, { scale: 2, useCORS: true });
      const data = canvas.toDataURL('image/png');
      const a = document.createElement('a'); a.href = data; a.download = 'Invitation_Raissa_Savio.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch(err){
      alert('Erreur lors de la génération. Vérifie images / CORS.');
      console.error(err);
    }
    btn.disabled = false; btn.textContent = 'Télécharger l\'invitation';
  });
}

/* ===== Messages (livre d'or) =====
   - Tries to POST to CONFIG.apiMessages
   - If fails, fallback to localStorage (inv_messages)
*/
async function postMessageToServer(payload){
  try {
    const res = await fetch(CONFIG.apiMessages, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if(res.ok) return { ok:true, from:'server' };
    return { ok:false, error:'Server response not OK' };
  } catch(e){ return { ok:false, error:e.message }; }
}

async function sendMessage(name, message){
  if(!message || message.trim().length<1) return { ok:false, error:'Message vide' };
  const payload = { name: name || 'Anonyme', message, date: new Date().toISOString(), invitationId: (new URLSearchParams(location.search)).get('id') || null };
  const serverRes = await postMessageToServer(payload);
  if(serverRes.ok) return serverRes;
  // fallback localStorage
  const key='inv_messages';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift({ ...payload, fallback:true });
  localStorage.setItem(key, JSON.stringify(existing));
  return { ok:true, from:'local' };
}

async function loadMessages(){
  const list = $('messagesList'); list.innerHTML = '<p class="muted">Chargement...</p>';
  // try server GET
  try {
    const res = await fetch(CONFIG.apiMessages);
    if(res.ok){
      const data = await res.json();
      renderMessages(data);
      return;
    }
  } catch(e){ /* ignore */ }
  // fallback local
  const stored = JSON.parse(localStorage.getItem('inv_messages') || '[]');
  renderMessages(stored);
}

function renderMessages(items=[]){
  const list = $('messagesList');
  if(!items || items.length===0){ list.innerHTML = '<p class="muted">Aucun message pour l’instant.</p>'; return; }
  list.innerHTML = '';
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'message-item';
    const name = escapeHtml(it.name); const msg = escapeHtml(it.message);
    const date = it.date ? new Date(it.date).toLocaleString() : '';
    el.innerHTML = `<strong>${name}</strong> <span class="muted small">• ${date}</span><div style="margin-top:6px">${msg}</div>`;
    list.appendChild(el);
  });
}

/* ===== Preferences (drinks) =====
   - Up to 2 selections
   - POST to CONFIG.apiPreferences or fallback to localStorage
*/
async function postPreferencesToServer(payload){
  try {
    const res = await fetch(CONFIG.apiPreferences, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if(res.ok) return { ok:true, from:'server' };
    return { ok:false, error:'Server returned non-ok' };
  } catch(e){ return { ok:false, error:e.message }; }
}

async function savePreferences(name, choices){
  if(!choices || choices.length===0) return { ok:false, error:'No choices' };
  const payload = { name: name || 'Anonyme', choices, date: new Date().toISOString(), invitationId: (new URLSearchParams(location.search)).get('id') || null };
  const serverRes = await postPreferencesToServer(payload);
  if(serverRes.ok) return serverRes;
  // fallback local
  const key='inv_prefs'; const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift({...payload, fallback:true});
  localStorage.setItem(key, JSON.stringify(existing));
  return { ok:true, from:'local' };
}

/* ===== UI bindings and init ===== */
function initUI(){
  // populate guest name if ?to= param present
  const params = new URLSearchParams(location.search);
  const to = params.get('to');
  if(to) $('guestName').value = decodeURIComponent(to);

  // init qrcode, countdown, hearts, audio
  initQRCode();
  startCountdown();
  createHearts(26);
  setupAudio();
  setupDownload();
  loadMessages();

  // send message
  $('sendMessageBtn').addEventListener('click', async ()=>{
    const name = $('guestName').value.trim();
    const message = $('guestMessage').value.trim();
    if(!message){ alert('Écris un message avant d\'envoyer'); return; }
    const res = await sendMessage(name, message);
    if(res.ok){ $('guestMessage').value = ''; loadMessages(); alert('Message enregistré ('+res.from+')'); }
    else alert('Erreur: '+(res.error||'Impossible d\'enregistrer'));
  });

  // drinks selection
  const drinkBtns = Array.from(document.querySelectorAll('.drink-btn'));
  drinkBtns.forEach(b => {
    b.addEventListener('click', () => {
      b.classList.toggle('active');
      // limit to 2
      const active = drinkBtns.filter(x=>x.classList.contains('active'));
      if(active.length>2) active[active.length-1].classList.remove('active');
    });
  });

  $('savePrefsBtn').addEventListener('click', async ()=>{
    const name = $('guestName').value.trim();
    const choices = Array.from(document.querySelectorAll('.drink-btn.active')).map(b=>b.dataset.drink);
    if(choices.length===0){ alert('Choisis au moins une boisson'); return; }
    const res = await savePreferences(name, choices);
    if(res.ok){ $('prefsSaved').classList.remove('hide'); setTimeout(()=> $('prefsSaved').classList.add('hide'), 3000); alert('Préférences enregistrées ('+res.from+')'); }
    else alert('Erreur: '+(res.error||'Impossible de sauvegarder'));
  });

  // venue placeholder: allow quick edit in page (for testing)
  const venue = document.getElementById('venueText');
  venue.addEventListener('click', ()=> {
    const newVal = prompt('Modifier le lieu (chapiteau) :', venue.textContent);
    if(newVal) venue.textContent = newVal;
  });
}

/* init after DOM ready */
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initUI);
else initUI();
