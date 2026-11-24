// LibraryMap.jsx — Main map view
// Pan + Zoom implemented with native pointer/touch events (no extra libraries).
// Floor data lives in floorData.js; SVG maps in FloorSVG3.jsx / FloorSVG4.jsx.

import { useState, useRef, useCallback, useEffect } from "react";
import "./LibraryMap.css";
import FloorSVG3 from "./FloorSVG3";
import FloorSVG4 from "./FloorSVG4";
import SeatPanel from "./SeatPanel";
import { floor3Tables, floor4Tables, buildInitialSeatState, STATUS } from "./floorData";

// ── Build initial seat state once per floor ──────────────────────────────────
// We store state in a flat map: { "T6-S3": "available" | "booked" | "selected" }
function buildAllSeats() {
  return {
    "3rd Floor": buildInitialSeatState(floor3Tables),
    "4th Floor": buildInitialSeatState(floor4Tables),
  };
}

// ── Clamp helper ─────────────────────────────────────────────────────────────
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ── Pan & Zoom hook ──────────────────────────────────────────────────────────
function usePanZoom(containerRef) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef(null);          // { startX, startY, startTx, startTy }
  const pinch = useRef(null);         // { startDist, startScale }
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 4;

  const applyZoom = useCallback((delta, originX, originY) => {
    setTransform(prev => {
      const newScale = clamp(prev.scale * delta, MIN_SCALE, MAX_SCALE);
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        x: originX - ratio * (originX - prev.x),
        y: originY - ratio * (originY - prev.y),
      };
    });
  }, []);

  // ── Mouse wheel zoom ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.12 : 0.89;
      applyZoom(delta, ox, oy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom, containerRef]);

  // ── Touch & pointer events ───────────────────────────────────────────────
  const activePointers = useRef(new Map());

  const onPointerDown = useCallback((e) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 1) {
      // Single finger — start pan
      setTransform(prev => {
        drag.current = { startX: e.clientX, startY: e.clientY, startTx: prev.x, startTy: prev.y };
        return prev;
      });
    } else if (activePointers.current.size === 2) {
      // Two fingers — start pinch
      drag.current = null;
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      setTransform(prev => {
        pinch.current = { startDist: dist, startScale: prev.scale, pts };
        return prev;
      });
    }
  }, []);

  const onPointerMove = useCallback((e) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1 && drag.current) {
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      setTransform(prev => ({ ...prev, x: drag.current.startTx + dx, y: drag.current.startTy + dy }));
    } else if (activePointers.current.size === 2 && pinch.current) {
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const scaleFactor = dist / pinch.current.startDist;
      const newScale = clamp(pinch.current.startScale * scaleFactor, MIN_SCALE, MAX_SCALE);
      // pinch origin = midpoint between fingers
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const { pts: startPts, startScale } = pinch.current;
      const startMidX = (startPts[0].x + startPts[1].x) / 2;
      const startMidY = (startPts[0].y + startPts[1].y) / 2;
      setTransform(prev => {
        const ratio = newScale / startScale;
        return {
          scale: newScale,
          x: startMidX - ratio * (startMidX - (prev.x + (startMidX - startMidX))) + (midX - startMidX),
          y: startMidY - ratio * (startMidY - (prev.y + (startMidY - startMidY))) + (midY - startMidY),
        };
      });
    }
  }, []);

  const onPointerUp = useCallback((e) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinch.current = null;
    if (activePointers.current.size < 1) drag.current = null;
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  const zoomIn  = useCallback(() => applyZoom(1.25, 0, 0), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(0.80, 0, 0), [applyZoom]);

  return { transform, onPointerDown, onPointerMove, onPointerUp, resetTransform, zoomIn, zoomOut };
}

// ── Main component ───────────────────────────────────────────────────────────
export default function LibraryMap() {
  const [floor, setFloor] = useState("3rd Floor");
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [allSeats, setAllSeats] = useState(() => buildAllSeats());

  const containerRef = useRef(null);
  const { transform, onPointerDown, onPointerMove, onPointerUp, resetTransform, zoomIn, zoomOut } =
    usePanZoom(containerRef);

  // ── Handle seat click ────────────────────────────────────────────────────
  const handleSeatClick = useCallback((seatId) => {
    setAllSeats(prev => {
      const floorSeats = { ...prev[floor] };
      // Deselect previously selected seat on this floor
      if (selectedSeat && selectedSeat !== seatId) {
        if (floorSeats[selectedSeat] === STATUS.SELECTED) {
          floorSeats[selectedSeat] = STATUS.AVAILABLE;
        }
      }
      // Toggle current seat
      if (floorSeats[seatId] === STATUS.SELECTED) {
        floorSeats[seatId] = STATUS.AVAILABLE;
        setSelectedSeat(null);
      } else {
        floorSeats[seatId] = STATUS.SELECTED;
        setSelectedSeat(seatId);
      }
      return { ...prev, [floor]: floorSeats };
    });
  }, [floor, selectedSeat]);

  // ── Clear selection ──────────────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    if (!selectedSeat) return;
    setAllSeats(prev => {
      const floorSeats = { ...prev[floor] };
      if (floorSeats[selectedSeat] === STATUS.SELECTED) {
        floorSeats[selectedSeat] = STATUS.AVAILABLE;
      }
      return { ...prev, [floor]: floorSeats };
    });
    setSelectedSeat(null);
  }, [floor, selectedSeat]);

  // ── Switch floor ─────────────────────────────────────────────────────────
  const switchFloor = useCallback((name) => {
    clearSelection();
    setFloor(name);
    resetTransform();
  }, [clearSelection, resetTransform]);

  const seatState = allSeats[floor];

  // ── Count stats ──────────────────────────────────────────────────────────
  const stats = Object.values(seatState).reduce(
    (acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; },
    {}
  );
  const totalSeats = Object.keys(seatState).length;
  const available  = (stats[STATUS.AVAILABLE] || 0) + (stats[STATUS.SELECTED] || 0);
  const booked     = stats[STATUS.BOOKED] || 0;

  return (
    <main className="lm-page">
      {/* ── Header ── */}
      <div className="lm-header">
        <div className="lm-header-text">
          <p className="lm-tagline">RVCE LIBRARY</p>
          <h1 className="lm-title">Floor Map</h1>
        </div>
        <div className="lm-stats">
          <span className="stat-chip available">{available} available</span>
          <span className="stat-chip booked">{booked} booked</span>
          <span className="stat-chip total">{totalSeats} total</span>
        </div>
      </div>

      {/* ── Floor switcher ── */}
      <div className="lm-floor-switcher">
        {["3rd Floor", "4th Floor"].map((name) => (
          <button
            key={name}
            className={`lm-floor-btn ${floor === name ? "active" : ""}`}
            onClick={() => switchFloor(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="lm-legend">
        <span><span className="legend-dot av" />Available</span>
        <span><span className="legend-dot bk" />Booked</span>
        <span><span className="legend-dot sl" />Selected</span>
      </div>

      {/* ── Map area + SeatPanel side-by-side on desktop ── */}
      <div className="lm-content">
        {/* Map viewport */}
        <div className="lm-map-wrapper">
          {/* Zoom controls */}
          <div className="lm-zoom-controls">
            <button onClick={zoomIn}  aria-label="Zoom in"  title="Zoom in">＋</button>
            <button onClick={zoomOut} aria-label="Zoom out" title="Zoom out">－</button>
            <button onClick={resetTransform} aria-label="Reset view" title="Reset view">⌖</button>
          </div>

          {/* Pan/zoom container */}
          <div
            ref={containerRef}
            className="lm-map-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: "none" }}
          >
            <div
              className="lm-map-inner"
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: "0 0",
              }}
            >
              {floor === "3rd Floor"
                ? <FloorSVG3 seatState={seatState} onSeatClick={handleSeatClick} selectedSeat={selectedSeat} />
                : <FloorSVG4 seatState={seatState} onSeatClick={handleSeatClick} selectedSeat={selectedSeat} />
              }
            </div>
          </div>

          <p className="lm-hint">
            🖱️ Scroll to zoom · Drag to pan · Pinch on mobile
          </p>
        </div>

        {/* Seat info panel */}
        <div className="lm-panel-column">
          <SeatPanel
            selectedSeat={selectedSeat}
            floor={floor}
            seatState={seatState}
            onClear={clearSelection}
          />
          {!selectedSeat && (
            <div className="lm-no-selection">
              <span>👆</span>
              <p>Tap any <strong>green</strong> seat on the map to select it.</p>
            </div>
          )}
        </div>
      </div>

      <p className="lm-disclaimer">
        Sample data only — seat availability is not live and bookings are not persisted.
      </p>
    </main>
  );
}
