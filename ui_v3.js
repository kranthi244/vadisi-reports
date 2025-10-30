// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// UI elements
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout");
const addBtn = document.getElementById("addReport");
const clearBtn = document.getElementById("clearFields");
const exportPDF = document.getElementById("exportPDF");
const reportsBody = document.getElementById("reportsBody");

const totalCount = document.getElementById("totalCount");
const totalAmount = document.getElementById("totalAmount");
const pendingAmount = document.getElementById("pendingAmount");

// Fields
const link = document.getElementById("link");
const agency = document.getElementById("agency");
const movie = document.getElementById("movie");
const amount = document.getElementById("amount");
const status = document.getElementById("status");
const date = document.getElementById("date");
const reminder = document.getElementById("reminder");
const notes = document.getElementById("notes");

// Auth flow — auto sign in once
onAuthStateChanged(auth, async (user) => {
  if (user) {
    userEmail.textContent = user.email;
    loadReports();
  } else {
    await signInWithPopup(auth, provider);
  }
});

logoutBtn.addEventListener("click", () => {
  signOut(auth);
  userEmail.textContent = "Not signed in";
  reportsBody.innerHTML = "";
});

// Add Report
addBtn.addEventListener("click", async () => {
  const data = {
    link: link.value.trim(),
    agency: agency.value.trim(),
    movie: movie.value.trim(),
    amount: parseFloat(amount.value.trim() || 0),
    status: status.value,
    date: date.value || new Date().toISOString().split("T")[0],
    reminder: reminder.value || "",
    notes: notes.value.trim(),
    createdAt: new Date()
  };

  try {
    await addDoc(collection(db, "reports"), data);
    clearInputs();
  } catch (e) {
    alert("Add failed: " + e.message);
  }
});

// Load Reports
async function loadReports() {
  const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    reportsBody.innerHTML = "";
    let total = 0, pending = 0;

    snapshot.forEach(doc => {
      const d = doc.data();
      total += d.amount || 0;
      if (d.status === "Pending") pending += d.amount || 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.agency || "-"}</td>
        <td>${d.movie || "-"}</td>
        <td>${d.date || "-"}</td>
        <td>₹${d.amount || 0}</td>
        <td>${d.status}</td>
        <td><a href="${d.link}" target="_blank">View</a></td>
        <td>${d.reminder || "-"}</td>
      `;
      reportsBody.appendChild(tr);
    });

    totalCount.textContent = snapshot.size;
    totalAmount.textContent = total.toLocaleString("en-IN");
    pendingAmount.textContent = pending.toLocaleString("en-IN");

    checkReminders(snapshot.docs.map(d => d.data()));
  });
}

// Reminder Check
function checkReminders(reports) {
  const today = new Date().toISOString().split("T")[0];
  const due = reports.filter(r => r.reminder === today && r.status === "Pending");
  if (due.length > 0) {
    alert(`Reminder: ${due.length} pending payments due today.`);
  }
}

// Clear Inputs
function clearInputs() {
  link.value = "";
  agency.value = "";
  movie.value = "";
  amount.value = "";
  status.value = "Pending";
  date.value = "";
  reminder.value = "";
  notes.value = "";
}

// Export PDF
exportPDF.addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text("Telugu Swaggers — Promotions & Payments Report", 10, 15);
  pdf.setFontSize(11);

  let y = 30;
  pdf.text("Agency | Movie | Date | Amount | Status | Reminder", 10, 25);

  const snapshot = await getDocs(collection(db, "reports"));
  snapshot.forEach((doc) => {
    const d = doc.data();
    const line = `${d.agency || "-"} | ${d.movie || "-"} | ${d.date || "-"} | ₹${d.amount || 0} | ${d.status || "-"} | ${d.reminder || "-"}`;
    pdf.text(line, 10, y);
    y += 7;
    if (y > 280) { pdf.addPage(); y = 20; }
  });

  pdf.save("Telugu_Swaggers_Reports.pdf");
});
