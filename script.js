// --- Load saved reports from localStorage ---
let reports = JSON.parse(localStorage.getItem("reports")) || [];

// --- DOM references ---
const reportForm = document.getElementById("reportForm");
const reportBody = document.getElementById("reportBody");
const filterAgency = document.getElementById("filterAgency");
const filterMovie = document.getElementById("filterMovie");
const filterStatus = document.getElementById("filterStatus");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");

// --- Display Reports ---
function displayReports(data = reports) {
  reportBody.innerHTML = "";

  if (data.length === 0) {
    reportBody.innerHTML = `<tr><td colspan="6">No reports found</td></tr>`;
    return;
  }

  data.forEach((r, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="${r.link}" target="_blank">${r.link}</a></td>
      <td>${r.agency}</td>
      <td>${r.movie}</td>
      <td>${r.amount}</td>
      <td>${r.status}</td>
      <td>${r.date}</td>
    `;
    reportBody.appendChild(row);
  });
}

// --- Add Report ---
reportForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const newReport = {
    link: document.getElementById("link").value.trim(),
    agency: document.getElementById("agency").value.trim(),
    movie: document.getElementById("movie").value.trim(),
    amount: document.getElementById("amount").value.trim(),
    status: document.getElementById("status").value,
    date: document.getElementById("date").value,
  };

  reports.push(newReport);
  localStorage.setItem("reports", JSON.stringify(reports));

  reportForm.reset();
  displayReports();
});

// --- Filter Reports ---
document.getElementById("applyFilters").addEventListener("click", () => {
  let filtered = [...reports];

  const agencyVal = filterAgency.value.toLowerCase();
  const movieVal = filterMovie.value.toLowerCase();
  const statusVal = filterStatus.value;
  const fromVal = fromDate.value;
  const toVal = toDate.value;

  if (agencyVal) {
    filtered = filtered.filter(r => r.agency.toLowerCase().includes(agencyVal));
  }
  if (movieVal) {
    filtered = filtered.filter(r => r.movie.toLowerCase().includes(movieVal));
  }
  if (statusVal) {
    filtered = filtered.filter(r => r.status === statusVal);
  }
  if (fromVal) {
    filtered = filtered.filter(r => r.date >= fromVal);
  }
  if (toVal) {
    filtered = filtered.filter(r => r.date <= toVal);
  }

  displayReports(filtered);
});

// --- Clear Filters ---
document.getElementById("clearFilters").addEventListener("click", () => {
  filterAgency.value = "";
  filterMovie.value = "";
  filterStatus.value = "";
  fromDate.value = "";
  toDate.value = "";
  displayReports();
});

// --- Export to CSV ---
document.getElementById("exportCSV").addEventListener("click", () => {
  if (reports.length === 0) return alert("No reports to export!");

  const csvContent = [
    ["Link", "Agency", "Movie", "Amount", "Status", "Date"],
    ...reports.map(r => [r.link, r.agency, r.movie, r.amount, r.status, r.date])
  ]
  .map(e => e.join(","))
  .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "vadisi_reports.csv";
  link.click();
});

// --- Initial render ---
displayReports();
