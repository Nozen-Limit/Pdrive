export function recoveryRoute(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const requested =
    url.searchParams.get("recovery") === "1" || hash.get("type") === "recovery";
  const failed =
    hash.has("error") ||
    url.searchParams.has("error") ||
    hash.has("error_code") ||
    url.searchParams.has("error_code");
  return {
    requested,
    error: failed
      ? "This password reset link has expired or is invalid. Request a new link and open it in the same browser where you requested it."
      : "",
  };
}
export function recoveryCallback(href) {
  const url = new URL("./", href);
  url.searchParams.set("recovery", "1");
  return url.href;
}
export function createResetRequester(auth, href, store, now = Date.now) {
  let sending = false;
  const cooldowns = new Map();
  const key = (email) => "sikap-reset-until:" + email;
  function remaining(email) {
    let until = cooldowns.get(email) || 0;
    try {
      until = Math.max(until, Number(store.getItem(key(email))) || 0);
    } catch {
      /* Storage is optional. */
    }
    return Math.max(0, Math.ceil((until - now()) / 1000));
  }
  function cooldown(email) {
    const until = now() + 60000;
    cooldowns.set(email, until);
    try {
      store.setItem(key(email), String(until));
    } catch {
      /* Storage is optional. */
    }
  }
  return async function request(email) {
    email = String(email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error("Enter a valid email address first.");
    if (sending)
      throw Error("A reset request is already being sent. Please wait.");
    const wait = remaining(email);
    if (wait)
      throw Object.assign(
        Error(
          `Please wait ${wait} seconds before requesting another reset link.`,
        ),
        { retryAfter: wait },
      );
    sending = true;
    try {
      const result = await auth.resetPasswordForEmail(email, {
        redirectTo: recoveryCallback(href),
      });
      if (result.error) {
        const error = result.error;
        if (
          error.status === 429 ||
          ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
            error.code,
          )
        ) {
          cooldown(email);
          throw Object.assign(
            Error(
              error.code === "over_email_send_rate_limit"
                ? "The email service has reached its sending limit. Try again later. If this continues, ask the administrator to check the email service."
                : "Too many reset requests. Wait at least one minute before trying again.",
            ),
            { status: 429, retryAfter: 60, code: error.code },
          );
        }
        throw error;
      }
      cooldown(email);
      return { retryAfter: 60 };
    } finally {
      sending = false;
    }
  };
}
