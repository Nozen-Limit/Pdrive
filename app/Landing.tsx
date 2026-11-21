import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
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
const Logo = ({ onClick }: { onClick?: (e: React.MouseEvent) => void }) => (
  <a className="lp-logo" href="#top" onClick={onClick}>
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
  const dialog = useRef<HTMLDialogElement>(null),
    root = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false),
    [active, setActive] = useState("");
  // Glide to a section instead of jumping, and keep the address bar clean
  // (the app uses the address for its own pages).
  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const target = id === "top" ? root.current : document.getElementById(id);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (id === "top")
      window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    else
      target?.scrollIntoView({
        behavior: still ? "auto" : "smooth",
        block: "start",
      });
  };
  // Underline the link for the section currently on screen.
  useEffect(() => {
    const ids = ["how", "teachers", "heads"];
    const update = () => {
      const line = window.innerHeight * 0.35;
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  // Reveal sections as they scroll into view; the page is fully visible
  // without this script or with reduced motion.
  useEffect(() => {
    const page = root.current;
    if (!page || !("IntersectionObserver" in window)) return;
    page.classList.add("js");
    const seen = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            seen.unobserve(entry.target);
          }
        }),
      { threshold: 0.18, rootMargin: "0px 0px -40px 0px" },
    );
    page.querySelectorAll(".reveal").forEach((el) => seen.observe(el));
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      seen.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
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
    <div className="lp" id="top" ref={root}>
      <header className={`lp-header${scrolled ? " is-scrolled" : ""}`}>
        <nav className="lp-nav lp-wrap" aria-label="Main">
          <Logo onClick={(e) => go(e, "top")} />
          <div className="lp-links">
            {(
              [
                ["how", "How it works"],
                ["teachers", "For teachers"],
                ["heads", "For head teachers"],
              ] as const
            ).map(([id, label]) => (
              <a
                key={id}
                href={"#" + id}
                className={active === id ? "is-active" : undefined}
                aria-current={active === id ? "true" : undefined}
                onClick={(e) => go(e, id)}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="lp-nav-actions">
            <button
              type="button"
              className="lp-btn text"
              onClick={() => open("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className="lp-btn primary"
              onClick={() => open("register")}
            >
              Create account
            </button>
          </div>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <p className="lp-kicker lp-rise">Project SIKAP · Digital Bank</p>
              <h1
                className="lp-rise"
                style={{ "--d": "0.08s" } as CSSProperties}
              >
                Every lesson your school writes, <em>checked and shared.</em>
              </h1>
              <p
                className="lp-lead lp-rise"
                style={{ "--d": "0.16s" } as CSSProperties}
              >
                Teachers upload the lessons and worksheets they already use. A
                head teacher reviews each one. Approved resources become the
                school's shared bank, tagged to the learning competency they
                teach.
              </p>
              <div
                className="lp-ctas lp-rise"
                style={{ "--d": "0.24s" } as CSSProperties}
              >
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
                  Sign in{" "}
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
              <dl
                className="lp-facts lp-rise"
                style={{ "--d": "0.32s" } as CSSProperties}
              >
                <div>
                  <dt>4-point</dt>
                  <dd>review checklist before anything is shared</dd>
                </div>
                <div>
                  <dt>PDF · DOCX</dt>
                  <dd>files up to 20 MB, kept private to the school</dd>
                </div>
                <div>
                  <dt>Grade 7–10</dt>
                  <dd>sorted by learning area, grade and term</dd>
                </div>
              </dl>
            </div>

            <div
              className="lp-flow lp-rise"
              style={{ "--d": "0.2s" } as CSSProperties}
              role="img"
              aria-label="A lesson moves from a teacher's drafts, through head-teacher review, into the Digital Bank."
            >
              <div className="lp-flow-head">
                <b>A lesson's way into the bank</b>
                <span className="lp-live">Live example</span>
              </div>
              <div className="lp-lanes" aria-hidden="true">
                {["Your drafts", "In review", "Digital Bank"].map((lane) => (
                  <div className="lp-lane" key={lane}>
                    <h4>{lane}</h4>
                    <div className="lp-ghost">
                      <i />
                      <i />
                    </div>
                    <div className="lp-ghost" style={{ marginTop: 92 }}>
                      <i />
                      <i />
                    </div>
                  </div>
                ))}
                <div className="lp-mover">
                  <div className="lp-mover-file">
                    <span>PDF</span>
                    <b>Energy flow in rice fields</b>
                  </div>
                  <small>Science · Grade 8 · Term 2</small>
                  <div className="lp-checks">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="lp-states">
                    <span className="lp-state draft">Draft</span>
                    <span className="lp-state review">Checklist</span>
                    <span className="lp-state ok">Approved</span>
                  </div>
                </div>
                <span className="lp-stamp">APPROVED</span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" id="how">
          <p className="lp-eyebrow reveal">How it works</p>
          <h2 className="reveal">
            Three steps from your classroom to every classroom.
          </h2>
          <ol className="lp-path reveal">
            <li>
              <h3>Upload</h3>
              <p>
                Add a lesson plan, worksheet or module with its grade, term and
                learning competency. Save it as a draft until it's ready.
              </p>
            </li>
            <li>
              <h3>Review</h3>
              <p>
                A head teacher or subject coordinator checks objectives,
                content, activities and assessment, then approves it or sends it
                back with notes.
              </p>
            </li>
            <li>
              <h3>Share</h3>
              <p>
                Approved resources join the Digital Bank, where every teacher
                can find, save and download them, with your name on them.
              </p>
            </li>
          </ol>
        </section>

        <section className="lp-section lp-wrap" id="teachers">
          <div className="lp-split">
            <div>
              <p className="lp-eyebrow reveal">For teachers</p>
              <h2 className="reveal">Less searching. More teaching.</h2>
              <p className="lp-sub reveal">
                Find what a colleague already made for the same competency, and
                build on it instead of starting from a blank page.
              </p>
            </div>
            <ul className="lp-list reveal">
              <li>
                <b>Search by competency</b>
                <span>
                  Filter by learning area, grade and term, or search a code such
                  as <code>Science · Grade 8 · Term 2</code>.
                </span>
              </li>
              <li>
                <b>Write together</b>
                <span>
                  Invite colleagues to a draft, mention them in comments, and
                  pick the final file together. Everyone is credited.
                </span>
              </li>
              <li>
                <b>Clear feedback</b>
                <span>
                  If something needs fixing, you see exactly which checklist
                  item and why, then upload a revision.
                </span>
              </li>
              <li>
                <b>Your work, kept</b>
                <span>
                  Every version stays in the history. Extra files like answer
                  keys travel with the lesson.
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section className="lp-band" id="heads">
          <div className="lp-wrap lp-split">
            <div>
              <p className="lp-eyebrow reveal">For head teachers</p>
              <h2 className="reveal">
                Review in minutes, with a record of every decision.
              </h2>
              <ul className="lp-plain reveal">
                <li>
                  One queue for everything waiting, or assign it to a subject
                  coordinator
                </li>
                <li>
                  Approve new teacher accounts and deactivate ones that leave
                </li>
                <li>
                  Post announcements and see which competencies still have no
                  resource
                </li>
                <li>
                  Export the school's resources by teacher, subject or term
                </li>
              </ul>
            </div>
            <div
              className="lp-sheet reveal"
              aria-label="Example review checklist"
            >
              <header>
                <b>Energy flow in rice fields</b>
                <span>Version 2</span>
              </header>
              {(
                [
                  ["Objectives", "met"],
                  ["Content", "met"],
                  ["Activities", "met"],
                  ["Assessment", "met"],
                ] as const
              ).map(([item, result]) => (
                <div className="lp-check" key={item}>
                  <span>{item}</span>
                  <em className={result}>Meets requirements</em>
                </div>
              ))}
              <span className="lp-stamp">APPROVED</span>
            </div>
          </div>
        </section>

        <section className="lp-closing lp-wrap">
          <h2 className="reveal">Bring your lessons to the bank.</h2>
          <p className="lp-sub reveal">
            Sign up with your school email. Your head teacher approves the
            account, and you can start uploading the same day.
          </p>
          <div className="lp-ctas reveal">
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
              Sign in{" "}
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </button>
          </div>
          <footer className="lp-footer">
            <span>© {new Date().getFullYear()} Project SIKAP</span>
            <span>Account questions? Ask your head teacher.</span>
          </footer>
        </section>
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
          <div className={`lp-tabs${register ? " right" : ""}`} role="tablist">
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
