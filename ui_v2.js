// Firebase initialization
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let reports = [];
let filteredReports = [];

// Elements
const reportForm = document.getElementById("reportForm");
const reportsList = document.getElementById("reportsList");
const exportBtn = document.getElementById("exportPDF");
const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");

// --- Authentication ---
signInBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithPopup(provider);
});

signOutBtn.addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    signInBtn.style.display = "none";
    signOutBtn.style.display = "block";
    loadReports();
  } else {
    signInBtn.style.display = "block";
    signOutBtn.style.display = "none";
    reportsList.innerHTML = "";
  }
});

// --- Load Reports ---
async function loadReports() {
  const snapshot = await db.collection("reports").orderBy("datePosted", "desc").get();
  reports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  applyDateFilter();
}

// --- Add Report ---
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const report = {
    agency: document.getElementById("agency").value.trim(),
    movie: document.getElementById("movie").value.trim(),
    instagramLink: document.getElementById("instagramLink").value.trim(),
    amount: parseFloat(document.getElementById("amount").value.trim()) || 0,
    status: document.getElementById("status").value.trim(),
    datePosted: document.getElementById("datePosted").value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("reports").add(report);
  reportForm.reset();
  loadReports();
});

// --- Filter by Date Range ---
dateFromInput.addEventListener("change", applyDateFilter);
dateToInput.addEventListener("change", applyDateFilter);

function applyDateFilter() {
  const from = dateFromInput.value ? new Date(dateFromInput.value) : null;
  const to = dateToInput.value ? new Date(dateToInput.value) : null;

  filteredReports = reports.filter((r) => {
    const reportDate = new Date(r.datePosted);
    if (from && reportDate < from) return false;
    if (to && reportDate > to) return false;
    return true;
  });

  renderReports(filteredReports);
}

// --- Render Reports ---
function renderReports(list) {
  reportsList.innerHTML = "";

  if (list.length === 0) {
    reportsList.innerHTML = "<p class='no-data'>No reports found for this range.</p>";
    return;
  }

  list.forEach((r) => {
    const div = document.createElement("div");
    div.className = "report-item";
    div.innerHTML = `
      <div class="report-details">
        <p><strong>Agency:</strong> ${r.agency}</p>
        <p><strong>Movie:</strong> ${r.movie}</p>
        <p><strong>Instagram:</strong> <a href="${r.instagramLink}" target="_blank">${r.instagramLink}</a></p>
        <p><strong>Amount:</strong> ₹${r.amount}</p>
        <p><strong>Status:</strong> ${r.status}</p>
        <p><strong>Date Posted:</strong> ${r.datePosted}</p>
      </div>
      <div class="report-actions">
        <button class="edit-btn" onclick="editReport('${r.id}')">Edit</button>
        <button class="delete-btn" onclick="deleteReport('${r.id}')">Delete</button>
      </div>
    `;
    reportsList.appendChild(div);
  });
}

// --- Edit Report ---
async function editReport(id) {
  const newAmount = prompt("Enter new amount:");
  const newStatus = prompt("Enter new status:");
  if (newAmount || newStatus) {
    await db.collection("reports").doc(id).update({
      ...(newAmount && { amount: parseFloat(newAmount) }),
      ...(newStatus && { status: newStatus }),
    });
    loadReports();
  }
}

// --- Delete Report ---
async function deleteReport(id) {
  if (confirm("Are you sure you want to delete this report?")) {
    await db.collection("reports").doc(id).delete();
    loadReports();
  }
}

// --- Export PDF ---
exportBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Telugu Swaggers - Promotion Dashboard", 10, 10);
  doc.setFontSize(12);
  doc.text(`Reports (${dateFromInput.value || "All"} → ${dateToInput.value || "All"})`, 10, 20);

  let y = 30;
  filteredReports.forEach((r, i) => {
    doc.text(
      `${i + 1}. ${r.movie} | ${r.agency} | ₹${r.amount} | ${r.status} | ${r.datePosted}`,
      10,
      y
    );
    y += 8;
  });

  doc.save(`Reports_${new Date().toISOString().slice(0, 10)}.pdf`);
}
);
