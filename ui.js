// Buttons
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");

// ---------- AUTH ----------
loginBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    alert("Signed in successfully!");
  } catch (error) {
    console.error("Sign-in failed:", error.message);
    alert("Sign-in failed: " + error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  alert("Signed out successfully!");
});

// Track user auth state
let currentUser = null;
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    document.body.classList.add("authenticated");
    loadReports();
  } else {
    currentUser = null;
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    document.body.classList.remove("authenticated");
    reportBody.innerHTML = "";
  }
});

// ---------- ADD REPORT ----------
reportForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert("Please sign in first!");
    return;
  }

  const link = document.getElementById("link").value.trim();
  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const amount = parseFloat(document.getElementById("amount").value) || 1200;
  const status = document.getElementById("status").value;
  const notes = document.getElementById("notes").value.trim();
  const dateInput = document.getElementById("date").value;

  // Default date = today
  const dateObj = dateInput ? new Date(dateInput) : new Date();
  const formattedDate = dateObj.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/ /g, "-");

  try {
    await db.collection("reports").add({
      uid: currentUser.uid,
      link,
      agency,
      movie,
      amount,
      status,
      notes,
      date: formattedDate,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Report added!");
    reportForm.reset();
    document.getElementById("amount").value = 1200;
    loadReports();
  } catch (error) {
    console.error("Failed to add report:", error.message);
    alert("Failed to add report: " + error.message);
  }
});

// ---------- LOAD REPORTS ----------
async function loadReports() {
  if (!currentUser) return;
  const snapshot = await db.collection("reports")
    .where("uid", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .get();

  reportBody.innerHTML = "";
  let totalPending = 0;
  let totalCleared = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.status === "Pending") totalPending += data.amount;
    if (data.status === "Cleared") totalCleared += data.amount;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="${data.link}" target="_blank">Link</a></td>
      <td>${data.agency}</td>
      <td>${data.movie}</td>
      <td>₹${data.amount}</td>
      <td>${data.status}</td>
      <td>${data.date}</td>
      <td>${data.notes || ""}</td>
      <td><button class="edit-btn" data-id="${doc.id}">✏️</button></td>
    `;
    reportBody.appendChild(row);
  });

  document.getElementById("totalPending").textContent = `Total Pending: ₹${totalPending}`;
  document.getElementById("totalCleared").textContent = `Total Cleared: ₹${totalCleared}`;
  document.getElementById("totalEntries").textContent = `Total Entries: ${snapshot.size}`;
}

// ---------- INLINE EDIT ----------
reportBody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("edit-btn")) {
    const docId = e.target.dataset.id;
    const field = prompt("Enter field to edit (status/amount/notes):");
    const value = prompt(`Enter new value for ${field}:`);
    if (field && value) {
      await db.collection("reports").doc(docId).update({ [field]: value });
      loadReports();
    }
  }
});
