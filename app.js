// -------------------- Firebase Setup --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// -------------------- Firebase Config --------------------
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// -------------------- DOM Elements --------------------
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const userEmail = document.getElementById("userEmail");

const reportForm = document.getElementById("reportForm");
const reportsTableBody = document.querySelector("#reportsTable tbody");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");

const totalReportsEl = document.getElementById("totalReports");
const totalPendingEl = document.getElementById("totalPending");
const totalPaidEl = document.getElementById("totalPaid");
const topAgencyEl = document.getElementById("topAgency");

let currentUser = null;
let currentEditId = null;

// -------------------- Auth Logic --------------------
signInBtn.onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Sign in failed:", e.message);
    alert("Sign in failed: " + e.message);
  }
};

signOutBtn.onclick = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userEmail.textContent = user.email;
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";
    loadReports();
  } else {
    currentUser = null;
    userEmail.textContent = "";
    signInBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";
    reportsTableBody.innerHTML = "";
  }
});

// -------------------- Add Report --------------------
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Please sign in first.");

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const status = document.getElementById("status").value;
  const dateInput = document.getElementById("date").value;
  const date = dateInput || new Date().toISOString().split("T")[0];
  const notes = document.getElementById("notes").value.trim();

  try {
    await addDoc(collection(db, "reports"), {
      userId: currentUser.uid,
      link,
      agency,
      movie,
      amount,
      status,
      date,
      notes,
      createdAt: serverTimestamp(),
    });

    reportForm.reset();
    document.getElementById("date").value = "";
  } catch (e) {
    console.error("Failed to add report:", e);
    alert("Failed to add report: " + e.message);
  }
});

// -------------------- Load Reports --------------------
async function loadReports() {
  const q = query(
    collection(db, "reports"),
    where("userId", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    reportsTableBody.innerHTML = "";
    let total = 0,
      pending = 0,
      paid = 0;
    const agencyCount = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const tr = document.createElement("tr");

      const statusClass =
        data.status === "Paid" ? "status-paid" : "status-pending";

      tr.innerHTML = `
        <td><a href="${data.link}" target="_blank">Link</a></td>
        <td>${data.agency}</td>
        <td>${data.movie}</td>
        <td>₹${data.amount}</td>
        <td class="${statusClass}">${data.status}</td>
        <td>${data.date}</td>
        <td>${data.notes || ""}</td>
        <td>
          <button class="editBtn" data-id="${docSnap.id}">Edit</button>
          <button class="deleteBtn" data-id="${docSnap.id}">Delete</button>
        </td>
      `;

      reportsTableBody.appendChild(tr);

      // Dashboard calculations
      total += data.amount;
      if (data.status === "Pending") pending += data.amount;
      if (data.status === "Paid") paid += data.amount;

      agencyCount[data.agency] = (agencyCount[data.agency] || 0) + 1;
    });

    // Dashboard summary
    totalReportsEl.textContent = snapshot.size;
    totalPendingEl.textContent = pending;
    totalPaidEl.textContent = paid;

    const topAgency = Object.entries(agencyCount).sort(
      (a, b) => b[1] - a[1]
    )[0];
    topAgencyEl.textContent = topAgency ? topAgency[0] : "N/A";

    // Add edit/delete listeners
    document.querySelectorAll(".editBtn").forEach((btn) =>
      btn.addEventListener("click", () => openEditModal(btn.dataset.id))
    );
    document.querySelectorAll(".deleteBtn").forEach((btn) =>
      btn.addEventListener("click", () => deleteReport(btn.dataset.id))
    );
  });
}

// -------------------- Edit Modal --------------------
async function openEditModal(id) {
  const docRef = doc(db, "reports", id);
  const snapshot = await getDocs(query(collection(db, "reports"), where("__name__", "==", id)));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    currentEditId = id;
    editModal.style.display = "block";
    document.getElementById("editLink").value = data.link;
    document.getElementById("editAgency").value = data.agency;
    document.getElementById("editMovie").value = data.movie;
    document.getElementById("editAmount").value = data.amount;
    document.getElementById("editStatus").value = data.status;
    document.getElementById("editDate").value = data.date;
    document.getElementById("editNotes").value = data.notes || "";
  });
}

document.getElementById("cancelEdit").onclick = () => {
  editModal.style.display = "none";
};

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentEditId) return;

  const updated = {
    link: document.getElementById("editLink").value,
    agency: document.getElementById("editAgency").value,
    movie: document.getElementById("editMovie").value,
    amount: parseFloat(document.getElementById("editAmount").value),
    status: document.getElementById("editStatus").value,
    date: document.getElementById("editDate").value,
    notes: document.getElementById("editNotes").value,
  };

  try {
    await updateDoc(doc(db, "reports", currentEditId), updated);
    editModal.style.display = "none";
  } catch (e) {
    alert("Failed to update: " + e.message);
  }
});

// -------------------- Delete --------------------
async function deleteReport(id) {
  if (confirm("Delete this record?")) {
    await deleteDoc(doc(db, "reports", id));
  }
}
