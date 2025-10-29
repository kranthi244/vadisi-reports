import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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

// Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");

// Sign In
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Sign in failed:", error.message);
  }
});

// Sign Out
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Auth State Change
onAuthStateChanged(auth, async (user) => {
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

// Add Report
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in first.");
    return;
  }

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const status = document.getElementById("status").value;
  let date = document.getElementById("date").value;

  // Default to system date if none selected
  if (!date) {
    const today = new Date();
    date = today.toISOString().split("T")[0];
  }

  try {
    await addDoc(collection(db, "users", user.uid, "reports"), {
      link,
      agency,
      movie,
      amount,
      status,
      date,
      createdAt: new Date().toISOString()
    });
    alert("Report added successfully!");
    reportForm.reset();
    loadReports(user.uid);
  } catch (error) {
    console.error("Failed to add report:", error.message);
    alert("Failed to add report: " + error.message);
  }
});

// Load Reports
async function loadReports(uid) {
  const q = query(collection(db, "users", uid, "reports"), orderBy("date", "desc"));
  const querySnapshot = await getDocs(q);
  reportBody.innerHTML = "";
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="${data.link}" target="_blank">Link</a></td>
      <td>${data.agency}</td>
      <td>${data.movie}</td>
      <td>${data.amount}</td>
      <td>${data.status}</td>
      <td>${data.date}</td>
    `;
    reportBody.appendChild(row);
  });
}
