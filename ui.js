import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.appspot.com",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// DOM elements
const addReportForm = document.getElementById("addReportForm");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const reportsContainer = document.getElementById("reportsContainer");
const summaryTotal = document.getElementById("summaryTotal");
const exportPDFBtn = document.getElementById("exportPDFBtn");

// Auth handling
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
    loadReports(user.uid);
  } else {
    document.getElementById("authSection").style.display = "block";
    document.getElementById("appSection").style.display = "none";
  }
});

signInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    alert("Sign-in failed");
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Add Report
addReportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Sign in first");

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const date = document.getElementById("date").value || new Date().toISOString().split("T")[0];
  const amount = document.getElementById("amount").value || 1200;
  const status = document.getElementById("status").value.trim();
  const notes = document.getElementById("notes").value.trim();

  try {
    await addDoc(collection(db, "vadisi-reports"), {
      uid: user.uid,
      link,
      agency,
      movie,
      date,
      amount: Number(amount),
      status,
      notes,
      createdAt: new Date()
    });
    addReportForm.reset();
    loadReports(user.uid);
  } catch (err) {
    console.error("Add failed:", err);
    alert("Add failed: Missing or insufficient permissions.");
  }
});

// Load Reports
async function loadReports(uid) {
  const q = query(collection(db, "vadisi-reports"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  let totalPending = 0;
  const data = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (d.status.toLowerCase() === "pending") totalPending += d.amount;
    data.push({ id: docSnap.id, ...d });
  });

  renderTable(data);
  renderSummary(data, totalPending);
}

// Render Table
function renderTable(data) {
  if (data.length === 0) {
    reportsContainer.innerHTML = `<p>No reports yet.</p>`;
    return;
  }

  let html = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Insta/X Link</th>
          <th>Agency</th>
          <th>Movie</th>
          <th>Date</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;
  data.forEach((r) => {
    html += `
      <tr>
        <td>${r.link}</td>
        <td>${r.agency}</td>
        <td>${r.movie}</td>
        <td>${formatDate(r.date)}</td>
        <td>${r.amount}</td>
        <td>${r.status}</td>
        <td>${r.notes || ""}</td>
        <td><button class="edit-btn" data-id="${r.id}">✏️</button></td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  reportsContainer.innerHTML = html;
}

// Render Summary
function renderSummary(data, totalPending) {
  summaryTotal.textContent = `₹ ${totalPending}`;

  // 3-month pending breakdown
  const now = new Date();
  const last3 = {};
  data.forEach((r) => {
    const d = new Date(r.date);
    const key = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
    if ((now - d) / (1000 * 60 * 60 * 24) <= 90 && r.status.toLowerCase() === "pending") {
      last3[key] = (last3[key] || 0) + r.amount;
    }
  });

  console.log("Last 3 months pending:", last3);
}

// Export to PDF
if (exportPDFBtn) {
  exportPDFBtn.addEventListener("click", () => {
    const doc = new jsPDF();
    doc.text("Telugu Swaggers - Reports", 10, 10);
    doc.html(reportsContainer, {
      callback: (pdf) => pdf.save("TeluguSwaggers_Reports.pdf"),
      x: 10,
      y: 20
    });
  });
}

// Helper
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
