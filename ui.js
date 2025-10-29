// ui.js — Frontend only. Uses existing Firebase app (do NOT initializeApp here).
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// DOM
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");

const reportForm = document.getElementById("reportForm");
const linkInput = document.getElementById("link");
const agencyInput = document.getElementById("agency");
const movieInput = document.getElementById("movie");
const amountInput = document.getElementById("amount");
const statusInput = document.getElementById("status");
const dateInput = document.getElementById("date");
const notesInput = document.getElementById("notes");

const totalReportsEl = document.getElementById("totalReports");
const pendingAmountEl = document.getElementById("pendingAmount");
const paidAmountEl = document.getElementById("paidAmount");
const topAgencyEl = document.getElementById("topAgency");

const searchText = document.getElementById("searchText");
const filterStatus = document.getElementById("filterStatus");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const sortBy = document.getElementById("sortBy");
const applyFilters = document.getElementById("applyFilters");
const resetFilters = document.getElementById("resetFilters");
const exportCSVBtn = document.getElementById("exportCSV");

const reportsBody = document.getElementById("reportsBody");
const toast = document.getElementById("toast");

// firebase objects (use already-initialized app)
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// state
let uid = null;
let realtimeUnsub = null;
let cachedReports = []; // current user's reports array

// Helper: toast
function showToast(msg, timeout=2500){
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> toast.hidden = true, timeout);
}

// Auth handlers
loginBtn.addEventListener("click", async ()=>{
  try{
    await signInWithPopup(auth, provider);
  }catch(e){
    showToast("Sign in failed: " + (e.message||e));
  }
});
logoutBtn.addEventListener("click", async ()=>{
  await signOut(auth);
});

onAuthStateChanged(auth, user=>{
  if(user){
    uid = user.uid;
    userEmail.textContent = user.email;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    // show sections by removing hidden (index.html shows sections always; if yours hides them, adjust)
    startRealtime();
  } else {
    uid = null;
    userEmail.textContent = "Not signed in";
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    stopRealtime();
    reportsBody.innerHTML = `<tr><td colspan="8" class="muted">Sign in to view your reports</td></tr>`;
    totalReportsEl.textContent = "0";
    pendingAmountEl.textContent = "₹0";
    paidAmountEl.textContent = "₹0";
    topAgencyEl.textContent = "—";
  }
});

// Real-time listener
function startRealtime(){
  if(!uid) return;
  // unsubscribe previous
  if(realtimeUnsub) realtimeUnsub();

  const colRef = collection(db, "users", uid, "reports");
  const q = query(colRef, orderBy("date","desc"));
  realtimeUnsub = onSnapshot(q, snap=>{
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    cachedReports = arr;
    applyFiltersAndRender();
  }, err=>{
    showToast("Realtime error: "+err.message);
    console.error(err);
  });
}

function stopRealtime(){
  if(realtimeUnsub) { realtimeUnsub(); realtimeUnsub = null; }
  cachedReports = [];
}

// Add report
reportForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!uid) { showToast("Sign in first"); return; }

  const data = {
    link: linkInput.value.trim(),
    agency: agencyInput.value.trim(),
    movie: movieInput.value.trim(),
    amount: Number(amountInput.value) || 0,
    status: statusInput.value || "Pending",
    date: dateInput.value || new Date().toISOString().split("T")[0],
    notes: (notesInput ? notesInput.value.trim() : "")
  };

  try{
    await addDoc(collection(db, "users", uid, "reports"), data);
    reportForm.reset();
    dateInput.value = new Date().toISOString().split("T")[0];
    showToast("Added");
  }catch(e){
    showToast("Add failed: "+(e.message||e));
    console.error(e);
  }
});

// Render + filtering + sorting
function applyFiltersAndRender(){
  const search = (searchText.value||"").toLowerCase().trim();
  const fStatus = filterStatus.value;
  const fFrom = fromDate.value;
  const fTo = toDate.value;
  const sort = sortBy.value;

  let list = cachedReports.slice();

  // filters
  if(search){
    list = list.filter(r=>{
      return (r.link||"").toLowerCase().includes(search) ||
             (r.agency||"").toLowerCase().includes(search) ||
             (r.movie||"").toLowerCase().includes(search);
    });
  }
  if(fStatus && fStatus !== "All"){
    list = list.filter(r => (r.status||"") === fStatus);
  }
  if(fFrom){
    list = list.filter(r => (r.date||"") >= fFrom);
  }
  if(fTo){
    list = list.filter(r => (r.date||"") <= fTo);
  }

  // sorting
  list.sort((a,b)=>{
    switch(sort){
      case "date_asc": return (a.date||"").localeCompare(b.date||"");
      case "date_desc": return (b.date||"").localeCompare(a.date||"");
      case "amount_asc": return (Number(a.amount)||0) - (Number(b.amount)||0);
      case "amount_desc": return (Number(b.amount)||0) - (Number(a.amount)||0);
      case "agency_asc": return (a.agency||"").localeCompare(b.agency||"");
      case "agency_desc": return (b.agency||"").localeCompare(a.agency||"");
      default: return 0;
    }
  });

  renderTable(list);
  updateSummary(list);
}

// Render table rows
function renderTable(list){
  if(!list.length){
    reportsBody.innerHTML = `<tr><td colspan="8" class="muted">No records</td></tr>`;
    return;
  }
  reportsBody.innerHTML = list.map(r=>{
    const linkLabel = (r.link && r.link.length>40) ? r.link.slice(0,40)+'…' : (r.link||"");
    const statusClass = (r.status||"").toLowerCase() === "paid" ? "status-paid" : "status-pending";
    return `
      <tr data-id="${r.id}">
        <td><a href="${escapeHtml(r.link||'')}" target="_blank" rel="noopener">${escapeHtml(linkLabel)}</a></td>
        <td>${escapeHtml(r.agency||'')}</td>
        <td>${escapeHtml(r.movie||'')}</td>
        <td>₹${Number(r.amount)||0}</td>
        <td><button class="statusToggle ${statusClass}">${escapeHtml(r.status||'')}</button></td>
        <td>${escapeHtml(r.date||'')}</td>
        <td>${escapeHtml(r.notes||'')}</td>
        <td class="actions">
          <button class="editBtn">Edit</button>
          <button class="dupBtn">Duplicate</button>
          <button class="delBtn">Delete</button>
        </td>
      </tr>`;
  }).join('');

  // attach delegated listeners using event delegation
  [...reportsBody.querySelectorAll("button")].forEach(btn=>{
    // noop — individual listeners below via delegation
  });
}

// event delegation for table actions
reportsBody.addEventListener("click", async (ev)=>{
  const tr = ev.target.closest("tr");
  if(!tr) return;
  const id = tr.dataset.id;
  const docRef = doc(db, "users", uid, "reports", id);

  if(ev.target.classList.contains("delBtn")){
    if(!confirm("Delete this report?")) return;
    try{ await deleteDoc(docRef); showToast("Deleted"); }catch(e){ showToast("Delete failed"); console.error(e);}
    return;
  }

  if(ev.target.classList.contains("dupBtn")){
    const original = cachedReports.find(r=>r.id===id);
    if(!original) return;
    const dup = {
      link: original.link,
      agency: original.agency,
      movie: original.movie,
      amount: original.amount,
      status: original.status,
      date: new Date().toISOString().split("T")[0],
      notes: original.notes
    };
    try{ await addDoc(collection(db, "users", uid, "reports"), dup); showToast("Duplicated"); }catch(e){showToast("Duplicate failed");console.error(e)}
    return;
  }

  if(ev.target.classList.contains("editBtn")){
    const r = cachedReports.find(r=>r.id===id);
    if(!r) return;
    // simple inline edit via prompt for quickness (we can replace with modal later)
    const newAgency = prompt("Agency", r.agency) || r.agency;
    const newMovie = prompt("Movie", r.movie) || r.movie;
    const newAmount = prompt("Amount", r.amount) || r.amount;
    const newStatus = prompt("Status (Pending/Paid)", r.status) || r.status;
    const newDate = prompt("Date (YYYY-MM-DD)", r.date) || r.date;
    const newNotes = prompt("Notes", r.notes||"") || r.notes;
    try{
      await updateDoc(docRef, { agency:newAgency, movie:newMovie, amount:Number(newAmount)||0, status:newStatus, date:newDate, notes:newNotes });
      showToast("Updated");
    }catch(e){ showToast("Update failed"); console.error(e);}
    return;
  }

  if(ev.target.classList.contains("statusToggle")){
    const r = cachedReports.find(r=>r.id===id);
    const newStatus = (r.status||"").toLowerCase() === "paid" ? "Pending" : "Paid";
    try{ await updateDoc(docRef, { status: newStatus }); showToast("Status updated"); }catch(e){showToast("Status update failed"); console.error(e)}
    return;
  }
});

// Apply/reset filters
applyFilters.addEventListener("click", ()=> applyFiltersAndRender());
resetFilters.addEventListener("click", ()=>{
  searchText.value = ""; filterStatus.value = "All"; fromDate.value=""; toDate.value=""; sortBy.value="date_desc";
  applyFiltersAndRender();
});

// export CSV (filtered)
exportCSVBtn.addEventListener("click", ()=>{
  // reuse the currently rendered list by applying filters
  const search = (searchText.value||"").toLowerCase().trim();
  const fStatus = filterStatus.value;
  const fFrom = fromDate.value;
  const fTo = toDate.value;
  const sort = sortBy.value;

  let list = cachedReports.slice();

  if(search) list = list.filter(r=>{
    return (r.link||"").toLowerCase().includes(search) || (r.agency||"").toLowerCase().includes(search) || (r.movie||"").toLowerCase().includes(search);
  });
  if(fStatus && fStatus !== "All") list = list.filter(r=> (r.status||"")===fStatus);
  if(fFrom) list = list.filter(r=> (r.date||"") >= fFrom);
  if(fTo) list = list.filter(r=> (r.date||"") <= fTo);

  // sort same as render
  list.sort((a,b)=>{
    switch(sort){
      case "date_asc": return (a.date||"").localeCompare(b.date||"");
      case "date_desc": return (b.date||"").localeCompare(a.date||"");
      case "amount_asc": return (Number(a.amount)||0) - (Number(b.amount)||0);
      case "amount_desc": return (Number(b.amount)||0) - (Number(a.amount)||0);
      case "agency_asc": return (a.agency||"").localeCompare(b.agency||"");
      case "agency_desc": return (b.agency||"").localeCompare(a.agency||"");
      default: return 0;
    }
  });

  if(!list.length){ showToast("No rows to export"); return; }

  const rows = [["Link","Agency","Movie","Amount","Status","Date","Notes"], ...list.map(r=>[r.link||"", r.agency||"", r.movie||"", r.amount||"", r.status||"", r.date||"", (r.notes||"")])];
  const csv = rows.map(r=> r.map(c=> `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vadisi_reports_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast("Exported CSV");
});

// summary update
function updateSummary(list){
  totalReportsEl.textContent = list.length;
  const pending = list.filter(r=> (r.status||"").toLowerCase()!=="paid").reduce((s,r)=> s + (Number(r.amount)||0), 0);
  const paid = list.filter(r=> (r.status||"").toLowerCase()==="paid").reduce((s,r)=> s + (Number(r.amount)||0), 0);
  pendingAmountEl.textContent = `₹${pending}`;
  paidAmountEl.textContent = `₹${paid}`;
  const ag = {};
  list.forEach(r=> ag[r.agency] = (ag[r.agency]||0)+1 );
  const top = Object.keys(ag).sort((a,b)=> (ag[b]-ag[a]))[0] || "—";
  topAgencyEl.textContent = top;
}

// simple escape
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

// initialize default date in add form
window.addEventListener("DOMContentLoaded", ()=> {
  if(dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split("T")[0];
});
