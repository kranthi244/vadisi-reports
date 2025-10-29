const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const reportForm = document.getElementById('reportForm');
const reportBody = document.getElementById('reportBody');

let currentUser = null;

// Auto-fill date
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
});

// Authentication
loginBtn.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    loadReports();
  } else {
    currentUser = null;
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    reportBody.innerHTML = '';
  }
});

// Add Report
reportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert('Please sign in first.');

  const report = {
    link: document.getElementById('link').value,
    agency: document.getElementById('agency').value,
    movie: document.getElementById('movie').value,
    amount: parseFloat(document.getElementById('amount').value),
    status: document.getElementById('status').value,
    date: document.getElementById('date').value || new Date().toISOString().split('T')[0],
    uid: currentUser.uid,
    createdAt: new Date()
  };

  try {
    await db.collection('reports').add(report);
    reportForm.reset();
    loadReports();
  } catch (err) {
    console.error('Error adding report:', err);
  }
});

// Load Reports
async function loadReports() {
  if (!currentUser) return;
  const snapshot = await db.collection('reports')
    .where('uid', '==', currentUser.uid)
    .orderBy('date', 'desc')
    .get();

  renderReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Render Reports
function renderReports(reports) {
  reportBody.innerHTML = '';
  reports.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="${r.link}" target="_blank">View</a></td>
      <td>${r.agency}</td>
      <td>${r.movie}</td>
      <td>${r.amount}</td>
      <td>${r.status}</td>
      <td>${r.date}</td>
      <td><button class="action-btn" onclick="editReport('${r.id}')">Edit</button></td>
    `;
    reportBody.appendChild(tr);
  });
}

// Edit Report
async function editReport(id) {
  const newStatus = prompt('Enter new status (Pending/Cleared):');
  if (!newStatus) return;

  try {
    await db.collection('reports').doc(id).update({ status: newStatus });
    loadReports();
  } catch (err) {
    console.error('Error updating report:', err);
  }
}

// Export CSV
document.getElementById('exportCSV').addEventListener('click', async () => {
  if (!currentUser) return alert('Sign in first.');
  const snapshot = await db.collection('reports').where('uid', '==', currentUser.uid).get();

  let csv = "Link,Agency,Movie,Amount,Status,Date\n";
  snapshot.forEach(doc => {
    const r = doc.data();
    csv += `${r.link},${r.agency},${r.movie},${r.amount},${r.status},${r.date}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reports.csv';
  a.click();
});
