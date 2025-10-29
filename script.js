// ---------------- FIREBASE SETUP ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Your firebaseConfig (replace with yours)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ---------------- DOM ELEMENTS ----------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");
const applyFilters = document.getElementById("applyFilters");
const clearFilters = document.getElementById("clearFilters");
const exportCSV = document.getElementById("exportCSV");

let currentUser = null;
let editingId = null;

// ---------------- AUTH HANDLERS ----------------
loginBtn.addEventListener("click", async () => {
  await signInWithPopup(auth, provider);
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    loadReports();
  } else {
    currentUser = null;
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    reportBody.innerHTML = "<tr><td colspan='6'>Please sign in to view your reports</td></tr>";
  }
});

// ---------------- REPORT HANDLERS ----------------
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Sign in first!");

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const status = document.getElementById("status").value;
  const date = document.getElementById("date").value || new Date().toISOString().split("T")[0];

  if (editingId) {
    const docRef = doc(db, "reports", editingId);
    await updateDoc(docRef, { link, agency, movie, amount, status, date });
    editingId = null;
  } else {
    await addDoc(collection(db, "reports"), {
      uid: currentUser.uid,
      link,
      agency,
      movie,
      amount,
      status,
      date
    });
  }

  reportForm.reset();
  loadReports();
});

// ---------------- LOAD REPORTS ----------------
async function loadReports() {
  if (!currentUser) return;

  const q = query(collection(db, "reports"), where("uid", "==", currentUser.uid));
  const snapshot = await getDocs(q);

  reportBody.innerHTML = "";
  if (snapshot.empty) {
    reportBody.innerHTML = "<tr><td colspan='6'>No reports found</td></tr>";
    return;
  }

  snapshot.forEach((docSnap) => {
    const r = docSnap.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="${r.link}" target="_blank">${r.link}</a></td>
      <td>${r.agency}</td>
      <td>${r.movie}</td>
      <td>${r.amount}</td>
      <td>${r.status}</td>
      <td>${r.date}</td>
      <td><button data-id="${docSnap.id}" class="editBtn">Edit</button></td>
    `;
    reportBody.appendChild(row);
  });

  // Add edit event listeners
  document.querySelectorAll(".editBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const docId = btn.getAttribute("data-id");
      editingId = docId;
      const row = btn.closest("tr");
      document.getElementById("link").value = row.children[0].innerText;
      document.getElementById("agency").value = row.children[1].innerText;
      document.getElementById("movie").value = row.children[2].innerText;
      document.getElementById("amount").value = row.children[3].innerText;
      document.getElementById("status").value = row.children[4].innerText;
      document.getElementById("date").value = row.children[5].innerText;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ---------------- AUTO-FILL DATE ----------------
window.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("date");
  dateInput.value = new Date().toISOString().split("T")[0];
});
