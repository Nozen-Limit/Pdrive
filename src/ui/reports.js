function reportsPage() {
  const list = filtered(),
    approved = list.filter((m) => m.status === "approved").length,
    returned = list.filter((m) => m.status === "returned").length,
    pending = list.filter((m) => m.status === "pending").length;
  return `${complianceReport()}${filterPanel()}<div class="toolbar"><p class="muted">Report for the current filters · ${list.length} modules</p><button class="secondary" onclick="exportReport()">Export CSV</button></div><div class="cards">${stat("Approval rate", list.length ? Math.round((approved / list.length) * 100) + "%" : "0%", "#e4f3e9")}${stat("Pending review", pending, "#fff3cf")}${stat("Needs revision", returned, "#f9e7ea")}${stat("Submitting teachers", new Set(list.map((m) => m.owner)).size, "#efecf9")}</div><div class="panel activity-panel"><h2>Submission activity</h2>${activity(data.events.filter((e) => list.some((m) => m.id === e.module)))}</div>`;
}
function exportReport() {
  const quote = (s) =>
      '"' +
      String(s ?? "")
        .replace(/^(\s*)([=+@-])/, "'$1$2")
        .replace(/"/g, '""') +
      '"',
    rows = [
      [
        "Title",
        "Teacher",
        "Subject",
        "Grade",
        "Term",
        "School year",
        "Status",
        "Version",
        "Submitted",
        "Approved on",
      ],
      ...filtered().map((m) => [
        m.title,
        m.teacher,
        m.subject,
        m.grade,
        m.term,
        m.year,
        label(m.status),
        m.version,
        m.created,
        m.approved,
      ]),
    ],
    blob = new Blob([rows.map((r) => r.map(quote).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "project-sikap-report.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
