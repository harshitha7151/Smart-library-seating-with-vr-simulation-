import { useEffect, useRef, useState } from "react";
import "./UnityLibraryPage.css";

const PLAYER_URL = "/unity-player.html";
const LOADER_URL = "/unity/Build/unity.loader.js";
const PLAYER_TIMEOUT_MS = 180_000;

export default function UnityLibraryPage({ user, onHome, onOpenMap, onOpenBookings, onProfile, onLogout, onSignIn }) {
  const [playerState, setPlayerState] = useState("checking");
  const [playerMessage, setPlayerMessage] = useState("Checking the Unity WebGL build…");
  const [frameKey, setFrameKey] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let active = true;
    const fail = (message) => {
      if (!active) return;
      clearTimeout(timeoutRef.current);
      setPlayerState("failed");
      setPlayerMessage(message);
    };
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.source !== "seatspace-unity") return;
      if (event.data.type === "ready") {
        clearTimeout(timeoutRef.current);
        setPlayerState("ready");
        setPlayerMessage("Unity player ready.");
      } else if (event.data.type === "error") {
        fail(event.data.message || "The Unity player could not start.");
      } else if (event.data.type === "progress") {
        setPlayerState("loading");
        setPlayerMessage(`Loading the virtual library… ${Math.round((event.data.value || 0) * 100)}%`);
      }
    };

    window.addEventListener("message", onMessage);
    fetch(LOADER_URL, { method: "HEAD", credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Unity loader returned HTTP ${response.status}.`);
        if (!active) return;
        setPlayerState("loading");
        setPlayerMessage("Loading the virtual library…");
        timeoutRef.current = window.setTimeout(() => {
          fail("The Unity player did not finish loading. Check WebGL support and the server's Brotli/MIME configuration, then retry.");
        }, PLAYER_TIMEOUT_MS);
      })
      .catch((error) => fail(error.message || "The Unity WebGL build is unavailable."));

    return () => {
      active = false;
      clearTimeout(timeoutRef.current);
      window.removeEventListener("message", onMessage);
    };
  }, [frameKey]);

  const retryPlayer = () => {
    clearTimeout(timeoutRef.current);
    setPlayerState("checking");
    setPlayerMessage("Checking the Unity WebGL build…");
    setFrameKey((value) => value + 1);
  };
  const showFrame = playerState !== "failed";

  return (
    <main className="unity-page">
      <header className="unity-page-header">
        <button className="unity-brand" onClick={onHome}>SeatSpace</button>
        <div className="unity-page-actions">
          <button onClick={onOpenMap}>Current 3D map</button>
          {user ? <>
            <button onClick={onOpenBookings}>My Bookings</button>
            <button onClick={onProfile}>Profile</button>
            <button onClick={onLogout}>Sign out</button>
          </> : <button onClick={onSignIn}>Student sign in</button>}
        </div>
      </header>

      <section className="unity-page-intro">
        <p className="tagline">RVCE LIBRARY · THIRD FLOOR</p>
        <h1>Virtual Library</h1>
        <p>Walk through the generated floor, click a chair, check its live status and reserve it through SeatSpace.</p>
      </section>

      {showFrame ? <section className="unity-player-shell" aria-busy={playerState !== "ready"}>
        <iframe
          key={frameKey}
          className="unity-player-frame"
          title="SeatSpace third-floor virtual library"
          src={PLAYER_URL}
          allow="fullscreen; gamepad"
          onError={() => {
            setPlayerState("failed");
            setPlayerMessage("The Unity player frame could not be loaded.");
          }}
        />
        {playerState !== "ready" && <div className="unity-player-status" role="status">
          <div className="unity-spinner" aria-hidden="true" />
          <p>{playerMessage}</p>
        </div>}
      </section> : <section className="unity-build-message" role="alert">
        <h2>The Unity player could not load</h2>
        <p>{playerMessage}</p>
        <div className="unity-fallback-actions">
          <button className="unity-primary" onClick={retryPlayer}>Retry Unity</button>
          <button onClick={onOpenMap}>Open the existing 3D map</button>
        </div>
      </section>}
    </main>
  );
}
