import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api";
import "./AccountPages.css";

function AccountFrame({ title, onHome, children }) {
  return (
    <main className="account-page">
      <header className="account-header">
        <button className="account-link" onClick={onHome}>← SeatSpace</button>
        <span>RVCE Library · 3rd floor</span>
      </header>
      <section className="account-card">
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function AuthPage({ onHome, onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState({ displayName: "", usn: "", email: "", loginId: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "register") {
        if (values.password !== values.confirmPassword) throw new Error("The passwords do not match.");
        const registration = { displayName: values.displayName, usn: values.usn, email: values.email, password: values.password };
        const result = await apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(registration) });
        setMessage(result.message);
        setMode("login");
        setValues((current) => ({ ...current, loginId: current.usn, password: "", confirmPassword: "" }));
      } else {
        const result = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ loginId: values.loginId, password: values.password }) });
        onSignedIn(result.user);
      }
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return (
    <AccountFrame title={mode === "login" ? "Sign in" : "Create a student account"} onHome={onHome}>
      <p className="account-intro">{mode === "register" ? "Register with your USN and RVCE email address. USN format is checked, but it does not verify current enrollment." : "Sign in using your USN or RVCE email address and password."}</p>
      <form className="account-form" onSubmit={submit}>
        {mode === "register" && <label>Full name<input required maxLength="120" autoComplete="name" value={values.displayName} onChange={(event) => setValues({ ...values, displayName: event.target.value })} /></label>}
        {mode === "register" ? <>
          <label>USN<input required maxLength="10" pattern="1RV[0-9]{2}[A-Za-z]{2}[0-9]{3}" title="Use the format 1RV24IS045." autoComplete="off" placeholder="1RV24IS045" value={values.usn} onChange={(event) => setValues({ ...values, usn: event.target.value.toUpperCase() })} /><small>Example: 1RV24IS045</small></label>
          <label>RVCE email<input required type="email" maxLength="254" autoComplete="email" placeholder="name.branch26@rvce.edu.in" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label>
        </> : <label>USN or RVCE email<input required maxLength="254" autoComplete="username" placeholder="1RV24IS045 or name@rvce.edu.in" value={values.loginId} onChange={(event) => setValues({ ...values, loginId: event.target.value })} /></label>}
        <label>Password<input required type={showPassword ? "text" : "password"} minLength={mode === "register" ? 12 : 1} maxLength="128" autoComplete={mode === "login" ? "current-password" : "new-password"} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} />{mode === "register" && <small>Use at least 12 characters.</small>}</label>
        {mode === "register" && <label>Confirm password<input required type={showPassword ? "text" : "password"} maxLength="128" autoComplete="new-password" value={values.confirmPassword} onChange={(event) => setValues({ ...values, confirmPassword: event.target.value })} /></label>}
        <button className="account-link" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide password" : "Show password"}</button>
        {message && <p className="account-success" role="status">{message}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        <button className="account-primary" disabled={busy || (mode === "register" && values.password !== values.confirmPassword)}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="account-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>
        {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
      </button>
    </AccountFrame>
  );
}

export function BookingPage({ onHome }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [now, setNow] = useState(Date.now());
  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(""); }
    try {
      setBookings((await apiRequest("/api/bookings/mine")).bookings);
      setError("");
    }
    catch (requestError) { setError(requestError.message); }
    finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      reload({ silent: true });
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);

  async function bookingAction(id, action) {
    setActionId(id); setError("");
    try {
      if (action === "cancel") await apiRequest(`/api/bookings/${id}/cancel`, { method: "PATCH" });
      else await apiRequest(`/api/bookings/${id}/${action}`, { method: "POST" });
      await reload();
    }
    catch (requestError) { setError(requestError.message); }
    finally { setActionId(""); }
  }

  return (
    <AccountFrame title="My bookings" onHome={onHome}>
      {loading && <p>Loading bookings…</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {!loading && !error && bookings.length === 0 && <p className="account-intro">You do not have any bookings yet.</p>}
      {bookings.length > 0 && <p className="account-intro">Reserved seats turn yellow until check-in. The map marks app check-ins red; it does not detect physical presence.</p>}
      <div className="account-list">
        {bookings.map((booking) => (
          <article className="account-row" key={booking.id}>
            <div>
              <strong>{booking.tableId} · {booking.seatId}</strong>
              <span>{new Date(booking.startAt).toLocaleString()} – {new Date(booking.endAt).toLocaleTimeString()}</span>
              <small>{booking.status === "no_show" ? "Expired · automatically cancelled after the check-in window" : booking.checkedInAt && booking.status === "confirmed" ? "Checked in" : booking.status}</small>
              {booking.status === "confirmed" && !booking.checkedInAt && <small>
                {now < new Date(booking.startAt).getTime()
                  ? `Check-in opens ${new Date(booking.startAt).toLocaleTimeString()}`
                  : now <= new Date(booking.checkInDeadline).getTime()
                    ? `Check in within ${Math.ceil((new Date(booking.checkInDeadline).getTime() - now) / 60_000)} min`
                    : "Check-in deadline passed; expiry will be reflected when refreshed"}
              </small>}
            </div>
            <div className="account-actions">
              {booking.status === "confirmed" && !booking.checkedInAt && now < new Date(booking.startAt).getTime() && <button className="account-primary" disabled aria-label={`Check in opens at ${new Date(booking.startAt).toLocaleTimeString()}`}>Check-in opens at {new Date(booking.startAt).toLocaleTimeString()}</button>}
              {booking.status === "confirmed" && !booking.checkedInAt && now >= new Date(booking.startAt).getTime() && now <= new Date(booking.checkInDeadline).getTime() && <button className="account-primary" disabled={actionId === booking.id} onClick={() => bookingAction(booking.id, "check-in")}>{actionId === booking.id ? "Please wait…" : "Check in"}</button>}
              {booking.status === "confirmed" && booking.checkedInAt && now < new Date(booking.endAt).getTime() && <button className="account-primary" disabled={actionId === booking.id} onClick={() => bookingAction(booking.id, "check-out")}>{actionId === booking.id ? "Please wait…" : "Check out"}</button>}
              {booking.status === "confirmed" && !booking.checkedInAt && now < new Date(booking.startAt).getTime() && <button className="account-secondary" disabled={actionId === booking.id} onClick={() => bookingAction(booking.id, "cancel")}>Cancel</button>}
            </div>
          </article>
        ))}
      </div>
    </AccountFrame>
  );
}

export function ProfilePage({ user, onHome, onUpdated, onLogout }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage("");
    try { const result = await apiRequest("/api/profile", { method: "PATCH", body: JSON.stringify({ displayName }) }); onUpdated(result.user); setMessage("Profile saved."); }
    catch (requestError) { setError(requestError.message); }
  }
  return (
    <AccountFrame title="Your profile" onHome={onHome}>
      <p className="account-intro">Signed in as {user.email}</p>
      <form className="account-form" onSubmit={submit}>
        <label>Display name<input required maxLength="120" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        {message && <p className="account-success">{message}</p>}{error && <p className="account-error">{error}</p>}
        <button className="account-primary">Save profile</button>
      </form>
      <button className="account-secondary" type="button" onClick={onLogout}>Sign out</button>
    </AccountFrame>
  );
}
