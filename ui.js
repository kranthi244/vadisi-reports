// ============================
// TELUGU SWAGGERS APP SCRIPT
// ============================

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e",
};

// --- Firebase Init ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- Elements ---
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");

const totalPendingEl = document.getElementById("totalPending");
const totalClearedEl = document.getElementById("totalCleared");
const totalEntriesEl = document.getElementById("totalEntries");

// --- Globals ---
let currentUser = null;

// ============================
// AUTHENTICATION
// ============================
loginBtn?.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert("Sign in failed: " + err.message);
  }
});

logoutBtn?.addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    loadReports();
  } else {
    currentUser = null;
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    reportBody.innerHTML = "";
  }
});

// ============================
// ADD REPORT
// ============================
reportForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = Number(document.getElementById("amount").value) || 1200;
  const status = document.getElementById("status").value;
  const date =
    document.getElementById("date").value ||
    new Date().toISOString().split("T")[0];
  const notes = document.getElementById("notes").value.trim();

  try {
    await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("reports")
      .add({ link, agency, movie, amount, status, date, notes });

    reportForm.reset();
    document.getElementById("amount").value = 1200;
    loadReports();
  } catch (err) {
    console.error("Failed to add report:", err);
    alert("Failed to add report: " + err.message);
  }
});

// ============================
// LOAD REPORTS
// ============================
async function loadReports() {
  if (!currentUser) return;

  const snapshot = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("reports")
    .orderBy("date", "desc")
    .get();

  reportBody.innerHTML = "";
  let totalPending = 0;
  let totalCleared = 0;
  let totalEntries = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    totalEntries++;
    if (data.status === "Pending") totalPending += data.amount;
    if (data.status === "Cleared") totalCleared += data.amount;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td contenteditable="true">${data.link}</td>
      <td contenteditable="true">${data.agency}</td>
      <td contenteditable="true">${data.movie}</td>
      <td contenteditable="true">${data.amount}</td>
      <td contenteditable="true">${data.status}</td>
      <td>${data.date}</td>
      <td contenteditable="true">${data.notes || ""}</td>
      <td><button class="saveBtn" data-id="${doc.id}">💾</button></td>
    `;
    reportBody.appendChild(tr);
  });

  totalPendingEl.textContent = `₹${totalPending}`;
  totalClearedEl.textContent = `₹${totalCleared}`;
  totalEntriesEl.textContent = totalEntries;

  addEditListeners();
}

// ============================
// INLINE EDIT & UPDATE
// ============================
function addEditListeners() {
  document.querySelectorAll(".saveBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const id = btn.getAttribute("data-id");
      const cells = row.querySelectorAll("td");

      const updatedData = {
        link: cells[0].innerText.trim(),
        agency: cells[1].innerText.trim(),
        movie: cells[2].innerText.trim(),
        amount: Number(cells[3].innerText.trim()),
        status: cells[4].innerText.trim(),
        notes: cells[6].innerText.trim(),
      };

      try {
        await db
          .collection("users")
          .doc(currentUser.uid)
          .collection("reports")
          .doc(id)
          .update(updatedData);
        loadReports();
      } catch (err) {
        alert("Failed to update: " + err.message);
      }
    });
  });
}

// ============================
// PDF EXPORT
// ============================
document.getElementById("exportPDF")?.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Telugu Swaggers Report", 10, 10);
  let y = 20;
  document.querySelectorAll("#reportBody tr").forEach((row) => {
    const cells = [...row.querySelectorAll("td")]
      .map((td) => td.innerText)
      .join(" | ");
    doc.text(cells, 10, y);
    y += 8;
  });
  doc.save("TeluguSwaggers_Report.pdf");
});

// ============================
// DARK MODE TOGGLE
// ============================
const toggle = document.getElementById("themeToggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  });

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }
}

// ============================
// AUTO-PREFILL FIELDS
// ============================
const knownAgencies = new Set();
const knownMovies = new Set();

async function loadSuggestions() {
  if (!currentUser) return;
  const snapshot = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("reports")
    .get();
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.agency) knownAgencies.add(data.agency);
    if (data.movie) knownMovies.add(data.movie);
  });

  const agencyInput = document.getElementById("agency");
  const movieInput = document.getElementById("movie");

  agencyInput.addEventListener("input", () => {
    for (let name of knownAgencies) {
      if (name.toLowerCase().startsWith(agencyInput.value.toLowerCase())) {
        agencyInput.value = name;
        break;
      }
    }
  });

  movieInput.addEventListener("input", () => {
    for (let name of knownMovies) {
      if (name.toLowerCase().startsWith(movieInput.value.toLowerCase())) {
        movieInput.value = name;
        break;
      }
    }
  });
}

auth.onAuthStateChanged(() => loadSuggestions());
