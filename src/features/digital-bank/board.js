function bankBoard(items) {
  const shared = ["shared", "recent", "saved"].includes(bank.scope);
  const columns = shared
    ? Object.entries(bankCategories).map(([key, title]) => ({
        key,
        title: key[0] + key.slice(1).toLowerCase(),
        hint: title,
        icon: "folder",
        matches: (item) => item.category === key,
      }))
    : [
        {
          key: "draft",
          title: "Draft",
          icon: "radio_button_unchecked",
          matches: (item) => bankState(item) === "draft",
        },
        {
          key: "pending",
          title: "Pending review",
          icon: "schedule",
          matches: (item) =>
            ["pending", "resubmitted"].includes(bankState(item)),
        },
        {
          key: "returned",
          title: "Revision needed",
          icon: "change_circle",
          matches: (item) => bankState(item) === "returned",
        },
        {
          key: "approved",
          title: "Approved",
          icon: "check_circle",
          matches: (item) => bankState(item) === "approved",
        },
      ];
  if (bank.scope === "archived")
    columns.splice(0, columns.length, {
      key: "archived",
      title: "Archived",
      icon: "archive",
      matches: () => true,
    });
  return `<div class="bank-board" aria-label="Resource board">${columns
    .filter((column) => !bank.boardHidden.includes(column.key))
    .map((column) => {
      const resources = items.filter(column.matches);
      return `<section class="bank-board-column"><header><span class="bank-board-state bank-board-state-${column.key}">${ico(column.icon)}</span><h2>${column.title}</h2><span class="bank-board-count">${resources.length}</span><span class="bank-board-column-space"></span><details class="bank-column-menu"><summary aria-label="${column.title} column options">${ico("more_horiz")}</summary><div><button onclick="bankHideColumn('${column.key}')">Hide column</button><button onclick="bankLayout('list')">View as list</button></div></details>${bank.scope === "mine" ? `<button class="bank-board-add" aria-label="Upload resource" onclick="bankUploadPage()">${ico("add")}</button>` : ""}</header><div class="bank-board-stack">${resources.map(bankBoardCard).join("") || '<div class="bank-board-empty">No resources</div>'}</div></section>`;
    })
    .join("")}${
    columns.some((column) => bank.boardHidden.includes(column.key))
      ? `<aside class="bank-hidden-columns"><h2>${ico("arrow_drop_down")}Hidden columns</h2>${columns
          .filter((column) => bank.boardHidden.includes(column.key))
          .map(
            (column) =>
              `<button onclick="bankHideColumn('${column.key}')"><span class="bank-board-state bank-board-state-${column.key}">${ico(column.icon)}</span>${column.title}<span>${items.filter(column.matches).length}</span>${ico("more_horiz")}</button>`,
          )
          .join("")}</aside>`
      : ""
  }</div>`;
}
function bankBoardCard(resource) {
  const initials = (resource.creator || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  const categoryLabel =
    resource.category[0] + resource.category.slice(1).toLowerCase();
  return `<article class="bank-board-card"><div class="bank-board-card-top"><span>SIK-${esc(resource.id.slice(-6).toUpperCase())}-${resource.version}</span><span class="bank-creator-mini" title="${esc(resource.creator)}" aria-label="Created by ${esc(resource.creator)}">${esc(initials)}</span></div><div class="bank-board-card-title">${ico(bankState(resource) === "approved" ? "check_circle" : "radio_button_unchecked")}<button onclick="bankOpen('${resource.id}')">${esc(resource.title)}</button></div><div class="bank-board-card-bottom"><span class="bank-type-mini" aria-label="${resource.type === "application/pdf" ? "PDF" : resource.type ? "DOCX" : "Draft"}">${ico(resource.type === "application/pdf" ? "picture_as_pdf" : "description")}</span><span class="bank-board-label"><span class="bank-category-mark bank-category-${resource.category.toLowerCase()}"></span>${categoryLabel}</span><span class="bank-board-label bank-subject-label">${esc(resource.subject)}</span>${bankActions(resource)}</div></article>`;
}

function bankHideColumn(key) {
  bank.boardHidden = bank.boardHidden.includes(key)
    ? bank.boardHidden.filter((value) => value !== key)
    : [...bank.boardHidden, key];
  bankPaintResults();
}
