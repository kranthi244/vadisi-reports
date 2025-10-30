// Firebase SDK Config
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");
const totalPending = document.getElementById("totalPending");
const totalCleared = document.getElementById("totalCleared");
const totalEntries = document.getElementById("totalEntries");

// Helper - Convert date to DD-MON-YYYY
function formatDate(dateString) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

// Sign In
loginBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error("Sign in failed:", error);
    alert("Sign-in failed. Check Firebase domain settings.");
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  loginBtn.hidden = false;
  logoutBtn.hidden = true;
  reportForm.hidden = true;
  reportBody.innerHTML = "";
});

// Auth State
auth.onAuthStateChanged(user => {
  if (user) {
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    reportForm.hidden = false;
    loadReports(user.uid);
  } else {
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    reportForm.hidden = true;
  }
});

// Add Report
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) return alert("Please sign in first.");

  const link = document.getElementById("link").value;
  const agency = document.getElementById("agency").value;
  const movie = document.getElementById("movie").value;
  const amount = parseFloat(document.getElementById("amount").value || 1200);
  const status = document.getElementById("status").value;
  const dateInput = document.getElementById("date").value;
  const notes = document.getElementById("notes").value || "";

  const date = dateInput ? formatDate(dateInput) : formatDate(new Date());

  try {
    await db.collection("reports").add({
      uid: user.uid,
      link,
      agency,
      movie,
      amount,
      status,
      date,
      notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    reportForm.reset();
    document.getElementById("amount").value = 1200;
    loadReports(user.uid);
  } catch (error) {
    console.error("Add failed:", error);
    alert("Failed to add report: " + error.message);
  }
});

// Load Reports
async function loadReports(uid) {
  try {
    const snapshot = await db.collection("reports").where("uid", "==", uid).orderBy("createdAt", "desc").get();
    renderReports(snapshot.docs);
  } catch (error) {
    console.error("Failed to load reports:", error);
  }
}

// Render Reports
function renderReports(docs) {
  reportBody.innerHTML = "";
  let pendingTotal = 0, clearedTotal = 0;

  docs.forEach(doc => {
    const data = doc.data();
    if (data.status === "Pending") pendingTotal += data.amount;
    else if (data.status === "Cleared") clearedTotal += data.amount;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="${data.link}" target="_blank">View</a></td>
      <td>${data.agency}</td>
      <td>${data.movie}</td>
      <td>${data.amount}</td>
      <td>${data.status}</td>
      <td>${data.date}</td>
      <td>${data.notes || ""}</td>
      <td>
        <button class="edit-btn" onclick="editReport('${doc.id}')">✏️</button>
        <button class="delete-btn" onclick="deleteReport('${doc.id}')">🗑️</button>
      </td>
    `;
    reportBody.appendChild(row);
  });

  totalPending.textContent = `₹${pendingTotal}`;
  totalCleared.textContent = `₹${clearedTotal}`;
  totalEntries.textContent = docs.length;
}

// Edit Report
window.editReport = async function (id) {
  const newStatus = prompt("Enter new status (Pending/Cleared):");
  if (!newStatus) return;

  try {
    await db.collection("reports").doc(id).update({ status: newStatus });
    loadReports(auth.currentUser.uid);
  } catch (error) {
    console.error("Edit failed:", error);
  }
};

// Delete Report
window.deleteReport = async function (id) {
  if (!confirm("Are you sure you want to delete this report?")) return;
  try {
    await db.collection("reports").doc(id).delete();
    loadReports(auth.currentUser.uid);
  } catch (error) {
    console.error("Delete failed:", error);
  }
};

// Export PDF
document.getElementById("exportPDF").addEventListener("click", () => {
  const doc = new jsPDF();
  doc.text("Telugu Swaggers Report", 10, 10);

  const rows = [];
  document.querySelectorAll("#reportBody tr").forEach(tr => {
    const cells = [...tr.children].map(td => td.innerText);
    rows.push(cells);
  });

  doc.autoTable({
    head: [["Link", "Agency", "Movie", "Amount", "Status", "Date", "Notes"]],
    body: rows
  });

  doc.save("Telugu_Swaggers_Report.pdf");
});
