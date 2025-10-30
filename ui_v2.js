// ui_v2.js — Final Telugu Swaggers Dashboard

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const reportsContainer = document.getElementById("reports");
const totalPendingElement = document.getElementById("totalPending");
const pendingByMonthElement = document.getElementById("pendingByMonth");
const pendingByAgencyElement = document.getElementById("pendingByAgency");
const pendingByMovieElement = document.getElementById("pendingByMovie");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");

// Add report elements
const addForm = document.getElementById("addReportForm");
const linkInput = document.getElementById("link");
const agencyInput = document.getElementById("agency");
const movieInput = document.getElementById("movie");
const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const statusInput = document.getElementById("status");
const notesInput = document.getElementById("notes");

// Export PDF elements
const fromDateInput = document.getElementById("fromDate");
const toDateInput = document.getElementById("toDate");
const exportBtn = document.getElementById("exportPDF");

let user = null;

// Authentication
signInBtn.addEventListener("click", async () => {
  await signInWithPopup(auth, provider);
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (u) => {
  user = u;
  if (u) {
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";
    loadReports();
  } else {
    signInBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";
    reportsContainer.innerHTML = "";
    updateSummary([]);
  }
});

// Add Report
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!user) return alert("Please sign in first.");

  try {
    await addDoc(collection(db, "reports"), {
      link: linkInput.value,
      agency: agencyInput.value,
      movie: movieInput.value,
      date: dateInput.value,
      amount: parseFloat(amountInput.value) || 1200,
      status: statusInput.value,
      notes: notesInput.value || "",
      uid: user.uid,
      createdAt: new Date()
    });

    addForm.reset();
  } catch (err) {
    console.error(err);
    alert("Add failed: " + err.message);
  }
});

// Load Reports (Real-time)
function loadReports() {
  const reportsRef = collection(db, "reports");
  const q = query(reportsRef, where("uid", "==", user.uid));

  onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderReports(data);
    updateSummary(data);
  });
}

// Render Reports
function renderReports(reports) {
  reportsContainer.innerHTML = "";

  reports.forEach((r) => {
    const row = document.createElement("div");
    row.className = "report-row";

    row.innerHTML = `
      <div class="report-field">${r.link}</div>
      <div class="report-field">${r.agency}</div>
      <div class="report-field">${r.movie}</div>
      <div class="report-field">${r.date}</div>
      <div class="report-field">${r.amount}</div>
      <div class="report-field">${r.status}</div>
      <div class="report-field">${r.notes}</div>
      <div class="report-actions">
        <button class="edit-btn" data-id="${r.id}">✎</button>
        <button class="delete-btn" data-id="${r.id}">🗑️</button>
      </div>
    `;

    reportsContainer.appendChild(row);
  });

  document.querySelectorAll(".edit-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => handleEdit(e.target.dataset.id))
  );

  document.querySelectorAll(".delete-btn").forEach((btn) =>
    btn.addEventListener("click", (e) => handleDelete(e.target.dataset.id))
  );
}

// Edit Inline
async function handleEdit(id) {
  const fields = Array.from(document.querySelectorAll(`[data-id="${id}"]`)).map(
    (el) => el.parentElement.parentElement
  );
  const report = fields[0];
  const children = report.querySelectorAll(".report-field");
  const values = Array.from(children).map((c) => c.textContent);

  children.forEach((c, i) => {
    if (i < 7)
      c.innerHTML = `<input value="${values[i]}" style="width:100%;padding:2px;">`;
  });

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾";
  saveBtn.className = "save-btn";
  report.querySelector(".report-actions").appendChild(saveBtn);

  saveBtn.addEventListener("click", async () => {
    const updated = {
      link: children[0].querySelector("input").value,
      agency: children[1].querySelector("input").value,
      movie: children[2].querySelector("input").value,
      date: children[3].querySelector("input").value,
      amount: parseFloat(children[4].querySelector("input").value),
      status: children[5].querySelector("input").value,
      notes: children[6].querySelector("input").value
    };
    await updateDoc(doc(db, "reports", id), updated);
  });
}

// Delete Report
async function handleDelete(id) {
  if (confirm("Delete this report?")) {
    await deleteDoc(doc(db, "reports", id));
  }
}

// Summary
function updateSummary(reports) {
  const totalPending = reports
    .filter((r) => r.status.toLowerCase() === "pending")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  totalPendingElement.textContent = totalPending.toFixed(2);

  const recentMonths = {};
  const now = new Date();

  reports.forEach((r) => {
    if (r.status.toLowerCase() === "pending") {
      const d = new Date(r.date);
      const key = `${d.toLocaleString("default", { month: "short" })}-${d.getFullYear()}`;
      if (!recentMonths[key]) recentMonths[key] = 0;
      recentMonths[key] += r.amount || 0;
    }
  });

  pendingByMonthElement.innerHTML = Object.entries(recentMonths)
    .map(([k, v]) => `<div>${k}: ₹${v}</div>`)
    .join("");

  const byAgency = {};
  reports.forEach((r) => {
    if (r.status.toLowerCase() === "pending") {
      if (!byAgency[r.agency]) byAgency[r.agency] = 0;
      byAgency[r.agency] += r.amount || 0;
    }
  });

  pendingByAgencyElement.innerHTML = Object.entries(byAgency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([a, v]) => `<div>${a}: ₹${v}</div>`)
    .join("");

  const byMovie = {};
  reports.forEach((r) => {
    if (r.status.toLowerCase() === "pending") {
      if (!byMovie[r.movie]) byMovie[r.movie] = 0;
      byMovie[r.movie] += r.amount || 0;
    }
  });

  pendingByMovieElement.innerHTML = Object.entries(byMovie)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m, v]) => `<div>${m}: ₹${v}</div>`)
    .join("");
}

// Export PDF with Date Range
exportBtn.addEventListener("click", async () => {
  if (!user) return alert("Please sign in first.");

  const start = fromDateInput.value ? new Date(fromDateInput.value) : null;
  const end = toDateInput.value ? new Date(toDateInput.value) : null;

  const snapshot = await getDocs(
    query(collection(db, "reports"), where("uid", "==", user.uid))
  );
  const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  const filtered = data.filter((r) => {
    const d = new Date(r.date);
    return (!start || d >= start) && (!end || d <= end);
  });

  const docPDF = new jsPDF();
  docPDF.setFontSize(14);
  docPDF.text("Telugu Swaggers - Promotion Dashboard", 14, 15);

  let y = 30;
  filtered.forEach((r, i) => {
    docPDF.text(
      `${i + 1}. ${r.movie} | ${r.agency} | ${r.amount} | ${r.status} | ${r.date}`,
      10,
      y
    );
    y += 8;
  });

  docPDF.save("TeluguSwaggers_Reports.pdf");
});
