import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- DOM Elements ---
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");

// --- Sign In / Out ---
loginBtn.onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert("Sign in failed: " + err.message);
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
};

// --- Auth State Change ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    loadReports(user.uid);
  } else {
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    reportBody.innerHTML = "";
  }
});

// --- Load Reports ---
async function loadReports(uid) {
  reportBody.innerHTML = "";
  const reportsRef = collection(db, "users", uid, "reports");
  const snapshot = await getDocs(reportsRef);
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="${data.link}" target="_blank">Link</a></td>
      <td>${data.agency}</td>
      <td>${data.movie}</td>
      <td>${data.amount}</td>
      <td>${data.status}</td>
      <td>${data.date}</td>
      <td>
        <button class="editBtn" data-id="${docSnap.id}">Edit</button>
        <button class="deleteBtn" data-id="${docSnap.id}">Delete</button>
      </td>`;
    reportBody.appendChild(tr);
  });

  // Add edit/delete listeners
  document.querySelectorAll(".deleteBtn").forEach((btn) =>
    btn.addEventListener("click", () => deleteReport(uid, btn.dataset.id))
  );

  document.querySelectorAll(".editBtn").forEach((btn) =>
    btn.addEventListener("click", () => editReport(uid, btn.dataset.id))
  );
}

// --- Add Report ---
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("Please sign in first.");

  const data = {
    link: document.getElementById("link").value,
    agency: document.getElementById("agency").value,
    movie: document.getElementById("movie").value,
    amount: document.getElementById("amount").value,
    status: document.getElementById("status").value,
    date: document.getElementById("date").value || new Date().toISOString().split("T")[0]
  };

  try {
    await addDoc(collection(db, "users", user.uid, "reports"), data);
    reportForm.reset();
    loadReports(user.uid);
  } catch (err) {
    alert("Failed to add report: " + err.message);
  }
});

// --- Delete Report ---
async function deleteReport(uid, id) {
  await deleteDoc(doc(db, "users", uid, "reports", id));
  loadReports(uid);
}

// --- Edit Report ---
async function editReport(uid, id) {
  const newStatus = prompt("Enter new status (Pending/Cleared):");
  if (!newStatus) return;
  const docRef = doc(db, "users", uid, "reports", id);
  await updateDoc(docRef, { status: newStatus });
  loadReports(uid);
}
