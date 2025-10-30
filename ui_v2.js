import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

// --- INITIALIZE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- ELEMENTS ---
const addBtn = document.getElementById("addReport");
const reportsTable = document.getElementById("reportsTable");
const showRemindersBtn = document.getElementById("showReminders");
const exportPDFBtn = document.getElementById("exportPDF");
const totalPending = document.getElementById("totalPending");
const totalCleared = document.getElementById("totalCleared");
const entriesMonth = document.getElementById("entriesMonth");
const topAgency = document.getElementById("topAgency");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    watchReports();
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    reportsTable.innerHTML = "";
  }
});

loginBtn.addEventListener("click", async () => await signInWithPopup(auth, provider));
logoutBtn.addEventListener("click", async () => await signOut(auth));

// --- ADD REPORT ---
addBtn.addEventListener("click", async () => {
  const instagramLink = document.getElementById("instagramLink").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const status = document.getElementById("statusField").value.trim();
  const date = document.getElementById("date").value || new Date().toISOString().split("T")[0];

  if (!instagramLink || !agency || !movie || !amount) {
    alert("Please fill all required fields.");
    return;
  }

  await addDoc(collection(db, "reports"), {
    instagramLink,
    agency,
    movie,
    amount: Number(amount),
    status,
    date,
    createdAt: new Date()
  });

  document.getElementById("instagramLink").value = "";
  document.getElementById("agency").value = "";
  document.getElementById("movie").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("statusField").value = "Pending";

  alert("Report added successfully.");
});

// --- WATCH REPORTS (REALTIME UPDATES) ---
function watchReports() {
  const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    let html = `
      <table>
        <tr>
          <th>Link</th>
          <th>Agency</th>
          <th>Movie</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
    `;

    let totalPendingAmount = 0;
    let totalClearedAmount = 0;
    let agenciesCount = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      html += `
        <tr>
          <td><a href="${data.instagramLink}" target="_blank">${data.instagramLink}</a></td>
          <td>${data.agency}</td>
          <td>${data.movie}</td>
          <td>₹${data.amount}</td>
          <td>${data.status}</td>
          <td>${data.date}</td>
        </tr>
      `;
      if (data.status.toLowerCase() === "pending") totalPendingAmount += data.amount;
      else totalClearedAmount += data.amount;

      agenciesCount[data.agency] = (agenciesCount[data.agency] || 0) + data.amount;
    });

    html += "</table>";
    reportsTable.innerHTML = html;

    const topAgencyName =
      Object.keys(agenciesCount).length === 0
        ? "-"
        : Object.entries(agenciesCount).sort((a, b) => b[1] - a[1])[0][0];

    totalPending.innerText = `₹${totalPendingAmount}`;
    totalCleared.innerText = `₹${totalClearedAmount}`;
    entriesMonth.innerText = snapshot.size;
    topAgency.innerText = topAgencyName;
  });
}

// --- SHOW REMINDERS ---
showRemindersBtn.addEventListener("click", async () => {
  const today = new Date();
  const q = query(collection(db, "reports"));
  const querySnapshot = await getDocs(q);
  const reminderList = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const reportDate = new Date(data.date);
    const diffDays = Math.floor((today - reportDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 30 && data.status.toLowerCase() !== "paid") {
      reminderList.push(data);
    }
  });

  if (reminderList.length === 0) {
    alert("No pending payments older than 30 days.");
    return;
  }

  let html = `
    <table>
      <tr>
        <th>Link</th>
        <th>Agency</th>
        <th>Movie</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Date</th>
      </tr>
  `;
  reminderList.forEach((data) => {
    html += `
      <tr>
        <td><a href="${data.instagramLink}" target="_blank">${data.instagramLink}</a></td>
        <td>${data.agency}</td>
        <td>${data.movie}</td>
        <td>₹${data.amount}</td>
        <td>${data.status}</td>
        <td>${data.date}</td>
      </tr>
    `;
  });
  html += "</table>";
  reportsTable.innerHTML = html;
});

// --- EXPORT AS PDF ---
exportPDFBtn.addEventListener("click", () => {
  const content = reportsTable.innerHTML;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>Reports PDF</title>
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
});
