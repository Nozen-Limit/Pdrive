function login(error = "") {
  const setup = authMode === "register";
  $("#app").innerHTML =
    `<main class="centered-login clean-login"><section class="landing-editorial" aria-label="Project Sikap introduction"><div class="landing-wordmark">${ico("auto_stories")} PROJECT SIKAP</div><div class="landing-story"><span class="editorial-kicker"><i></i> TEACHER MODULE PORTAL</span><h2>Module submission.<br><em>Review and approval.</em></h2></div></section><form class="login-card centered-card school-login" onsubmit="schoolLogin(event)" aria-label="${setup ? "Create an account" : "Sign in to Project Sikap"}">
 <div class="clean-brand"><span class="login-brand-icon">${ico("auto_stories")}</span>Project Sikap</div><div class="login-intro"><span class="login-kicker">YOUR SCHOOL WORKSPACE</span><h1>${setup ? "Create your account" : "Sign in"}</h1><p>${setup ? "Create your account to get started." : "Enter your school account details."}</p></div>
 ${setup ? '<div class="field"><label for="register-name">Full name</label><input id="register-name" name="name" autocomplete="name" placeholder="Enter your name" maxlength="120" required></div>' : ""}
 <div class="field"><label for="login-email">Email</label><div class="input-wrap">${ico("alternate_email")}<input id="login-email" name="email" type="email" autocomplete="username" placeholder="Enter your Email" required></div></div>
 <div class="field"><label for="login-password">Password</label><div class="input-wrap">${ico("lock")}<input id="login-password" name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" ${setup ? 'minlength="12"' : ""} maxlength="200" placeholder="${setup ? "At least 12 characters" : "Enter your password"}" required><button class="password-toggle" type="button" onclick="togglePassword()" aria-label="Show password">${ico("visibility")}</button></div></div>
 ${setup ? '<div class="field"><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm" type="password" autocomplete="new-password" placeholder="Re-enter your password" minlength="12" maxlength="200" required></div>' : ""}
 <div class="login-options"><label><input name="remember" type="checkbox">Remember me</label>${!setup ? '<button type="button" class="link-btn" onclick="passwordHelp()">Forgot password?</button>' : ""}</div>
 <p class="form-error" role="alert">${esc(error || googleError())}</p>
 <button class="primary login-submit" type="submit">${setup ? "Sign Up" : "Sign In"}</button>
 <div class="login-footer">${setup ? "Already have an account?" : "Don’t have an account?"} <button type="button" class="link-btn" onclick="setAuthMode('${setup ? "login" : "register"}')">${setup ? "Sign In" : "Sign Up"}</button></div>
 </form></main>`;
}
function setAuthMode(mode) {
  authMode = mode;
  login();
}
function googleError() {
  const code = new URLSearchParams(location.search).get("auth_error");
  return (
    {
      google_setup:
        "Google sign-in is not configured yet. Ask the workspace owner to connect it.",
      google_failed: "Google sign-in could not be completed. Please try again.",
      google_cancelled: "Google sign-in was cancelled.",
      google_link_required:
        "This email already has a school login. Sign in with your password, then link Google from Profile.",
    }[code] || ""
  );
}
async function googleSignIn(link = false) {
  try {
    await window.sikapBackend.google(link);
  } catch (e) {
    const error = $(".school-login .form-error");
    if (error) error.textContent = e.message;
    else toast(e.message);
  }
}
function togglePassword() {
  const input = $("#login-password"),
    button = $(".password-toggle"),
    show = input.type === "password";
  input.type = show ? "text" : "password";
  button.setAttribute("aria-label", show ? "Hide password" : "Show password");
  button.innerHTML = ico(show ? "visibility_off" : "visibility");
}
async function passwordHelp() {
  const email = $("#login-email").value.trim();
  if (!email) {
    $(".form-error").textContent = "Enter your email above first.";
    $("#login-email").focus();
    return;
  }
  try {
    await window.sikapBackend.reset(email);
    $(".form-error").textContent =
      "If the account exists, a reset link will arrive by email.";
  } catch (e) {
    $(".form-error").textContent = e.message;
  }
}
async function resendConfirmation() {
  const email = $("#login-email"),
    error = $(".school-login .form-error");
  if (!email.reportValidity() || !email.value.trim()) {
    error.textContent = "Enter your registered email first.";
    email.focus();
    return;
  }
  if (busy) return;
  busy = true;
  try {
    await api("auth/resend", {
      method: "POST",
      body: JSON.stringify({ email: email.value.trim() }),
    });
    error.textContent =
      "If your account needs confirmation, a new link will arrive by email. Check Spam too.";
  } catch (e) {
    error.textContent = e.message;
  } finally {
    busy = false;
  }
}
async function schoolLogin(e) {
  e.preventDefault();
  if (busy) return;
  const form = e.target,
    f = new FormData(form),
    button = form.querySelector('button[type="submit"]'),
    error = form.querySelector(".form-error");
  error.textContent = "";
  if (authMode === "register" && f.get("password") !== f.get("confirm")) {
    error.textContent = "The passwords do not match.";
    return;
  }
  busy = true;
  button.disabled = true;
  const old = button.textContent;
  button.textContent =
    authMode === "register" ? "Creating account…" : "Signing in…";
  try {
    const result = await api(
      "auth/" + (authMode === "register" ? "register" : "login"),
      {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          remember: f.has("remember"),
        }),
      },
    );
    if (result.needsConfirmation) {
      error.textContent =
        "Account created. Check your email to confirm your account, then sign in.";
      return;
    }
    view = "dashboard";
    await load();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = old;
  }
}
async function logout() {
  if (dirty && !confirm("Discard your unsaved changes and sign out?")) return;
  try {
    await api("auth/logout", { method: "POST", body: "{}" });
    data = null;
    detail = null;
    dirty = false;
    view = "dashboard";
    authMode = "login";
    await load();
    toast("You have been logged out.");
  } catch (e) {
    toast(e.message);
  }
}
async function load() {
  try {
    await window.sikapBackend.ready();
    if (window.sikapBackend.recovery) {
      resetPage();
      return;
    }
    data = await api("state");
    render();
  } catch (e) {
    if (e.status === 503 && e.message.includes("config.js")) {
      authContext = {};
      login(e.message);
      return;
    }
    if (e.status === 401) {
      try {
        authContext = await api("auth/context");
      } catch {
        authContext = null;
      }
      login();
    } else
      $("#app").innerHTML =
        `<main class="centered-login"><section class="login-card centered-card"><h1>Project Sikap</h1><p role="alert">${esc(e.message)}</p><button class="primary" onclick="load()">Try again</button></section></main>`;
  }
}

function resetPage() {
  $("#app").innerHTML =
    '<main class="centered-login clean-login"><form class="login-card centered-card school-login" onsubmit="resetPassword(event)"><div class="clean-brand">Project Sikap</div><h1 class="signup-heading">Set a new password</h1><div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></div><div class="field"><label for="repeat-password">Confirm password</label><input id="repeat-password" name="confirm" type="password" minlength="12" autocomplete="new-password" required></div><p class="form-error" role="alert"></p><button class="primary login-submit" type="submit">Update password</button></form></main>';
}
async function resetPassword(e) {
  e.preventDefault();
  const f = new FormData(e.target),
    button = e.target.querySelector("button");
  if (f.get("password") !== f.get("confirm")) {
    e.target.querySelector(".form-error").textContent =
      "Passwords do not match.";
    return;
  }
  button.disabled = true;
  try {
    await window.sikapBackend.updatePassword(f.get("password"));
    history.replaceState(null, "", location.pathname);
    await load();
    toast("Password updated.");
  } catch (error) {
    e.target.querySelector(".form-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
