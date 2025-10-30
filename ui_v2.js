// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDeuC7hS30cJHXoTGx6BbmW8g_kwLGakDA",
  authDomain: "vadisi-reports.firebaseapp.com",
  projectId: "vadisi-reports",
  storageBucket: "vadisi-reports.firebasestorage.app",
  messagingSenderId: "574994089915",
  appId: "1:574994089915:web:a83456675ac8f7c4fba69e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Authentication handler
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("user-email").innerText = user.email || "Signed in";
    loadReports();
  } else {
    auth.signInAnonymously().then(() => {
      loadReports();
    });
  }
});

// Add Report
document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const agency = document.getElementById("agency").value.trim();
  const movie = document.getElementById("movie").value.trim();
  const datePosted = document.getElementById("datePosted").value;
  const amount = document.getElementById("amount").value.trim();
  const paymentStatus = document.getElementById("paymentStatus").value;
  const instagramLink = document.getElementById("instagramLink").value.trim();
  const reminderDate = document.getElementById("reminderDate").value;

  if (!agency || !movie || !datePosted || !amount || !paymentStatus || !instagramLink) {
    alert("Please fill all fields before submitting.");
    return;
  }

  try {
    await db.collection("reports").add({
      agency,
      movie,
      datePosted,
      amount,
      paymentStatus,
      instagramLink,
      reminderDate: reminderDate || null,
      createdAt: new Date()
    });

    alert("Report added successfully!");
    document.getElementById("reportForm").reset();
    loadReports();
  } catch (error) {
    console.error("Error adding report:", error);
    alert("Add failed: Missing or insufficient permissions.");
  }
});

// Load Reports
async function loadReports() {
  const tableBody = document.getElementById("reportTableBody");
  tableBody.innerHTML = "";

  try {
    const snapshot = await db.collection("reports").orderBy("createdAt", "desc").get();
    snapshot.forEach((doc) => {
      const data = doc.data();
      const row = `
        <tr>
          <td>${data.agency}</td>
          <td>${data.movie}</td>
          <td>${data.datePosted}</td>
          <td>${data.amount}</td>
          <td>${data.paymentStatus}</td>
          <td><a href="${data.instagramLink}" target="_blank">Open</a></td>
          <td>${data.reminderDate ? data.reminderDate : "-"}</td>
        </tr>
      `;
      tableBody.insertAdjacentHTML("beforeend", row);
    });
    checkReminders(snapshot);
  } catch (error) {
    console.error("Error loading reports:", error);
    alert("Unable to load reports. Check permissions or connection.");
  }
}

// Check for reminders
function checkReminders(snapshot) {
  const today = new Date().toISOString().split("T")[0];
  const reminders = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.reminderDate && data.reminderDate === today) {
      reminders.push(`${data.movie} - ${data.agency}`);
    }
  });

  const reminderBox = document.getElementById("reminderBox");
  if (reminders.length > 0) {
    reminderBox.innerHTML = `<strong>Today's Reminders:</strong><br>${reminders.join("<br>")}`;
    reminderBox.style.display = "block";
  } else {
    reminderBox.style.display = "none";
  }
}

// Export to PDF
document.getElementById("exportPdf").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Vadisi Reports", 14, 15);

  const headers = [["Agency", "Movie", "Date", "Amount", "Status", "Link", "Reminder"]];
  const rows = [];

  const snapshot = await db.collection("reports").orderBy("createdAt", "desc").get();
  snapshot.forEach((docSnap) => {
    const d = docSnap.data();
    rows.push([
      d.agency,
      d.movie,
      d.datePosted,
      d.amount,
      d.paymentStatus,
      d.instagramLink,
      d.reminderDate || "-"
    ]);
  });

  doc.autoTable({
    startY: 25,
    head: headers,
    body: rows,
    styles: { fontSize: 10 },
  });

  doc.save("Vadisi_Reports.pdf");
});
