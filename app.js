// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------------- FIREBASE CONFIGURATION ----------------
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
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ---------------- HTML ELEMENTS ----------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");
const filterAgency = document.getElementById("filterAgency");
const filterMovie = document.getElementById("filterMovie");
const filterStatus = document.getElementById("filterStatus");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const applyFilters = document.getElementById("applyFilters");
const clearFilters = document.getElementById("clearFilters");
const exportCSV = document.getElementById("exportCSV");

let currentUser = null;

// ---------------- AUTHENTICATION ----------------
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("Sign in failed: " + error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    document.getElementById("addReport").style.display = "block";
    document.getElementById("filters").style.display = "block";
    document.getElementById("reportTable").style.display = "block";
    loadReports();
  } else {
    currentUser = null;
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    reportBody.innerHTML = "";
    document.getElementById("addReport").style.display = "none";
    document.getElementById("filters").style.display = "none";
    document.getElementById("reportTable").style.display = "none";
  }
});

// ---------------- ADD REPORT ----------------
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const reportData = {
    link: document.getElementById("link").value,
    agency: document.getElementById("agency").value,
    movie: document.getElementById("movie").value,
    amount: parseFloat(document.getElementById("amount").value),
    status: document.getElementById("status").value,
    date: document.getElementById("date").value || new Date().toISOString().split("T")[0],
  };

  try {
    const userRef = collection(db, "users", currentUser.uid, "reports");
    await addDoc(userRef, reportData);
    alert("Report added successfully!");
    reportForm.reset();
    loadReports();
  } catch (error) {
    alert("Failed to add report: " + error.message);
    console.error(error);
  }
});

// ---------------- LOAD REPORTS ----------------
async function loadReports() {
  if (!currentUser) return;

  const userRef = collection(db, "users", currentUser.uid, "reports");
  const snapshot = await getDocs(userRef);
  reportBody.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="${data.link}" target="_blank">Open</a></td>
      <td>${data.agency}</td>
      <td>${data.movie}</td>
      <td>${data.amount}</td>
      <td>${data.status}</td>
      <td>${data.date}</td>
      <td>
        <button class="editBtn" data-id="${docSnap.id}">Edit</button>
        <button class="deleteBtn" data-id="${docSnap.id}">Delete</button>
      </td>
    `;
    reportBody.appendChild(row);
  });

  attachRowActions();
}

// ---------------- EDIT / DELETE ----------------
function attachRowActions() {
  document.querySelectorAll(".deleteBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("Delete this record?")) {
        await deleteDoc(doc(db, "users", currentUser.uid, "reports", id));
        loadReports();
      }
    });
  });

  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const newAgency = prompt("Enter new Agency name:");
      const newMovie = prompt("Enter new Movie name:");
      const newAmount = prompt("Enter new Amount:");
      const newStatus = prompt("Enter new Status (Pending/Cleared):");

      if (newAgency && newMovie && newAmount && newStatus) {
        const docRef = doc(db, "users", currentUser.uid, "reports", id);
        await updateDoc(docRef, {
          agency: newAgency,
          movie: newMovie,
          amount: parseFloat(newAmount),
          status: newStatus,
        });
        loadReports();
      }
    });
  });
}

// ---------------- FILTERS ----------------
applyFilters.addEventListener("click", async () => {
  if (!currentUser) return;
  const userRef = collection(db, "users", currentUser.uid, "reports");
  const snapshot = await getDocs(userRef);

  const agencyFilter = filterAgency.value.toLowerCase();
  const movieFilter = filterMovie.value.toLowerCase();
  const statusFilter = filterStatus.value;
  const from = fromDate.value;
  const to = toDate.value;

  reportBody.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const date = data.date;
    const withinDate =
      (!from || date >= from) && (!to || date <= to);
    if (
      data.agency.toLowerCase().includes(agencyFilter) &&
      data.movie.toLowerCase().includes(movieFilter) &&
      (statusFilter === "All" || data.status === statusFilter) &&
      withinDate
    ) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><a href="${data.link}" target="_blank">Open</a></td>
        <td>${data.agency}</td>
        <td>${data.movie}</td>
        <td>${data.amount}</td>
        <td>${data.status}</td>
        <td>${data.date}</td>
      `;
      reportBody.appendChild(row);
    }
  });
});

clearFilters.addEventListener("click", () => {
  filterAgency.value = "";
  filterMovie.value = "";
  filterStatus.value = "All";
  fromDate.value = "";
  toDate.value = "";
  loadReports();
});

// ---------------- EXPORT CSV ----------------
exportCSV.addEventListener("click", () => {
  const rows = Array.from(document.querySelectorAll("#reportBody tr"));
  if (!rows.length) {
    alert("No data to export.");
    return;
  }

  const csvData = [
    ["Link", "Agency", "Movie", "Amount", "Status", "Date"],
    ...rows.map((row) =>
      Array.from(row.children).map((cell) => cell.innerText)
    ),
  ]
    .map((r) => r.join(","))
    .join("\n");

  const blob = new Blob([csvData], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vadisi_reports.csv";
  a.click();
  URL.revokeObjectURL(url);
});
