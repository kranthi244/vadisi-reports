import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

// REPLACE THIS with your firebaseConfig
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
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

loginBtn.onclick = async () => await signInWithPopup(auth, provider);
logoutBtn.onclick = async () => await signOut(auth);

onAuthStateChanged(auth, (user) => {
  loginBtn.hidden = !!user;
  logoutBtn.hidden = !user;
  document.getElementById("reportForm").style.display = user ? "block" : "none";
});

const form = document.getElementById("reportForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    link: form.link.value,
    agency: form.agency.value,
    movie: form.movie.value,
    amount: parseFloat(form.amount.value),
    status: form.status.value,
    date: form.date.value
  };
  await addDoc(collection(db, "reports"), data);
  alert("Report added!");
  form.reset();
  loadReports();
});

async function loadReports(filters = {}) {
  let q = collection(db, "reports");
  let results = await getDocs(q);
  const tbody = document.getElementById("reportBody");
  tbody.innerHTML = "";
  results.forEach(doc => {
    const d = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="${d.link}" target="_blank">Link</a></td>
      <td>${d.agency}</td>
      <td>${d.movie}</td>
      <td>${d.amount}</td>
      <td>${d.status}</td>
      <td>${d.date}</td>`;
    tbody.appendChild(tr);
  });
}

loadReports();
