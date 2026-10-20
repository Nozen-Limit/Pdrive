function workspaceBrand() {
  return `<div class="workspace-brand"><span class="brand-symbol">${ico("auto_stories")}</span><div class="brand-type"><small>PROJECT</small><strong>SIKAP</strong></div></div>`;
}
function workspaceAccount() {
  const user = data.user;
  return `<button class="workspace-account" onclick="go('profile')" aria-label="Open profile"><span class="avatar">${avatarContent(user)}</span><span><strong>${esc(user.name)}</strong><small>${user.role === "head" ? "Head Teacher" : "Teacher"}</small></span></button><button class="logout-btn" onclick="logout()">${ico("logout")}<span>Log out</span></button>`;
}
function workspaceRender({
  classes = "",
  navigation,
  heading,
  actions,
  content,
  bankPage = false,
}) {
  $("#app").innerHTML =
    `<div class="app bank-app workspace-app ${classes}" style="${bankThemeStyle()}"><aside class="sidebar workspace-sidebar${bankPage ? " bank-sidebar" : ""}" id="side">${workspaceBrand()}${navigation}${workspaceAccount()}</aside><div class="overlay" id="overlay" onclick="menu()"></div><main class="main${bankPage ? " bank-main" : ""}"><header class="topbar${bankPage ? " bank-topbar" : ""}">${heading}<div class="top-actions${bankPage ? " bank-user-actions" : ""}">${actions}</div></header><section class="content${bankPage ? " bank-content" : ""}">${content}</section></main></div><div id="modalRoot" class="workspace-dialogs" style="${bankThemeStyle()}"></div>`;
}
