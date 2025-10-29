// ui.js (module) — full frontend logic with Firebase initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ---------- Firebase config (your SDK) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

/* ---------- Init ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* ---------- DOM ---------- */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailEl = document.getElementById("userEmail");

const reportForm = document.getElementById("reportForm");
const linkInput = document.getElementById("link");
const agencyInput = document.getElementById("agency");
const movieInput = document.getElementById("movie");
const amountInput = document.getElementById("amount");
const statusInput = document.getElementById("status");
const dateInput = document.getElementById("date");
const notesInput = document.getElementById("notes");

const agencyDatalist = document.getElementById("agencyDatalist");
const movieDatalist = document.getElementById("movieDatalist");
const agencyListPane = document.getElementById("agencyList");

const totalPendingEl = document.getElementById("totalPending");
const totalPaidEl = document.getElementById("totalPaid");
const totalThisMonthEl = document.getElementById("totalThisMonth");
const topAgencyEl = document.getElementById("topAgency");
const pendingByMonthEl = document.getElementById("pendingByMonth");
const pendingByAgencyEl = document.getElementById("pendingByAgency");
const pendingByMovieEl = document.getElementById("pendingByMovie");

const filterSearch = document.getElementById("filterSearch");
const filterStatus = document.getElementById("filterStatus");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const sortBy = document.getElementById("sortBy");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const exportCSVBtn = document.getElementById("exportCSV");
const exportPdfBtn = document.getElementById("exportPdf");

const reportsBody = document.getElementById("reportsBody");
const agencyPane = document.getElementById("agencyList");
const themeToggle = document.getElementById("themeToggle");
const toast = document.getElementById("toast");

/* ---------- State ---------- */
let currentUser = null;
let unsub = null;
let cached = []; // cached reports for current user

/* ---------- Helpers ---------- */
function showToast(msg, t=2200){
  if(!toast) return;
  toast.hidden = false;
  toast.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> toast.hidden = true, t);
}
function fmtDisplayDate(iso){
  if(!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2,'0');
  const mon = d.toLocaleString('en-US',{month:'short'}).toUpperCase(); // e.g., JAN
  const yyyy = d.getFullYear();
  return `${dd}-${mon}-${yyyy}`;
}
function isoFromInputDate(val){
  // val is yyyy-mm-dd
  if(!val) return "";
  const t = new Date(val);
  return t.toISOString();
}
function todayISODate(){
  return new Date().toISOString();
}
function monthsAgoLabels(n){
  const arr=[];
  const now = new Date();
  for(let i= n-1;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    arr.push({ label: d.toLocaleString('en-US',{month:'short', year:'numeric'}), year:d.getFullYear(), month:d.getMonth()+1 });
  }
  return arr;
}

/* ---------- Authentication ---------- */
loginBtn.addEventListener("click", async ()=>{
  try{
    await signInWithPopup(auth, provider);
  }catch(e){
    console.error(e);
    showToast("Sign-in failed: " + (e.message||e));
  }
});
logoutBtn.addEventListener("click", async ()=>{
  await signOut(auth);
});

onAuthStateChanged(auth, user=>{
  if(user){
    currentUser = user;
    userEmailEl.textContent = user.email;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    startRealtime();
    loadSuggestionsFromLocal();
  } else {
    currentUser = null;
    userEmailEl.textContent = "Not signed in";
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    stopRealtime();
    reportsBody.innerHTML = `<tr><td colspan="7" class="muted">Sign in to view your reports</td></tr>`;
  }
});

/* ---------- Realtime listener for user's reports ---------- */
function startRealtime(){
  if(!currentUser) return;
  if(unsub) unsub();
  const col = collection(db, "users", currentUser.uid, "reports");
  const q = query(col, orderBy("date","desc"));
  unsub = onSnapshot(q, snap=>{
    const arr=[];
    snap.forEach(d=> arr.push({ id:d.id, ...d.data() }));
    cached = arr;
    renderAndSummarize();
  }, err=>{
    console.error("Realtime error", err);
    showToast("Realtime error");
  });
}
function stopRealtime(){ if(unsub){ unsub(); unsub = null; cached = []; } }

/* ---------- Auto-suggestions (localStorage) ---------- */
function loadSuggestionsFromLocal(){
  const agencies = JSON.parse(localStorage.getItem("agencies")||"[]");
  const movies = JSON.parse(localStorage.getItem("movies")||"[]");
  agencyDatalist.innerHTML = agencies.map(a=>`<option value="${escapeHtml(a)}">`).join("");
  movieDatalist.innerHTML = movies.map(m=>`<option value="${escapeHtml(m)}">`).join("");
  renderAgencyPane(agencies);
}
function addSuggestion(key, value){
  if(!value) return;
  const arr = JSON.parse(localStorage.getItem(key) || "[]");
  if(!arr.includes(value)){
    arr.unshift(value);
    if(arr.length>50) arr.pop();
    localStorage.setItem(key, JSON.stringify(arr));
  }
}

/* ---------- Add Report ---------- */
reportForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!currentUser) return showToast("Sign in first");
  const data = {
    link: linkInput.value.trim(),
    agency: agencyInput.value.trim(),
    movie: movieInput.value.trim(),
    amount: Number(amountInput.value) || 1200,
    status: statusInput.value || "Pending",
    // store date as ISO midnight for consistency; if input empty, use today
    date: dateInput.value ? new Date(dateInput.value).toISOString() : new Date().toISOString(),
    notes: notesInput ? notesInput.value.trim() : "",
    createdAt: serverTimestamp()
  };

  try{
    await addDoc(collection(db, "users", currentUser.uid, "reports"), data);
    addSuggestion("agencies", data.agency);
    addSuggestion("movies", data.movie);
    loadSuggestionsFromLocal();
    reportForm.reset();
    amountInput.value = "1200";
    dateInput.value = new Date().toISOString().slice(0,10);
    showToast("Added");
  }catch(e){
    console.error(e); showToast("Add failed");
  }
});

/* ---------- Inline editing (contenteditable) ---------- */
function makeCellEditable(cell, id, field){
  cell.contentEditable = "true";
  cell.addEventListener("blur", async function onBlur(){
    cell.removeEventListener("blur", onBlur);
    const newVal = cell.innerText.trim();
    // map field types: amount numbers, date format input expected
    const update = {};
    if(field === "amount"){
      update[field] = Number(newVal) || 0;
    } else if(field === "date"){
      // accept DD-MON-YYYY or yyyy-mm-dd — try parse
      const parsed = new Date(newVal);
      if(!isNaN(parsed)) update[field] = parsed.toISOString();
      else {
        // try reverse from display like 12-OCT-2025
        const parts = newVal.split("-");
        if(parts.length===3){
          const day = parts[0], mon = parts[1], yr = parts[2];
          const parsed2 = new Date(`${mon} ${day} ${yr}`);
          if(!isNaN(parsed2)) update[field] = parsed2.toISOString();
        }
      }
    } else {
      update[field] = newVal;
    }
    if(Object.keys(update).length){
      try{
        await updateDoc(doc(db, "users", currentUser.uid, "reports", id), update);
        showToast("Saved");
        // update suggestions if needed
        if(field==="agency") addSuggestion("agencies", newVal);
        if(field==="movie") addSuggestion("movies", newVal);
        loadSuggestionsFromLocal();
      }catch(err){ console.error(err); showToast("Save failed"); }
    }
    cell.contentEditable = "false";
  });
}

/* ---------- Render table and summary ---------- */
function renderAndSummarize(){
  // apply UI filters & sorting then render
  const visible = applyFiltersToList(cached);
  renderTable(visible);
  updateSummary(cached); // summary often on full cached, but you can use visible as needed
  updateAgencyPane(cached);
}

function applyFiltersToList(list){
  let out = Array.from(list);
  const s = (filterSearch.value||"").toLowerCase().trim();
  const st = filterStatus.value;
  const fFrom = fromDate.value;
  const fTo = toDate.value;
  const sb = sortBy.value;

  if(s) out = out.filter(r => (r.link||"").toLowerCase().includes(s) || (r.agency||"").toLowerCase().includes(s) || (r.movie||"").toLowerCase().includes(s));
  if(st && st!=="All") out = out.filter(r=> (r.status||"") === st);
  if(fFrom) out = out.filter(r => (r.date||"") >= new Date(fFrom).toISOString());
  if(fTo) out = out.filter(r => (r.date||"") <= new Date(fTo).toISOString());

  // sorting
  out.sort((a,b)=>{
    switch(sb){
      case "date_asc": return (a.date||"").localeCompare(b.date||"");
      case "date_desc": return (b.date||"").localeCompare(a.date||"");
      case "amount_asc": return (Number(a.amount)||0) - (Number(b.amount)||0);
      case "amount_desc": return (Number(b.amount)||0) - (Number(a.amount)||0);
      default: return 0;
    }
  });

  return out;
}

function renderTable(list){
  if(!list.length){
    reportsBody.innerHTML = `<tr><td colspan="7" class="muted">No records</td></tr>`;
    return;
  }
  reportsBody.innerHTML = list.map(r=>{
    // highlight pending older than 30 days
    const isPending = ((r.status||"").toLowerCase()!=="paid");
    const dateISO = r.date || new Date().toISOString();
    const ageDays = Math.floor((Date.now() - new Date(dateISO)) / (1000*60*60*24));
    const reminderClass = (isPending && ageDays > 30) ? 'row-reminder' : '';
    const statusClass = (r.status && r.status.toLowerCase()==="paid") ? 'status-paid' : 'status-pending';
    const displayDate = fmtDisplayDate(dateISO);
    return `
      <tr data-id="${r.id}" class="${reminderClass}">
        <td class="cell link-cell"><a href="${escapeHtml(r.link||'')}" target="_blank">${escapeHtml(r.link||'')}</a></td>
        <td class="cell agency-cell" data-field="agency">${escapeHtml(r.agency||'')}</td>
        <td class="cell movie-cell" data-field="movie">${escapeHtml(r.movie||'')}</td>
        <td class="cell amount-cell" data-field="amount">₹${Number(r.amount)||0}</td>
        <td class="cell status-cell ${statusClass}" data-field="status">${escapeHtml(r.status||'')}</td>
        <td class="cell date-cell" data-field="date">${displayDate}</td>
        <td class="cell notes-cell" data-field="notes">${escapeHtml(r.notes||'')}</td>
      </tr>
    `;
  }).join('');
  // attach per-row action icons (edit/duplicate/delete inline)
  attachRowActions();
}

function attachRowActions(){
  // create action icons at end of each row (not in separate column)
  const rows = [...reportsBody.querySelectorAll("tr[data-id]")];
  rows.forEach(tr=>{
    // remove existing inline actions container if present
    tr.querySelectorAll(".actions-inline-placeholder").forEach(n=>n.remove());

    const id = tr.dataset.id;
    const actionsTd = document.createElement("td");
    actionsTd.className = "actions-inline actions-inline-placeholder";
    actionsTd.innerHTML = `
      <button title="Edit inline" class="icon-btn yellow edit-inline">✎</button>
      <button title="Duplicate" class="icon-btn dup-inline">⎘</button>
      <button title="Delete" class="icon-btn" style="color:${'#e85a4f'}">🗑</button>
    `;
    // append actions cell to row (so actions are visually at row end)
    tr.appendChild(actionsTd);

    // events
    actionsTd.querySelector(".edit-inline").onclick = ()=>{
      // turn all editable cells for this row into contenteditable
      const id = tr.dataset.id;
      const cells = tr.querySelectorAll("td.cell");
      cells.forEach(cell=>{
        const field = cell.getAttribute("data-field");
        if(!field) return;
        // display raw value for amount/date: amount remove currency symbol, date show dd-MON-YYYY
        if(field==="amount"){
          cell.innerText = String((Number(cell.innerText.replace(/[^\d.-]/g,''))||0));
        }
        if(field==="date"){
          // convert display date back to yyyy-mm-dd for editing
          // user can paste any parseable date; we keep visible text otherwise
        }
        makeCellEditable(cell, id, field);
      });
      showToast("Edit inline: make changes and blur to save");
    };

    actionsTd.querySelector(".dup-inline").onclick = async ()=>{
      const r = cached.find(x=> x.id === id);
      if(!r) return;
      const dup = { ...r, date: new Date().toISOString(), createdAt: serverTimestamp() };
      delete dup.id;
      try{ await addDoc(collection(db, "users", currentUser.uid, "reports"), dup); showToast("Duplicated"); }
      catch(e){ console.error(e); showToast("Duplicate failed");}
    };

    actionsTd.querySelector(".icon-btn[style]")?.addEventListener("click", async ()=>{
      if(!confirm("Delete this report?")) return;
      try{ await deleteDoc(doc(db, "users", currentUser.uid, "reports", id)); showToast("Deleted"); }
      catch(e){ console.error(e); showToast("Delete failed"); }
    });
  });
}

/* ---------- Summary calculations ---------- */
function updateSummary(list){
  // total pending and total paid across all user's reports
  const totalPending = list.filter(r => ((r.status||'').toLowerCase()!=='paid')).reduce((s,r)=> s + (Number(r.amount)||0), 0);
  const totalPaid = list.filter(r => ((r.status||'').toLowerCase()==='paid')).reduce((s,r)=> s + (Number(r.amount)||0), 0);
  totalPendingEl.textContent = `₹${totalPending}`;
  totalPaidEl.textContent = `₹${totalPaid}`;

  // total entries this month
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const totalThisMonth = list.filter(r => (r.date||'') >= mStart).length;
  totalThisMonthEl.textContent = totalThisMonth;

  // top agency by count
  const agencyCount = {};
  list.forEach(r => agencyCount[r.agency] = (agencyCount[r.agency]||0) + 1 );
  const topAgency = Object.keys(agencyCount).sort((a,b)=> (agencyCount[b]-agencyCount[a]))[0] || '—';
  topAgencyEl.textContent = topAgency;

  // pending by month last 3
  const months = monthsAgoLabels(3); // [{label,year,month},...]
  const pendingByMonth = months.map(m=>{
    const total = list.filter(r=>{
      const d = new Date(r.date||'');
      return (Number(r.amount)||0) && ((r.status||'').toLowerCase()!=='paid') && (d.getFullYear()===m.year) && (d.getMonth()+1===m.month);
    }).reduce((s,r)=> s + (Number(r.amount)||0), 0);
    return { label: m.label, total };
  });
  pendingByMonthEl.innerHTML = pendingByMonth.map(x=> `<li>${x.label}: ₹${x.total}</li>`).join("");

  // pending top5 by agency
  const agencyPending = {};
  list.filter(r=> (r.status||'').toLowerCase()!=='paid').forEach(r=>{
    agencyPending[r.agency] = (agencyPending[r.agency]||0) + (Number(r.amount)||0);
  });
  const topAgencyArr = Object.entries(agencyPending).sort((a,b)=> b[1]-a[1]).slice(0,5);
  pendingByAgencyEl.innerHTML = topAgencyArr.map(x=> `<li>${escapeHtml(x[0]||'')} — ₹${x[1]}</li>`).join("") || "<li>—</li>";

  // pending top5 by movie
  const moviePending = {};
  list.filter(r=> (r.status||'').toLowerCase()!=='paid').forEach(r=>{
    moviePending[r.movie] = (moviePending[r.movie]||0) + (Number(r.amount)||0);
  });
  const topMovieArr = Object.entries(moviePending).sort((a,b)=> b[1]-a[1]).slice(0,5);
  pendingByMovieEl.innerHTML = topMovieArr.map(x=> `<li>${escapeHtml(x[0]||'')} — ₹${x[1]}</li>`).join("") || "<li>—</li>";
}

/* ---------- Agency left pane ---------- */
function updateAgencyPane(list){
  const map = {};
  list.forEach(r=> map[r.agency] = (map[r.agency]||0) + (Number(r.amount)||0));
  const arr = Object.entries(map).sort((a,b)=> b[1]-a[1]);
  agencyPane.innerHTML = arr.map(x=> `<div class="agency-item"><strong>${escapeHtml(x[0]||'')}</strong><div class="muted small">₹${x[1]}</div></div>`).join('') || '<div class="muted">No agencies</div>';
}

/* ---------- Filters UI ---------- */
applyFiltersBtn.addEventListener("click", ()=> renderAndSummarize());
resetFiltersBtn.addEventListener("click", ()=>{
  filterSearch.value = ""; filterStatus.value = "All"; fromDate.value=""; toDate.value=""; sortBy.value="date_desc";
  renderAndSummarize();
});

/* ---------- Export CSV ---------- */
exportCSVBtn.addEventListener("click", ()=>{
  const visible = applyFiltersToList(cached);
  if(!visible.length) return showToast("No rows to export");
  const rows = [["Link","Agency","Movie","Amount","Status","Date","Notes"], ...visible.map(r=> [r.link||"", r.agency||"", r.movie||"", r.amount||"", r.status||"", fmtDisplayDate(r.date), r.notes||""]) ];
  const csv = rows.map(r=> r.map(c=> `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `vadisi_reports_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  showToast("CSV exported");
});

/* ---------- Export PDF (printable) ---------- */
exportPdfBtn.addEventListener("click", ()=>{
  const visible = applyFiltersToList(cached);
  const printable = `
    <html><head><title>Vadisi Reports</title>
    <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f4f4f4}</style>
    </head><body>
      <h2>Vadisi Reports — Export</h2>
      <table><thead><tr><th>Link</th><th>Agency</th><th>Movie</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${ visible.map(r => `<tr><td>${escapeHtml(r.link||'')}</td><td>${escapeHtml(r.agency||'')}</td><td>${escapeHtml(r.movie||'')}</td><td>₹${r.amount||0}</td><td>${escapeHtml(r.status||'')}</td><td>${fmtDisplayDate(r.date)}</td></tr>` ).join('') }</tbody></table>
    </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(printable);
  w.document.close();
  w.focus();
  // open print dialog — user can Save as PDF
  setTimeout(()=> w.print(), 600);
});

/* ---------- Theme toggle ---------- */
(function(){
  const key = "vui_theme";
  const el = document.documentElement;
  function applyTheme(t){
    if(t === "dark") el.style.background = "#0b1220", el.style.color = "#fff";
    else el.style.background = "";
  }
  const saved = localStorage.getItem(key) || "light";
  applyTheme(saved);
  themeToggle.addEventListener("click", ()=>{
    const cur = localStorage.getItem(key) || "light";
    const next = cur==="light" ? "dark" : "light";
    localStorage.setItem(key, next);
    applyTheme(next);
    showToast("Theme: " + next);
  });
})();

/* ---------- Suggestions store on form focus/blur ---------- */
function loadSuggestionsFromLocalOnStart(){
  loadSuggestionsFromLocal();
  amountInput.value = "1200";
  dateInput.value = new Date().toISOString().slice(0,10);
}
loadSuggestionsFromLocalOnStart();

/* ---------- Utility escape ---------- */
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

/* ---------- Initialize handlers for inline clicks like status toggle, row click ---------- */
function attachRowActions(){} // placeholder — implemented in renderTable with per-row actions

/* ---------- Utility: load suggestions into datalists from local storage ---------- */
function loadSuggestionsFromLocal(){
  const ag = JSON.parse(localStorage.getItem("agencies")||"[]");
  const mv = JSON.parse(localStorage.getItem("movies")||"[]");
  agencyDatalist.innerHTML = ag.map(a=>`<option value="${escapeHtml(a)}">`).join("");
  movieDatalist.innerHTML = mv.map(m=>`<option value="${escapeHtml(m)}">`).join("");
  // also update left pane
  agencyListPane.innerHTML = ag.length ? ag.slice(0,30).map(x=>`<div>${escapeHtml(x)}</div>`).join("") : "<div class='muted'>No agencies</div>";
}

/* ---------- helper to ensure date input shows today if empty ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  if(dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
  // ensure clear form resets defaults
  document.getElementById("clearForm").addEventListener("click", ()=>{
    reportForm.reset();
    amountInput.value = "1200";
    dateInput.value = new Date().toISOString().slice(0,10);
  });
});

/* ---------- basic search on typing for instant filter ---------- */
filterSearch?.addEventListener("input", ()=> renderAndSummarize());

/* ---------- finalize: expose some debug helpers (optional) ---------- */
window._vui = { cached, renderAndSummarize, startRealtime, stopRealtime };
