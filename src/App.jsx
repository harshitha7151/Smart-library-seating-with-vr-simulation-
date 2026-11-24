import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import { apiRequest } from "./api";

const LibraryMap3D = lazy(() => import("./LibraryMap3D"));
const UnityLibraryPage = lazy(() => import("./UnityLibraryPage"));
const DatabaseLab = lazy(() => import("./DatabaseLab"));
const loadAccountPages = () => import("./AccountPages");
const AuthPage = lazy(() => loadAccountPages().then((module) => ({ default: module.AuthPage })));
const BookingPage = lazy(() => loadAccountPages().then((module) => ({ default: module.BookingPage })));
const ProfilePage = lazy(() => loadAccountPages().then((module) => ({ default: module.ProfilePage })));

function PageLoading({ children }) {
  return <div className="page-loading" role="status" aria-live="polite">{children}</div>;
}

function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [returnTo, setReturnTo] = useState("home");
  const [pendingSeat, setPendingSeat] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    let active = true;
    apiRequest("/api/auth/me")
      .then(({ user: currentUser }) => { if (active) setUser(currentUser); })
      .catch(() => {})
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || page !== "home") return undefined;
    let active = true;
    apiRequest("/api/bookings/mine")
      .then(({ bookings }) => {
        if (!active) return;
        const next = bookings
          .filter((booking) => booking.status === "confirmed" && new Date(booking.endAt) > new Date())
          .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0] ?? null;
        setDashboard({ userId: user.id, booking: next, error: "" });
      })
      .catch((error) => { if (active) setDashboard({ userId: user.id, booking: null, error: error.message }); });
    return () => { active = false; };
  }, [user, page]);

  async function logout() {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); }
    finally { setUser(null); setPage("home"); }
  }

  function requireLogin(seatId = null) {
    setPendingSeat(seatId);
    setReturnTo("map");
    setPage("auth");
  }

  if (page === "map") {
    return (
      <div className="map-page-shell">
        <div className="map-page-actions">
          <button className="start-button" onClick={() => setPage("home")}>← Back to Home</button>
          {user && <div className="map-account-actions"><span>{user.displayName}</span><button onClick={() => setPage("bookings")}>My Bookings</button><button onClick={() => setPage("profile")}>Profile</button><button onClick={logout}>Sign out</button></div>}
        </div>
        <Suspense fallback={<PageLoading>Loading the third-floor map…</PageLoading>}>
          <LibraryMap3D
            isAuthenticated={Boolean(user)}
            initialSelectedSeat={pendingSeat}
            onRequireLogin={requireLogin}
            onClearPendingSeat={() => setPendingSeat(null)}
            onOpenBookings={() => setPage("bookings")}
          />
        </Suspense>
      </div>
    );
  }

  if (page === "unity") return <Suspense fallback={<PageLoading>Loading the virtual library…</PageLoading>}><UnityLibraryPage
    user={user}
    onHome={() => setPage("home")}
    onOpenMap={() => setPage("map")}
    onOpenBookings={() => { if (user) setPage("bookings"); else { setReturnTo("bookings"); setPage("auth"); } }}
    onProfile={() => { if (user) setPage("profile"); else { setReturnTo("profile"); setPage("auth"); } }}
    onLogout={logout}
    onSignIn={() => { setReturnTo("unity"); setPage("auth"); }}
  /></Suspense>;

  if (page === "database") return user?.isAdmin
    ? <Suspense fallback={<PageLoading>Loading the database lab…</PageLoading>}><DatabaseLab onHome={() => setPage("home")} /></Suspense>
    : <div className="page-loading" role="alert">Administrator access is required. <button onClick={() => setPage("home")}>Return home</button></div>;

  if (page === "auth") return <Suspense fallback={<PageLoading>Loading sign-in…</PageLoading>}><AuthPage onHome={() => setPage("home")} onSignedIn={(nextUser) => { setUser(nextUser); setPage(returnTo); }} /></Suspense>;
  if (page === "bookings") return <Suspense fallback={<PageLoading>Loading your bookings…</PageLoading>}>{user ? <BookingPage onHome={() => setPage("home")} /> : <AuthPage onHome={() => setPage("home")} onSignedIn={(nextUser) => { setUser(nextUser); setPage("bookings"); }} />}</Suspense>;
  if (page === "profile") return <Suspense fallback={<PageLoading>Loading your profile…</PageLoading>}>{user ? <ProfilePage user={user} onHome={() => setPage("home")} onUpdated={setUser} onLogout={logout} /> : <AuthPage onHome={() => setPage("home")} onSignedIn={(nextUser) => { setUser(nextUser); setPage("profile"); }} />}</Suspense>;

  return (
    <div className="app">
      <nav className="navbar">
        <button className="brand-button" onClick={() => setPage("home")} aria-label="SeatSpace home">SeatSpace</button>
        <span>Smart Library Management</span>
        <div className="navbar-actions">
          <button onClick={() => setPage("map")}>Explore library</button>
          <button onClick={() => setPage("unity")}>Virtual library</button>
          {user?.isAdmin && <button onClick={() => setPage("database")}>Database Lab</button>}
          {user ? <>
            <button onClick={() => setPage("bookings")}>My Bookings</button>
            <button onClick={() => setPage("profile")}>Profile</button>
            <button onClick={logout}>Sign out</button>
          </> : <button onClick={() => { setReturnTo("home"); setPage("auth"); }}>{authChecked ? "Student sign in" : "Sign in"}</button>}
        </div>
      </nav>

      <main className="hero">
        <div className="hero-copy">
          <p className="tagline">RVCE LIBRARY · THIRD FLOOR</p>
          <h1>{user ? `Welcome back, ${user.displayName}.` : <>Find your place<br />to focus.</>}</h1>
          <p className="description">Explore the real 3D third-floor seating plan, check a chair for your chosen time, and reserve it from SeatSpace.</p>
          <div className="hero-actions">
            <button className="start-button" onClick={() => setPage("map")}>Explore seats</button>
            {!user && <button className="secondary-button" onClick={() => { setReturnTo("home"); setPage("auth"); }}>Create account</button>}
            {user && <button className="secondary-button" onClick={() => setPage("bookings")}>My bookings</button>}
          </div>
        </div>
        <aside className="hero-note">
          <span className="hero-note-kicker">SEATSPACE</span>
          <strong>One floor. Clear choices.</strong>
          <span>Use the overhead plan to choose a seat, then switch to 3D perspective whenever you like.</span>
        </aside>
      </main>

      {user && (() => {
        const summary = dashboard?.userId === user.id ? dashboard : null;
        return <section className="welcome-message" aria-live="polite">
          <div><p className="tagline">YOUR STUDENT HOME</p><h2>Next booking</h2>
            {summary?.error ? <p role="alert">Bookings could not be loaded: {summary.error}</p>
              : !summary ? <p>Loading your bookings…</p>
                : summary.booking ? <p><strong>{summary.booking.tableId} · {summary.booking.seatId}</strong><br />{new Date(summary.booking.startAt).toLocaleString()} – {new Date(summary.booking.endAt).toLocaleTimeString()}</p>
                  : <p>You have no upcoming reservations.</p>}
          </div>
          <button className="secondary-button" onClick={() => setPage("bookings")}>View bookings</button>
        </section>;
      })()}

      <section className="features">
        <div className="feature-card"><span className="feature-index">01</span><h3>Explore in 3D</h3><p>Switch between an overhead seating plan and an angled perspective of the third floor.</p></div>
        <div className="feature-card"><span className="feature-index">02</span><h3>Check a seat</h3><p>Seat availability is read from the booking service for the time you choose.</p></div>
        <div className="feature-card"><span className="feature-index">03</span><h3>Reserve and check in</h3><p>Confirm your reservation, then check in during its grace period from My Bookings.</p></div>
      </section>
      <section className="how-it-works">
        <div><p className="tagline">A SIMPLE FLOW</p><h2>From map to seat.</h2><p>Reservations and check-in are confirmed by the server. The map cannot tell whether someone is physically sitting in a chair.</p></div>
        <ol><li><span>1</span>Explore the third-floor plan</li><li><span>2</span>Choose an available chair and time</li><li><span>3</span>Confirm your reservation</li><li><span>4</span>Check in before the deadline</li></ol>
      </section>
      <footer><strong>SeatSpace</strong><span>Smart library seating management · RVCE Library third floor</span></footer>
    </div>
  );
}

export default App;
