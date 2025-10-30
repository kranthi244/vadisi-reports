import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot,
  updateDoc, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const reportsRef = collection(db, "reports");

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const userDetails = document.getElementById("userDetails");

const addReportForm = document.getElementById("addReportForm");
const reportsTableBody = document.getElementById("reportsTableBody");
const exportPDFBtn = document.getElementById("exportPDFBtn");

const totalPending = document.getElementById("totalPending");
const summaryContainer = document.getElementById("summaryContainer");

let currentUser = null;

// ---------- AUTH ----------
signInBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Sign-in failed: " + error.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";
    userDetails.textContent = `Signed in as ${user.displayName}`;
    subscribeToReports();
  } else {
    currentUser = null;
    signInBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";
    userDetails.textContent = "";
    reportsTableBody.innerHTML = "";
  }
});

// ---------- ADD REPORT ----------
addReportForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = parseFloat(document.getElementById("amount").value || 1200);
  const datePosted = document.getElementById("date").value;
  const status = document.getElementById("status").value;
  const notes = document.getElementById("notes").value.trim();

  const formattedDate = formatDate(datePosted);

  if (!link || !agency || !movie || !status || !formattedDate) {
    alert("Please fill in all required fields");
    return;
  }

  try {
    await addDoc(reportsRef, {
      userId: currentUser.uid,
      link,
      agency,
      movie,
      amount,
      date: formattedDate,
      status,
      notes,
      createdAt: new Date(),
    });

    addReportForm.reset();
  } catch (err) {
    alert("Failed to add report: " + err.message);
  }
});

// ---------- SUBSCRIBE TO REPORTS ----------
function subscribeToReports() {
  const q = query(reportsRef, orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    reportsTableBody.innerHTML = "";
    let totalPendingAmount = 0;
    const reports = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      reports.push({ id: docSnap.id, ...data });
      if (data.status.toLowerCase() === "pending") {
        totalPendingAmount += data.amount;
      }
    });

    totalPending.textContent = totalPendingAmount.toFixed(2);
    renderReports(reports);
    updateSummary(reports);
  });
}

// ---------- RENDER REPORTS ----------
function renderReports(reports) {
  reportsTableBody.innerHTML = "";

  reports.forEach((report) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td contenteditable="true" data-field="link">${report.link}</td>
      <td contenteditable="true" data-field="agency">${report.agency}</td>
      <td contenteditable="true" data-field="movie">${report.movie}</td>
      <td contenteditable="true" data-field="amount">${report.amount}</td>
      <td>${report.date}</td>
      <td contenteditable="true" data-field="status">${report.status}</td>
      <td contenteditable="true" data-field="notes">${report.notes || ""}</td>
      <td>
        <button class="delete-btn" data-id="${report.id}">🗑️</button>
      </td>
    `;

    // Inline editing (auto-save on blur)
    tr.querySelectorAll("[contenteditable]").forEach((cell) => {
      cell.addEventListener("blur", async () => {
        const newValue = cell.textContent.trim();
        const field = cell.dataset.field;
        if (report[field] !== newValue) {
          try {
            await updateDoc(doc(db, "reports", report.id), { [field]: newValue });
          } catch (err) {
            console.error("Error updating field:", err);
          }
        }
      });
    });

    // Delete record
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Delete this report?")) {
        await deleteDoc(doc(db, "reports", report.id));
      }
    });

    reportsTableBody.appendChild(tr);
  });
}

// ---------- SUMMARY SECTION ----------
function updateSummary(reports) {
  const pendingByAgency = {};
  const pendingByMovie = {};
  const monthlyPending = {};

  reports.forEach((r) => {
    if (r.status.toLowerCase() === "pending") {
      pendingByAgency[r.agency] = (pendingByAgency[r.agency] || 0) + r.amount;
      pendingByMovie[r.movie] = (pendingByMovie[r.movie] || 0) + r.amount;

      const month = r.date.split("-")[1];
      monthlyPending[month] = (monthlyPending[month] || 0) + r.amount;
    }
  });

  summaryContainer.innerHTML = `
    <div class="summary-card">Total Pending: ₹${Object.values(pendingByAgency).reduce((a, b) => a + b, 0).toFixed(2)}</div>
    <div class="summary-card">Pending (last 3 months): ${Object.entries(monthlyPending)
      .slice(-3)
      .map(([m, v]) => `${m}: ₹${v}`)
      .join(", ")}</div>
    <div class="summary-card">Top 5 Agencies: ${Object.entries(pendingByAgency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([a, v]) => `${a}: ₹${v}`)
      .join(", ")}</div>
    <div class="summary-card">Top 5 Movies: ${Object.entries(pendingByMovie)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m, v]) => `${m}: ₹${v}`)
      .join(", ")}</div>
  `;
}

// ---------- EXPORT TO PDF ----------
exportPDFBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF();
  docPDF.text("Telugu Swaggers - Reports Summary", 10, 10);
  let y = 20;
  const rows = reportsTableBody.querySelectorAll("tr");
  rows.forEach((tr) => {
    const cols = tr.querySelectorAll("td");
    const text = Array.from(cols)
      .slice(0, 7)
      .map((td) => td.textContent)
      .join(" | ");
    docPDF.text(text, 10, y);
    y += 10;
  });
  docPDF.save("Telugu_Swaggers_Reports.pdf");
});

// ---------- UTIL ----------
function formatDate(inputDate) {
  if (!inputDate) return "";
  const [year, month, day] = inputDate.split("-");
  const date = new Date(year, month - 1, day);
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}
