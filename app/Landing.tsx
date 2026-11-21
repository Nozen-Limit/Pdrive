import { useEffect, useRef, useState, type FormEvent } from "react";
import { backend, message } from "./api";
import "./landing.css";

type Mode = "signin" | "register";
type Notice = { kind: "error" | "info"; text: string } | null;

const Book = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Logo = () => (
  <a className="lp-logo" href="#top">
    <span className="lp-mark">
      <Book />
    </span>
    <span>
      <small>PROJECT</small>
      <b>SIKAP</b>
    </span>
  </a>
);

/** Public front page: what SIKAP is, plus sign in and account creation. */
export function Landing({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("signin"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<Notice>(null),
    [show, setShow] = useState(false),
    [email, setEmail] = useState(""),
    [resetWait, setResetWait] = useState(false);

  useEffect(() => {
    const timer = resetWait ? setTimeout(() => setResetWait(false), 60000) : 0;
    return () => clearTimeout(timer);
  }, [resetWait]);

  const open = (next: Mode) => {
    setMode(next);
    setNotice(null);
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const register = mode === "register";
    if (register && f.get("password") !== f.get("confirm")) {
      setNotice({ kind: "error", text: "The passwords do not match." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = (await backend.api(
        register ? "auth/register" : "auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            name: f.get("name"),
            email: f.get("email"),
            password: f.get("password"),
            remember: register || f.has("remember"),
          }),
        },
      )) as { needsConfirmation?: boolean } | undefined;
      if (result?.needsConfirmation) {
        setNotice({
          kind: "info",
          text: "Account created. Check your email to confirm it, then sign in. A head teacher approves new accounts.",
        });
        setMode("signin");
        return;
      }
      dialog.current?.close();
      await onSignedIn();
    } catch (error) {
      setNotice({ kind: "error", text: message(error) });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setNotice({ kind: "error", text: "Enter your email above first." });
      return;
    }
    setBusy(true);
    try {
      await backend.reset(email.trim());
      setResetWait(true);
      setNotice({
        kind: "info",
        text: "If the account exists, a reset link will arrive by email. Check Spam too, and open it in this browser.",
      });
    } catch (error) {
      setNotice({ kind: "error", text: message(error) });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setNotice({ kind: "error", text: "Enter your registered email first." });
      return;
    }
    setBusy(true);
    try {
      await backend.api("auth/resend", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setNotice({
        kind: "info",
        text: "If your account needs confirmation, a new link will arrive by email. Check Spam too.",
      });
    } catch (error) {
      setNotice({ kind: "error", text: message(error) });
    } finally {
      setBusy(false);
    }
  }

  const register = mode === "register";
  return (
    <div className="lp" id="top">
      <div className="lp-bg" aria-hidden="true" />
      <header className="lp-header lp-wrap">
        <nav className="lp-nav" aria-label="Main">
          <Logo />
          <div className="lp-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#heads">For head teachers</a>
          </div>
          <button
            type="button"
            className="lp-btn primary"
            onClick={() => open("register")}
          >
            Create account
          </button>
          <button
            type="button"
            className="lp-btn outline"
            onClick={() => open("signin")}
          >
            Sign in
          </button>
        </nav>
      </header>

      <main>
        <div className="lp-wrap lp-hero">
          <p className="lp-eyebrow">Project SIKAP</p>
          <h1>
            Every lesson, <span>shared and reviewed</span>
          </h1>
          <p className="lp-lead">
            The school's Digital Bank of teaching resources. Teachers upload,
            head teachers review, and every approved lesson is ready for the
            whole faculty.
          </p>
          <div className="lp-ctas">
            <button
              type="button"
              className="lp-btn primary"
              onClick={() => open("register")}
            >
              Create your teacher account
            </button>
            <button
              type="button"
              className="lp-btn outline"
              onClick={() => open("signin")}
            >
              Sign in
            </button>
          </div>
          <p className="lp-trust">
            For teachers and head teachers with an approved school account
          </p>

          <div className="lp-window" aria-label="Preview of the workspace">
            <div className="lp-win">
              <div className="lp-bar" aria-hidden="true">
                <i style={{ background: "#ff5f57" }} />
                <i style={{ background: "#febc2e" }} />
                <i style={{ background: "#28c840" }} />
              </div>
              <div className="lp-appv">
                <div className="lp-rail">
                  <div className="on">Overview</div>
                  <div>Digital Bank</div>
                  <div>My Resources</div>
                  <div>Collaboration</div>
                </div>
                <div className="lp-main">
                  <h3>Magandang umaga, teacher</h3>
                  <div className="lp-tiles">
                    {[
                      ["To do", "3"],
                      ["Your approved", "7 / 9"],
                      ["In review", "1"],
                      ["Digital Bank", "214"],
                    ].map(([label, value]) => (
                      <div className="lp-tile" key={label}>
                        <span>{label}</span>
                        <b>{value}</b>
                      </div>
                    ))}
                  </div>
                  <div className="lp-list">
                    {(
                      [
                        [
                          "DOCX",
                          "#2f5d9e",
                          "Local weather patterns",
                          "Returned with feedback",
                          "Revise",
                          "#a23b3b",
                          "#fbe3e1",
                        ],
                        [
                          "PDF",
                          "#b6463a",
                          "Energy flow in rice fields",
                          "Science 5 · Term 2",
                          "Approved",
                          "#2f7a4f",
                          "#e3f2e8",
                        ],
                        [
                          "PDF",
                          "#b6463a",
                          "Tula tungkol sa anihan",
                          "Invitation to collaborate",
                          "Invite",
                          "#1f5fd6",
                          "#e8eef8",
                        ],
                      ] as const
                    ).map(([ext, color, title, sub, pill, ink, bg]) => (
                      <div className="lp-li" key={title}>
                        <span className="lp-fi" style={{ background: color }}>
                          {ext}
                        </span>
                        <div>
                          <strong>{title}</strong>
                          <small>{sub}</small>
                        </div>
                        <span
                          className="lp-pill"
                          style={{ color: ink, background: bg }}
                        >
                          {pill}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="lp-section lp-wrap" id="how">
          <p className="lp-kick">How it works</p>
          <h2>From your classroom to the whole faculty</h2>
          <div className="lp-cards">
            {[
              [
                "Upload",
                "Add a lesson, worksheet or module as PDF or Word, tagged to its learning competency, grade and quarter.",
              ],
              [
                "Review",
                "A head teacher checks objectives, content, activities and assessment, then approves it or returns it with feedback.",
              ],
              [
                "Share",
                "Approved resources join the Digital Bank, where every teacher can find, save and download them.",
              ],
            ].map(([title, text], i) => (
              <div className="lp-card" key={title}>
                <span className="n">{i + 1}</span>
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section lp-wrap" id="features">
          <p className="lp-kick">Features</p>
          <h2>Everything a faculty needs to build its bank</h2>
          <div className="lp-cards">
            {[
              [
                "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
                "Find in seconds",
                "Search and filter by learning area, grade, quarter and category.",
              ],
              [
                "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6",
                "Write together",
                "Invite colleagues to a draft, comment, and propose revised files. Everyone is credited.",
              ],
              [
                "M5 12l4 4 10-10",
                "Checklist review",
                "Clear feedback on what to fix, with every version kept.",
              ],
              [
                "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4",
                "Curriculum-aligned",
                "Each resource links to its official learning competency and code.",
              ],
              [
                "M4 20V10M10 20V4M16 20v-7M22 20H2",
                "See the gaps",
                "A coverage map shows which grades and subjects still need resources.",
              ],
              [
                "M5 4h14v12H5zM9 20h6M12 16v4",
                "Works on any device",
                "School computer, laptop or phone. Files stay private to the school.",
              ],
            ].map(([d, title, text]) => (
              <div className="lp-card" key={title}>
                <Icon d={d} />
                <h4>{title}</h4>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section lp-wrap" id="heads">
          <div className="lp-split">
            <div>
              <p className="lp-kick">For head teachers</p>
              <h2>Review with confidence, not with paperwork</h2>
              <ul>
                {[
                  "One queue for everything waiting for review",
                  "Approve new teacher accounts before they can upload",
                  "Teacher summary and curriculum coverage reports",
                  "Archive outdated resources without losing their history",
                ].map((text) => (
                  <li key={text}>
                    <i aria-hidden="true">✓</i>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-review" aria-label="Example review checklist">
              <b>Energy flow in rice fields · Version 2</b>
              {[
                ["Objectives", true],
                ["Content", true],
                ["Activities", false],
                ["Assessment", true],
              ].map(([item, ok]) => (
                <div className="chk" key={String(item)}>
                  <span>{item}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: ok ? "var(--lp-ok)" : "var(--lp-warn)",
                    }}
                  >
                    {ok ? "Meets requirements" : "Needs revision"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="lp-wrap">
          <div className="lp-cta">
            <h2>Bring your lessons to the bank</h2>
            <p>
              Create your account with your school email. Your head teacher
              approves it, and you're in.
            </p>
            <div className="lp-ctas">
              <button
                type="button"
                className="lp-btn outline"
                onClick={() => open("register")}
              >
                Create your teacher account
              </button>
              <button
                type="button"
                className="lp-btn ghost"
                onClick={() => open("signin")}
              >
                Sign in
              </button>
            </div>
          </div>
          <footer className="lp-footer">
            <span>© {new Date().getFullYear()} Project SIKAP</span>
            <span>Questions about your account? Ask your head teacher.</span>
          </footer>
        </div>
      </main>

      <dialog
        ref={dialog}
        className="lp-dialog"
        aria-label={register ? "Create an account" : "Sign in"}
        onClick={(e) => {
          if (e.target === dialog.current && !busy) dialog.current.close();
        }}
      >
        <form className="lp-dlg" onSubmit={(e) => void submit(e)}>
          <div className="lp-dlg-top">
            <Logo />
            <button
              type="button"
              className="lp-x"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </div>
          <div className="lp-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!register}
              onClick={() => {
                setMode("signin");
                setNotice(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={register}
              onClick={() => {
                setMode("register");
                setNotice(null);
              }}
            >
              Create account
            </button>
          </div>
          {register && (
            <div className="lp-field">
              <label htmlFor="lp-name">Full name</label>
              <input
                id="lp-name"
                name="name"
                required
                maxLength={120}
                autoComplete="name"
              />
            </div>
          )}
          <div className="lp-field">
            <label htmlFor="lp-email">
              {register ? "School email" : "Email"}
            </label>
            <input
              id="lp-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={register ? "lp-two" : undefined}>
            <div className="lp-field">
              <label htmlFor="lp-password">Password</label>
              <div className="lp-pw">
                <input
                  id="lp-password"
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={register ? 12 : undefined}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={register ? "12+ characters" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {register && (
              <div className="lp-field">
                <label htmlFor="lp-confirm">Confirm</label>
                <input
                  id="lp-confirm"
                  name="confirm"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>
          {!register && (
            <div className="lp-row">
              <label>
                <input type="checkbox" name="remember" defaultChecked /> Keep me
                signed in
              </label>
              <button
                type="button"
                className="lp-link"
                disabled={resetWait}
                onClick={() => void forgot()}
              >
                {resetWait ? "Reset link sent" : "Forgot password?"}
              </button>
            </div>
          )}
          {notice && (
            <p
              className={`lp-msg ${notice.kind}`}
              role={notice.kind === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          )}
          <button type="submit" className="lp-btn primary" disabled={busy}>
            {busy
              ? register
                ? "Creating account…"
                : "Signing in…"
              : register
                ? "Create account"
                : "Sign in"}
          </button>
          {register ? (
            <p className="lp-fine">
              After you confirm your email, a head teacher approves your
              account.
            </p>
          ) : (
            <p className="lp-fine">
              Didn't get the confirmation email?{" "}
              <button
                type="button"
                className="lp-link"
                onClick={() => void resend()}
              >
                Send it again
              </button>
            </p>
          )}
        </form>
      </dialog>
    </div>
  );
}
