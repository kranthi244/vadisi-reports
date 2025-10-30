// ui.js — replacement (uses Firebase compat loaded in page)
// Assumes global `firebase` is available (app initialized in HTML).

/* ----------------- Setup ----------------- */
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- DOM refs (must match your HTML) ---------- */
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');

const reportForm = document.getElementById('reportForm'); // form element
const linkInput = document.getElementById('link');
const agencyInput = document.getElementById('agency');
const movieInput = document.getElementById('movie');
const amountInput = document.getElementById('amount');
const statusInput = document.getElementById('status');
const dateInput = document.getElementById('date');
const notesInput = document.getElementById('notes');

const addBtn = document.getElementById('addBtn'); // may exist, but we will use form submit
const clearBtn = document.getElementById('clearBtn'); // will hide
const exportPdfAddBtn = document.getElementById('exportPdf'); // will hide if inside add section

const reportsBody = document.getElementById('reportsBody');

const sumPendingEl = document.getElementById('sumPending');
const sumPaidEl = document.getElementById('sumPaid');
const sumThisMonthEl = document.getElementById('sumThisMonth');
const topAgencyEl = document.getElementById('topAgency');
const pendingByMonthEl = document.getElementById('pendingByMonth');
const pendingByAgencyEl = document.getElementById('pendingByAgency');
const pendingByMovieEl = document.getElementById('pendingByMovie');

const filterSearch = document.getElementById('filterSearch');
const filterAgency = document.getElementById('filterAgency');
const filterMovie = document.getElementById('filterMovie');
const filterStatus = document.getElementById('filterStatus');
const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const sortBy = document.getElementById('sortBy'); // optional
const applyFiltersBtn = document.getElementById('applyFilters');
const resetFiltersBtn = document.getElementById('resetFilters');

const exportPdfBtn = document.getElementById('exportCsv') || document.getElementById('exportPDF') || document.getElementById('exportPdf'); // use whichever exists; will act as PDF export

const agencyPane = document.getElementById('agencyPane');
const clearLocalBtn = document.getElementById('clearLocal'); // will hide
const remindersBtn = document.getElementById('showReminders') || document.getElementById('remindersBtn');

/* ---------- state ---------- */
let uid = null;
let unsub = null;
let cached = []; // all reports for current user

/* ---------- UI cleanup: remove unwanted elements/text but keep layout ---------- */
(function tidyUI(){
  // hide clear button in Add Report if present
  if(clearBtn) clearBtn.style.display = 'none';
  // hide export PDF inside add section if present
  if(exportPdfAddBtn) exportPdfAddBtn.style.display = 'none';
  // remove any hint line inside form-actions (text like "Date defaults to today")
  const hint = document.querySelector('.form-actions .hint') || document.querySelector('.form-actions .muted') || document.querySelector('.form-actions .small-muted');
  if(hint && hint.textContent && /date defaults/i.test(hint.textContent.toLowerCase())) hint.remove();
  // remove Clear Suggestions quick action
  if(clearLocalBtn) clearLocalBtn.style.display = 'none';
})();

/* ---------- helpers ---------- */
function fmtDDMON(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  const dd = String(d.getDate()).padStart(2,'0');
  const mon = d.toLocaleString('en-US',{month:'short'}).toUpperCase();
  const yyyy = d.getFullYear();
  return `${dd}-${mon}-${yyyy}`;
}
function parseDateInput(val){
  if(!val) return new Date().toISOString();
  return new Date(val + 'T00:00:00').toISOString();
}
function escapeHtml(s){ return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function showAlert(t){ console.log('ALERT:',t); } // lightweight: avoid UI changes

/* ---------- Auth ---------- */
loginBtn?.addEventListener('click', async ()=>{
  const provider = new firebase.auth.GoogleAuthProvider();
  try{ await auth.signInWithPopup(provider); }
  catch(e){ console.error('Sign-in failed', e); alert('Sign-in failed: '+(e.message||e)); }
});
logoutBtn?.addEventListener('click', ()=> auth.signOut());

auth.onAuthStateChanged(user=>{
  if(user){
    uid = user.uid;
    userInfo.textContent = user.email;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    startRealtime();
    loadLocalDatalists();
  } else {
    uid = null;
    userInfo.textContent = 'Not signed in';
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    stopRealtime();
    reportsBody.innerHTML = '<tr><td colspan="8" class="muted">Sign in to view your reports</td></tr>';
    clearSummary();
  }
});

/* ---------- Realtime listener ---------- */
function startRealtime(){
  if(!uid) return;
  if(unsub) unsub();
  const q = db.collection('reports').where('uid','==',uid).orderBy('date','desc');
  unsub = q.onSnapshot(snap=>{
    const arr = [];
    snap.forEach(d=> arr.push({ id:d.id, ...d.data() }));
    cached = arr;
    renderReports();
    summarize();
    saveLocalFromCached();
  }, err=>{
    console.error('Realtime error', err);
  });
}
function stopRealtime(){ if(unsub){ unsub(); unsub = null; cached=[]; } }

/* ---------- Add report (form submit) ---------- */
reportForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!uid) return alert('Sign in first');

  const doc = {
    link: linkInput.value.trim(),
    agency: agencyInput.value.trim(),
    movie: movieInput.value.trim(),
    amount: Number(amountInput.value) || 1200,
    status: statusInput.value || 'Pending',
    date: dateInput.value ? parseDateInput(dateInput.value) : new Date().toISOString(),
    notes: notesInput.value.trim() || '',
    uid: uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try{
    await db.collection('reports').add(doc);
    // clear only form fields (keep UI same)
    reportForm.reset();
    amountInput.value = 1200;
    dateInput.value = new Date().toISOString().slice(0,10);
    // realtime listener will update table + summary automatically
  }catch(e){
    console.error('Add failed:', e);
    alert('Add failed: ' + (e.message || e));
  }
});

/* ---------- Render reports (table) ---------- */
function renderReports(){
  const visible = applyFilters(cached);
  if(!visible.length){
    reportsBody.innerHTML = '<tr><td colspan="8" class="muted">No records</td></tr>';
    return;
  }
  reportsBody.innerHTML = visible.map(r=>{
    const displayDate = fmtDDMON(r.date);
    const isPending = (String(r.status||'').toLowerCase()!=='paid' && String(r.status||'').toLowerCase()!=='cleared');
    const ageDays = Math.floor((Date.now() - new Date(r.date).getTime())/(1000*60*60*24));
    const reminderClass = ( (String(r.status||'').toLowerCase()!=='paid' && String(r.status||'').toLowerCase()!=='cleared') && ageDays>30 ) ? 'reminder' : '';
    return `<tr data-id="${r.id}" class="${reminderClass}">
      <td class="link-cell"><a href="${escapeHtml(r.link||'')}" target="_blank">${escapeHtml(r.link||'')}</a></td>
      <td class="agency-cell" data-field="agency">${escapeHtml(r.agency||'')}</td>
      <td class="movie-cell" data-field="movie">${escapeHtml(r.movie||'')}</td>
      <td class="amount-cell" data-field="amount">₹${Number(r.amount)||0}</td>
      <td class="status-cell" data-field="status">${escapeHtml(r.status||'')}</td>
      <td class="date-cell" data-field="date">${displayDate}</td>
      <td class="notes-cell" data-field="notes">${escapeHtml(r.notes||'')}</td>
      <td class="actions-inline">
        <button class="icon-btn icon-yellow edit-inline" title="Edit">✎</button>
        <button class="icon-btn dup-inline" title="Duplicate">⎘</button>
        <button class="icon-btn del-inline" title="Delete" style="color:var(--danger)">🗑</button>
      </td>
    </tr>`;
  }).join('');
  attachRowListeners();
}

/* ---------- Row actions ---------- */
function attachRowListeners(){
  reportsBody.querySelectorAll('tr[data-id]').forEach(tr=>{
    const id = tr.dataset.id;
    const editBtn = tr.querySelector('.edit-inline');
    const dupBtn = tr.querySelector('.dup-inline');
    const delBtn = tr.querySelector('.del-inline');

    editBtn.onclick = ()=> enableInlineEdit(tr, id);
    dupBtn.onclick = async ()=>{
      const r = cached.find(x=> x.id===id);
      if(!r) return;
      const dup = {...r, date: new Date().toISOString(), createdAt: firebase.firestore.FieldValue.serverTimestamp()};
      delete dup.id;
      try{ await db.collection('reports').add(dup); }catch(e){ console.error('dup failed',e); }
    };
    delBtn.onclick = async ()=>{
      if(!confirm('Delete this report?')) return;
      try{ await db.collection('reports').doc(id).delete(); }catch(e){ console.error('del failed', e); }
    };
  });
}

/* ---------- Inline edit (save on blur) ---------- */
function enableInlineEdit(tr, id){
  const cells = tr.querySelectorAll('td[data-field]');
  cells.forEach(cell=>{
    const field = cell.getAttribute('data-field');
    cell.contentEditable = 'true';
    cell.focus();
    cell.addEventListener('blur', async function onBlur(){
      cell.removeEventListener('blur', onBlur);
      cell.contentEditable = 'false';
      let newV = cell.innerText.trim();
      if(field==='amount'){ newV = Number(newV.replace(/[^\d.-]/g,''))||0; }
      if(field==='date'){
        const parsed = Date.parse(newV);
        if(!isNaN(parsed)) newV = new Date(parsed).toISOString();
        else {
          // try DD-MON-YYYY -> convert
          const parts = newV.split('-');
          if(parts.length===3){
            const dd = parts[0], mon = parts[1], yy = parts[2];
            const p = Date.parse(mon + ' ' + dd + ' ' + yy);
            if(!isNaN(p)) newV = new Date(p).toISOString();
          }
        }
      }
      const update = {}; update[field] = newV;
      try{ await db.collection('reports').doc(id).update(update); }catch(e){ console.error('save failed', e); }
    });
  });
}

/* ---------- Filters (applied to cached) ---------- */
function applyFilters(list){
  let out = Array.from(list);
  const s = (filterSearch?.value||'').toLowerCase().trim();
  const a = (filterAgency?.value||'').toLowerCase().trim();
  const m = (filterMovie?.value||'').toLowerCase().trim();
  const st = (filterStatus?.value||'All');

  if(s) out = out.filter(r => (r.link||'').toLowerCase().includes(s) || (r.agency||'').toLowerCase().includes(s) || (r.movie||'').toLowerCase().includes(s));
  if(a) out = out.filter(r => (r.agency||'').toLowerCase().includes(a));
  if(m) out = out.filter(r => (r.movie||'').toLowerCase().includes(m));
  if(st && st!=='All') out = out.filter(r => (r.status||'') === st);

  // date range
  if(fromDate?.value) out = out.filter(r => (r.date||'') >= parseDateInput(fromDate.value));
  if(toDate?.value) out = out.filter(r => (r.date||'') <= parseDateInput(toDate.value));

  // sorting
  const sb = sortBy?.value || 'date_desc';
  out.sort((x,y)=>{
    switch(sb){
      case 'date_asc': return (x.date||'').localeCompare(y.date||'');
      case 'date_desc': return (y.date||'').localeCompare(x.date||'');
      case 'amount_asc': return (Number(x.amount)||0) - (Number(y.amount)||0);
      case 'amount_desc': return (Number(y.amount)||0) - (Number(x.amount)||0);
      default: return 0;
    }
  });

  return out;
}

applyFiltersBtn?.addEventListener('click', ()=> renderReports());
resetFiltersBtn?.addEventListener('click', ()=>{
  if(filterSearch) filterSearch.value='';
  if(filterAgency) filterAgency.value='';
  if(filterMovie) filterMovie.value='';
  if(filterStatus) filterStatus.value='All';
  if(fromDate) fromDate.value=''; if(toDate) toDate.value='';
  renderReports();
});

/* ---------- Summary (real-time) ---------- */
function summarize(){
  const list = cached || [];
  const totalPending = list.filter(r=> (r.status||'').toLowerCase()!=='paid' && (r.status||'').toLowerCase()!=='cleared').reduce((s,r)=> s + (Number(r.amount)||0), 0);
  const totalPaid = list.filter(r=> (r.status||'').toLowerCase()==='paid' || (r.status||'').toLowerCase()==='cleared').reduce((s,r)=> s + (Number(r.amount)||0), 0);
  sumPendingEl.textContent = `₹${totalPending}`;
  sumPaidEl.textContent = `₹${totalPaid}`;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const entriesThisMonth = list.filter(r => (r.date||'') >= monthStart).length;
  sumThisMonthEl.textContent = entriesThisMonth;

  // last 3 months pending aggregation
  const months = [2,1,0].map(i=>{
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return { label: d.toLocaleString('en-US',{month:'short', year:'numeric'}), year:d.getFullYear(), month:d.getMonth()+1 };
  });
  pendingByMonthEl.innerHTML = months.map(m=>{
    const sum = list.filter(r=>{
      const dt = new Date(r.date||'');
      return dt.getFullYear()===m.year && (dt.getMonth()+1)===m.month && ((r.status||'').toLowerCase()!=='paid' && (r.status||'').toLowerCase()!=='cleared');
    }).reduce((s,r)=> s + (Number(r.amount)||0), 0);
    return `<li>${m.label}: ₹${sum}</li>`;
  }).join('');

  // top 5 agencies pending
  const ag = {};
  list.filter(r=> (r.status||'').toLowerCase()!=='paid' && (r.status||'').toLowerCase()!=='cleared').forEach(r=> ag[r.agency] = (ag[r.agency]||0) + (Number(r.amount)||0));
  pendingByAgencyEl.innerHTML = Object.entries(ag).sort((a,b)=> b[1]-a[1]).slice(0,5).map(x=> `<li>${escapeHtml(x[0]||'—')} — ₹${x[1]}</li>`).join('') || '<li>—</li>';

  // top 5 movies pending
  const mv = {};
  list.filter(r=> (r.status||'').toLowerCase()!=='paid' && (r.status||'').toLowerCase()!=='cleared').forEach(r=> mv[r.movie] = (mv[r.movie]||0) + (Number(r.amount)||0));
  pendingByMovieEl.innerHTML = Object.entries(mv).sort((a,b)=> b[1]-a[1]).slice(0,5).map(x=> `<li>${escapeHtml(x[0]||'—')} — ₹${x[1]}</li>`).join('') || '<li>—</li>';

  // top agency overall
  const totByAgency = {};
  list.forEach(r=> totByAgency[r.agency] = (totByAgency[r.agency]||0) + (Number(r.amount)||0));
  const top = Object.keys(totByAgency).sort((a,b)=> (totByAgency[b]||0) - (totByAgency[a]||0))[0] || '—';
  topAgencyEl.textContent = top;

  // update small agencies pane too
  updateAgencyPane(list);
}

/* ---------- Agency pane ---------- */
function updateAgencyPane(list){
  const map = {};
  list.forEach(r=> { if(r.agency) map[r.agency] = (map[r.agency]||0) + (Number(r.amount)||0); });
  agencyPane.innerHTML = Object.entries(map).sort((a,b)=> b[1]-a[1]).map(x=> `<div class="agency-item"><div>${escapeHtml(x[0])}</div><div class="small-muted">₹${x[1]}</div></div>`).join('') || '<div class="small-muted">No agencies</div>';
}

/* ---------- Save local suggestions from cached ---------- */
function saveLocalFromCached(){ cached.forEach(r=> { if(r.agency) addLocalAgency(r.agency); if(r.movie) addLocalMovie(r.movie); }); }
function addLocalAgency(a){ if(!a) return; const arr = JSON.parse(localStorage.getItem('v_agencies')||'[]'); if(!arr.includes(a)){ arr.unshift(a); if(arr.length>80) arr.pop(); localStorage.setItem('v_agencies', JSON.stringify(arr)); loadLocalDatalists(); } }
function addLocalMovie(m){ if(!m) return; const arr = JSON.parse(localStorage.getItem('v_movies')||'[]'); if(!arr.includes(m)){ arr.unshift(m); if(arr.length>80) arr.pop(); localStorage.setItem('v_movies', JSON.stringify(arr)); loadLocalDatalists(); } }
function loadLocalDatalists(){ const a = JSON.parse(localStorage.getItem('v_agencies')||'[]'); const m = JSON.parse(localStorage.getItem('v_movies')||'[]'); document.getElementById('agencyList').innerHTML = a.map(x=> `<option value="${escapeHtml(x)}">`).join(''); document.getElementById('movieList').innerHTML = m.map(x=> `<option value="${escapeHtml(x)}">`).join(''); }

/* ---------- Export filtered reports to PDF (print view) ---------- */
exportPdfBtn?.addEventListener('click', ()=>{
  const list = applyFilters(cached);
  if(!list.length) return alert('No rows to export');
  const printable = `
    <html><head><title>Telugu Swaggers Export</title>
    <style>body{font-family:Arial;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f4f4f4}</style>
    </head><body>
    <h3>Telugu Swaggers — Export</h3>
    <table><thead><tr><th>Link</th><th>Agency</th><th>Movie</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
    <tbody>${list.map(r=> `<tr><td>${escapeHtml(r.link||'')}</td><td>${escapeHtml(r.agency||'')}</td><td>${escapeHtml(r.movie||'')}</td><td>₹${r.amount||0}</td><td>${escapeHtml(r.status||'')}</td><td>${fmtDDMON(r.date)}</td></tr>`).join('')}</tbody></table>
    </body></html>`;
  const w = window.open('','_blank'); w.document.write(printable); w.document.close(); setTimeout(()=> w.print(),600);
});

/* ---------- Reminders action ---------- */
remindersBtn?.addEventListener('click', ()=>{
  const reminders = cached.filter(r=> (String(r.status||'').toLowerCase()!=='paid' && String(r.status||'').toLowerCase()!=='cleared') && ((Date.now() - new Date(r.date).getTime())/(1000*60*60*24) > 30));
  if(!reminders.length) return alert('No reminders');
  const row = Array.from(document.querySelectorAll('#reportsBody tr')).find(tr => reminders.some(r=> r.id === tr.dataset.id));
  if(row) row.scrollIntoView({behavior:'smooth', block:'center'});
  alert(reminders.length + ' pending reminders (30+ days)');
});

/* ---------- initial local datalists load ---------- */
loadLocalDatalists();

/* ---------- Expose for debug ---------- */
window.vadisi = { cached, startRealtime, stopRealtime, renderReports, summarize };

