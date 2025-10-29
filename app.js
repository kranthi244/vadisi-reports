// app.js
// Full application logic. Save as app.js and ensure index.html uses:
// <script type="module" src="app.js"></script>

// -------------------- FIREBASE IMPORTS --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// -------------------- FIREBASE CONFIG - REPLACE THESE --------------------
// Replace the placeholder values below with your firebaseConfig JSON object.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// -------------------------------------------------------------------------

// Init firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// -------------------- DOM ELEMENTS --------------------
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const userEmailEl = document.getElementById("userEmail");

const reportForm = document.getElementById("reportForm");
const linkInput = document.getElementById("link");
const agencyInput = document.getElementById("agency");
const movieInput = document.getElementById("movie");
const amountInput = document.getElementById("amount");
const statusInput = document.getElementById("status");
const dateInput = document.getElementById("date");
const notesInput = document.getElementById("notes");

const agencyList = document.getElementById("agencyList");
const movieList = document.getElementById("movieList");

const applyFilterBtn = document.getElementById("applyFilter");
const clearFilterBtn = document.getElementById("clearFilter");
const exportCSVBtn = document.getElementById("exportCSV");

const filterAgency = document.getElementById("filterAgency");
const filterMovie = document.getElementById("filterMovie");
const filterStatus = document.getElementById("filterStatus");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");

const reportsTableBody = document.querySelector("#reportsTable tbody");

// Modal elements
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editLink = document.getElementById("editLink");
const editAgency = document.getElementById("editAgency");
const editMovie = document.getElementById("editMovie");
const editAmount = document.getElementById("editAmount");
const editStatus = document.getElementById("editStatus");
const editDate = document.getElementById("editDate");
const editNotes = document.getElementById("editNotes");
const cancelEditBtn = document.getElementById("cancelEdit");

const totalReportsEl = document.getElementById("totalReports");
const totalPendingEl = document.getElementById("totalPending");
const totalPaidEl = document.getElementById("totalPaid");
const topAgencyEl = document.getElementById("topAgency");

// Quick add / templates UI (we'll use localStorage for templates)
const floatingAddBtn = document.createElement("button");
floatingAddBtn.textContent = "+";
floatingAddBtn.title = "Quick Add";
floatingAddBtn.id = "floatingAddBtn";
floatingAddBtn.style.position = "fixed";
floatingAddBtn.style.right = "18px";
floatingAddBtn.style.bottom = "18px";
floatingAddBtn.style.width = "56px";
floatingAddBtn.style.height = "56px";
floatingAddBtn.style.borderRadius = "50%";
floatingAddBtn.style.fontSize = "24px";
floatingAddBtn.style.background = "#111";
floatingAddBtn.style.color = "#fff";
floatingAddBtn.style.border = "none";
document.body.appendChild(floatingAddBtn);

// CSV file input for bulk upload
const csvInput = document.createElement("input");
csvInput.type = "file";
csvInput.accept = ".csv";
csvInput.style.display = "none";
document.body.appendChild(csvInput);

// -------------------- STATE --------------------
let currentUser = null;
let unsubscribeReports = null; // for real-time listener
let currentlyDisplayedDocs = []; // snapshot docs for export & inline actions

// -------------------- AUTH --------------------
signInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Sign in failed: " + err.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userEmailEl.textContent = user.email;
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";
    startRealtimeReports();
  } else {
    currentUser = null;
    userEmailEl.textContent = "";
    signInBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";
    stopRealtimeReports();
    showPleaseSignInMessage();
  }
});

// -------------------- HELPERS --------------------
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function showPleaseSignInMessage() {
  reportsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center">Please sign in to view your reports</td></tr>`;
  totalReportsEl.textContent = "0";
  totalPendingEl.textContent = "0";
  totalPaidEl.textContent = "0";
  topAgencyEl.textContent = "N/A";
}

// Format currency/easier numbers
function toNumberOrZero(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// -------------------- ADD / EDIT --------------------
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Please sign in first.");

  const data = {
    uid: currentUser.uid,
    link: linkInput.value.trim(),
    agency: agencyInput.value.trim() || "Unknown",
    movie: movieInput.value.trim() || "Unknown",
    amount: toNumberOrZero(amountInput.value),
    status: statusInput.value || "Pending",
    date: dateInput.value || todayStr(),
    notes: notesInput.value.trim() || "",
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "reports"), data);
    // update local suggestions and templates list
    addSuggestion("agencies", data.agency);
    addSuggestion("movies", data.movie);
    reportForm.reset();
    dateInput.value = todayStr();
  } catch (err) {
    alert("Failed to add report: " + err.message);
  }
});

// Edit flow
let editingDocId = null;
function openEditModal(docId, docData) {
  editingDocId = docId;
  editLink.value = docData.link || "";
  editAgency.value = docData.agency || "";
  editMovie.value = docData.movie || "";
  editAmount.value = docData.amount || "";
  editStatus.value = docData.status || "Pending";
  editDate.value = docData.date || todayStr();
  editNotes.value = docData.notes || "";
  editModal.style.display = "block";
}
cancelEditBtn.addEventListener("click", () => {
  editModal.style.display = "none";
  editingDocId = null;
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingDocId) return;

  const docRef = doc(db, "reports", editingDocId);
  try {
    await updateDoc(docRef, {
      link: editLink.value.trim(),
      agency: editAgency.value.trim(),
      movie: editMovie.value.trim(),
      amount: toNumberOrZero(editAmount.value),
      status: editStatus.value,
      date: editDate.value || todayStr(),
      notes: editNotes.value.trim()
    });
    editModal.style.display = "none";
    editingDocId = null;
  } catch (err) {
    alert("Update failed: " + err.message);
  }
});

// -------------------- REAL-TIME LISTENER --------------------
function startRealtimeReports() {
  if (!currentUser) return;
  // stop old listener if present
  if (unsubscribeReports) unsubscribeReports();

  const q = query(collection(db, "reports"), where("uid", "==", currentUser.uid), orderBy("date", "desc"));
  unsubscribeReports = onSnapshot(q, (snapshot) => {
    currentlyDisplayedDocs = [];
    const rows = [];
    snapshot.forEach(docSnap => {
      const obj = { id: docSnap.id, ...docSnap.data() };
      currentlyDisplayedDocs.push(obj);
      rows.push(obj);
    });

    renderReports(rows);
    updateSummary(rows);
    populateSuggestions(rows);
  }, (err) => {
    console.error("Snapshot error:", err);
  });
}

function stopRealtimeReports() {
  if (unsubscribeReports) {
    unsubscribeReports();
    unsubscribeReports = null;
  }
  currentlyDisplayedDocs = [];
}

// -------------------- RENDERING, FILTERS & ACTIONS --------------------
function renderReports(reports) {
  // Apply UI filters (client side)
  const filtered = applyUIFiltersToList(reports);
  if (filtered.length === 0) {
    reportsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center">No records</td></tr>`;
    return;
  }

  const html = filtered.map(r => {
    const statusClass = (r.status || "Pending").toLowerCase() === "paid" ? "status-paid" : "status-pending";
    // escape link display if very long, show short text
    const linkLabel = r.link.length > 60 ? r.link.slice(0, 56) + "..." : r.link;
    return `
      <tr data-id="${r.id}">
        <td><a href="${r.link || '#'}" target="_blank" rel="noopener noreferrer">${linkLabel}</a></td>
        <td>${escapeHtml(r.agency)}</td>
        <td>${escapeHtml(r.movie)}</td>
        <td>${r.amount}</td>
        <td><button class="toggleStatusBtn ${statusClass}">${escapeHtml(r.status)}</button></td>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.notes || "")}</td>
        <td>
          <button class="editBtn">Edit</button>
          <button class="dupBtn">Duplicate</button>
          <button class="delBtn">Delete</button>
          <button class="inlinePaidBtn">Mark Paid</button>
        </td>
      </tr>
    `;
  }).join("");
  reportsTableBody.innerHTML = html;

  // wiring up action buttons (delegation preferred but simpler to attach listeners)
  // use event delegation to keep it efficient
}

// event delegation for table actions
reportsTableBody.addEventListener("click", async (ev) => {
  const tr = ev.target.closest("tr");
  if (!tr) return;
  const docId = tr.dataset.id;
  const docData = currentlyDisplayedDocs.find(d => d.id === docId);

  if (ev.target.classList.contains("editBtn")) {
    openEditModal(docId, docData);
  } else if (ev.target.classList.contains("delBtn")) {
    if (!confirm("Delete this report?")) return;
    await deleteDoc(doc(db, "reports", docId));
  } else if (ev.target.classList.contains("dupBtn")) {
    // duplicate: create a new doc with same fields but new createdAt and today's date
    const dup = {
      ...docData,
      uid: currentUser.uid,
      createdAt: new Date().toISOString(),
      date: todayStr()
    };
    delete dup.id; // remove id for new doc
    await addDoc(collection(db, "reports"), dup);
  } else if (ev.target.classList.contains("toggleStatusBtn")) {
    // toggle status
    const newStatus = (docData.status || "Pending").toLowerCase() === "paid" ? "Pending" : "Paid";
    await updateDoc(doc(db, "reports", docId), { status: newStatus });
  } else if (ev.target.classList.contains("inlinePaidBtn")) {
    await updateDoc(doc(db, "reports", docId), { status: "Paid" });
  }
});

// -------------------- FILTERS --------------------
function applyUIFiltersToList(list) {
  let out = [...list];
  const aVal = (filterAgency.value || "").toLowerCase().trim();
  const mVal = (filterMovie.value || "").toLowerCase().trim();
  const sVal = (filterStatus.value || "All");
  const fVal = (fromDate.value || "");
  const tVal = (toDate.value || "");

  if (aVal) out = out.filter(r => (r.agency || "").toLowerCase().includes(aVal));
  if (mVal) out = out.filter(r => (r.movie || "").toLowerCase().includes(mVal));
  if (sVal && sVal !== "All") out = out.filter(r => (r.status || "") === sVal);
  if (fVal) out = out.filter(r => (r.date || "") >= fVal);
  if (tVal) out = out.filter(r => (r.date || "") <= tVal);
  return out;
}

applyFilterBtn.addEventListener("click", () => {
  // just re-render from currentlyDisplayedDocs using filters
  renderReports(currentlyDisplayedDocs);
});

clearFilterBtn.addEventListener("click", () => {
  filterAgency.value = "";
  filterMovie.value = "";
  filterStatus.value = "All";
  fromDate.value = "";
  toDate.value = "";
  renderReports(currentlyDisplayedDocs);
});

// -------------------- EXPORT CSV (filtered only) --------------------
exportCSVBtn.addEventListener("click", () => {
  if (!currentlyDisplayedDocs.length) return alert("No reports to export");
  const filtered = applyUIFiltersToList(currentlyDisplayedDocs);
  if (!filtered.length) return alert("No reports match the filters");

  const rows = [
    ["Link", "Agency", "Movie", "Amount", "Status", "Date", "Notes"],
    ...filtered.map(r => [r.link || "", r.agency || "", r.movie || "", r.amount || "", r.status || "", r.date || "", r.notes || ""])
  ];
  const csv = rows.map(r => r.map(cell => `"${(cell + "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vadisi_reports_${todayStr()}.csv`;
  a.click();
});

// -------------------- DASHBOARD SUMMARY --------------------
function updateSummary(list) {
  const filtered = applyUIFiltersToList(list);
  const total = filtered.length;
  const pendingAmount = filtered.filter(r => (r.status || "").toLowerCase() === "pending").reduce((s, r) => s + toNumberOrZero(r.amount), 0);
  const paidAmount = filtered.filter(r => (r.status || "").toLowerCase() === "paid").reduce((s, r) => s + toNumberOrZero(r.amount), 0);

  const agencyCount = {};
  filtered.forEach(r => {
    const a = r.agency || "Unknown";
    agencyCount[a] = (agencyCount[a] || 0) + 1;
  });
  const topAgency = Object.keys(agencyCount).sort((a, b) => (agencyCount[b] - agencyCount[a]))[0] || "N/A";

  totalReportsEl.textContent = total;
  totalPendingEl.textContent = pendingAmount;
  totalPaidEl.textContent = paidAmount;
  topAgencyEl.textContent = topAgency;
}

// -------------------- SUGGESTIONS & TEMPLATES --------------------
function populateSuggestions(list) {
  // populate datalists for agency and movie from unique values in list + local storage templates
  const agencies = new Set(getStoredSuggestions("agencies"));
  const movies = new Set(getStoredSuggestions("movies"));

  list.forEach(r => { if (r.agency) agencies.add(r.agency); if (r.movie) movies.add(r.movie); });

  agencyList.innerHTML = Array.from(agencies).map(a => `<option value="${escapeHtml(a)}">`).join("");
  movieList.innerHTML = Array.from(movies).map(m => `<option value="${escapeHtml(m)}">`).join("");
}

function addSuggestion(key, value) {
  if (!value) return;
  const arr = getStoredSuggestions(key);
  if (!arr.includes(value)) {
    arr.push(value);
    localStorage.setItem(key, JSON.stringify(arr));
  }
}

function getStoredSuggestions(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(v)) return v;
    return [];
  } catch {
    return [];
  }
}

// -------------------- BULK CSV UPLOAD --------------------
csvInput.addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const text = await file.text();
  // simple CSV parser: header row expected: link,agency,movie,amount,status,date,notes
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
  if (lines.length < 2) return alert("CSV must have header and at least one row.");
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const required = ["link","agency","movie","amount","status","date","notes"];
  // not strictly required to have all, we'll map available columns
  const docs = [];
  for (let i=1;i<lines.length;i++){
    const cols = parseCsvLine(lines[i]);
    const rowObj = {};
    headers.forEach((h, idx) => rowObj[h] = (cols[idx] || "").trim());
    const docData = {
      uid: currentUser.uid,
      link: rowObj.link || "",
      agency: rowObj.agency || "Unknown",
      movie: rowObj.movie || "Unknown",
      amount: toNumberOrZero(rowObj.amount),
      status: rowObj.status || "Pending",
      date: rowObj.date || todayStr(),
      notes: rowObj.notes || "",
      createdAt: new Date().toISOString()
    };
    docs.push(docData);
  }
  // bulk add sequentially
  for (const d of docs) {
    await addDoc(collection(db, "reports"), d);
    addSuggestion("agencies", d.agency);
    addSuggestion("movies", d.movie);
  }
  alert(`Imported ${docs.length} rows.`);
  csvInput.value = "";
});

function parseCsvLine(line) {
  // basic CSV handling for quotes
  const re = /("([^"]*(?:""[^"]*)*)"|[^,]+|)(,|$)/g;
  const out = [];
  line = line + ",";
  let m;
  while ((m = re.exec(line)) !== null) {
    let val = m[1];
    if (val === undefined) val = "";
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/""/g, '"');
    }
    out.push(val);
    if (m[3] === "") break;
  }
  return out;
}

// -------------------- UTILITIES --------------------
function escapeHtml(str) {
  if (!str) return "";
  return str.replaceAll("&", "&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

// keyboard shortcut: "/" focuses first input to add quickly
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && e.target.tagName.toLowerCase() !== "input" && e.target.tagName.toLowerCase() !== "textarea") {
    e.preventDefault();
    linkInput.focus();
  }
});

// floating add button toggles focus to form
floatingAddBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
  linkInput.focus();
});

// Auto-fill date fields to today if empty
window.addEventListener("DOMContentLoaded", () => {
  if (!dateInput.value) dateInput.value = todayStr();
  if (!fromDate.value) fromDate.value = "";
  if (!toDate.value) toDate.value = "";
});

// Utility: click CSV input to start bulk upload
function startCsvUpload() {
  if (!currentUser) return alert("Sign in to upload CSV");
  csvInput.click();
}

// Add a small UI control for bulk upload (attach to header or somewhere)
const csvButton = document.createElement("button");
csvButton.textContent = "Bulk CSV";
csvButton.title = "Upload CSV with columns: link,agency,movie,amount,status,date,notes";
csvButton.style.marginLeft = "8px";
csvButton.addEventListener("click", startCsvUpload);
document.getElementById("userSection").appendChild(csvButton);

// -------------------- INITIAL UI TWEAKS --------------------
// Show hint if not signed in
if (!auth.currentUser) showPleaseSignInMessage();
