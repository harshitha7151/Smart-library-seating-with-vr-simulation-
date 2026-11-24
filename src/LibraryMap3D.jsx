import { useState, useCallback, Suspense, useRef, useEffect, useMemo } from "react";
import { Canvas }        from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import FloorScene3D      from "./FloorScene3D";
import SeatPanel3D       from "./SeatPanel3D";
import { floor3, buildSeatState, STATUS } from "./scene3DData";
import { apiRequest } from "./api";
import "./LibraryMap3D.css";

function CameraFit({ view, cameraPosition, target, controlsRef }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const fitted = useRef(false);

  useEffect(() => {

    camera.position.set(...cameraPosition);
    camera.up.set(...(view === "top" ? [0, 0, -1] : [0, 1, 0]));
    camera.lookAt(...target);
    if (camera.isOrthographicCamera) {
      // Fit the full patio-to-garden span with a small margin. Using both
      // viewport dimensions keeps the plan readable in narrow phone screens.
      camera.zoom = Math.min(size.width / 28.5, size.height / 18.5) * 0.92;
      camera.updateProjectionMatrix();
    }
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...target);
      controls.update();
      // OrbitControls owns the final camera quaternion, so re-apply the
      // top-down roll after its first update as well.
      if (view === "top") {
        camera.up.set(0, 0, -1);
        camera.lookAt(...target);
        camera.updateProjectionMatrix();
      }
    }
  }, [camera, cameraPosition, controlsRef, size.height, size.width, target, view]);

  useEffect(() => { fitted.current = false; }, [camera, size.height, size.width, view]);

  useFrame(() => {
    if (fitted.current) return;
    camera.position.set(...cameraPosition);
    camera.up.set(...(view === "top" ? [0, 0, -1] : [0, 1, 0]));
    camera.lookAt(...target);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...target);
      controls.update();
      camera.position.set(...cameraPosition);
      camera.up.set(...(view === "top" ? [0, 0, -1] : [0, 1, 0]));
      camera.lookAt(...target);
    }
    if (camera.isOrthographicCamera) {
      camera.zoom = Math.min(size.width / 28.5, size.height / 18.5) * 0.92;
      camera.updateProjectionMatrix();
    }
    fitted.current = true;
  });

  return null;
}

export default function LibraryMap3D({ isAuthenticated = false, onRequireLogin, initialSelectedSeat, onClearPendingSeat, onOpenBookings }) {
  const [floorData, setFloorData] = useState(floor3);
  const floor = floorData.label;
  const [seatState, setSeatState] = useState(() => buildSeatState(floor3.tables, {}, STATUS.UNKNOWN));
  const [selectedSeat,setSelectedSeat]= useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [layoutError, setLayoutError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [view,        setView]        = useState("3d");
  const orbitRef = useRef();
  const availabilityRequest = useRef(0);
  const availabilityRange = useRef({ startAt: null, endAt: null });
  const selectedSeatRef = useRef(null);
  const camPreset   = floorData.cameraDefault;

  // Mount the perspective camera first, then switch to the orthographic map
  // after R3F has installed the scene camera. This avoids a blank first frame
  // when the top camera is the initial default.
  useEffect(() => { setView("top"); }, []);

  useEffect(() => {
    let active = true;
    apiRequest("/api/floors/3/layout")
      .then(({ label, layout, tables }) => {
        if (!active) return;
        const apiTables = tables.map((table) => ({
          id: table.id,
          label: table.label,
          seats: table.seatCount,
          pos: table.position,
          size: table.dimensions,
          outdoor: table.outdoor,
          chairPositions: table.seats.map(({ position }) => [
            position.x - table.position[0],
            position.z - table.position[1],
            position.rotation,
          ]),
        }));
        setFloorData({
          id: "floor-3",
          label,
          floorZones: layout.zones,
          wallSegments: layout.walls,
          doors: layout.doors,
          fences: layout.patioBoundaries,
          roomLabels: layout.roomLabels,
          shelves: layout.shelves,
          plants: layout.plants,
          entrance: layout.entrance,
          furniture: layout.furniture,
          cameraDefault: layout.cameraDefault,
          tables: apiTables,
        });
        setSeatState(buildSeatState(apiTables, {}, STATUS.UNKNOWN));
        setLayoutError("");
      })
      .catch((error) => {
        if (active) setLayoutError(error.message);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!initialSelectedSeat || seatState[initialSelectedSeat] !== STATUS.AVAILABLE) return;
    selectedSeatRef.current = initialSelectedSeat;
    setSelectedTable(null);
    setSelectedSeat(initialSelectedSeat);
    onClearPendingSeat?.();
  }, [initialSelectedSeat, onClearPendingSeat, seatState]);

  const refreshAvailability = useCallback(async (startAt, endAt) => {
    if (startAt && endAt) availabilityRange.current = { startAt, endAt };
    const requestId = ++availabilityRequest.current;
    const query = startAt && endAt
      ? `?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`
      : "";
    try {
      const { seats } = await apiRequest(`/api/floors/3/availability${query}`);
      if (requestId !== availabilityRequest.current) return;
      const statuses = Object.fromEntries(seats.map(({ seatId, status }) => [seatId, status]));
      const nextState = buildSeatState(floorData.tables, statuses);
      setSeatState(nextState);
      setAvailabilityError("");
    } catch (error) {
      if (requestId !== availabilityRequest.current) return;
      setSeatState(buildSeatState(floorData.tables, {}, STATUS.UNKNOWN));
      setAvailabilityError(`${error.message} Seat availability is hidden until the API is available.`);
    }
  }, [floorData.tables]);

  useEffect(() => {
    const refresh = () => {
      const { startAt, endAt } = availabilityRange.current;
      refreshAvailability(startAt, endAt);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      availabilityRequest.current += 1;
    };
  }, [refreshAvailability]);

  // ── Select a seat ─────────────────────────────────────────────────────────
  const handleSelect = useCallback((seatId) => {
    if (!Object.hasOwn(seatState, seatId)) return;
    const next = selectedSeat === seatId ? null : seatId;
    selectedSeatRef.current = next;
    setSelectedTable(null);
    setSelectedSeat(next);
  }, [selectedSeat, seatState]);

  const handleSelectTable = useCallback((tableId) => {
    const table = floorData.tables.find((item) => item.id === tableId);
    if (!table) return;
    selectedSeatRef.current = null;
    setSelectedSeat(null);
    setSelectedTable(table);
  }, [floorData.tables]);

  // ── Clear selection ───────────────────────────────────────────────────────
  const clearSelection = useCallback(() => {
    selectedSeatRef.current = null;
    setSelectedSeat(null);
    setSelectedTable(null);
  }, []);

  const handleBook = useCallback(async (seatId, startAt, endAt) => {
    setBookingError("");
    setBookingSuccess("");
    if (!isAuthenticated) {
      onRequireLogin?.(seatId);
      return;
    }
    try {
      const result = await apiRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ seatId, startAt, endAt }),
      });
      selectedSeatRef.current = null;
      setSelectedSeat(null);
      setSelectedTable(null);
      setBookingSuccess(`Booking ${result.booking.id} confirmed for ${seatId}.`);
      // Immediately re-fetch availability so the stats bar (available / booked /
      // checked-in counts) updates right after the booking is confirmed rather
      // than waiting up to 30 seconds for the next auto-refresh.
      const { startAt: rangeStart, endAt: rangeEnd } = availabilityRange.current;
      refreshAvailability(rangeStart, rangeEnd);
    } catch (error) {
      setBookingError(error.message);
    }
  }, [isAuthenticated, onRequireLogin, refreshAvailability]);

  // ── Seat stats ────────────────────────────────────────────────────────────
  const vals = Object.values(seatState);
  const stats = {
    total:     vals.length,
    available: vals.filter(s => s === STATUS.AVAILABLE || s === STATUS.SELECTED).length,
    booked:    vals.filter(s => s === STATUS.BOOKED).length,
    occupied:  vals.filter(s => s === STATUS.OCCUPIED).length,
  };

  // ── Camera config for current view mode ─────────────────────────────────
  const target3D   = camPreset.target ?? [0, 0, 0];
  const cameraPos = useMemo(() => view === "top"
    ? [target3D[0], 120, target3D[2]]
    : camPreset.position, [camPreset.position, target3D, view]);
  const enableRotate = view === "3d";

  useEffect(() => {
    const controls = orbitRef.current;
    if (!controls) return;

    controls.object.position.set(...cameraPos);
    controls.target.set(...target3D);
    controls.update();
  }, [view, cameraPos, target3D]);

  // ── Reset camera to default position ─────────────────────────────────────
  function resetCamera() {
    if (!orbitRef.current) return;
    const ctrl = orbitRef.current;
    const newPos = view === "top"
      ? [target3D[0], 120, target3D[2]]
      : camPreset.position;

    ctrl.object.position.set(...newPos);
    ctrl.target.set(...target3D);
    ctrl.update();
  }

  return (
    <div className="lm3d-page">
      {/* ── Top bar ── */}
      <div className="lm3d-topbar">
        <div className="lm3d-title-group">
          <span className="lm3d-tagline">RVCE LIBRARY · 3RD FLOOR</span>
          <h1 className="lm3d-title">SeatSpace</h1>
        </div>
        <div className="lm3d-controls">
          {/* View toggle */}
          <div className="lm3d-view-btns">
            <button
              className={`lm3d-btn sm ${view === "3d" ? "active" : ""}`}
              onClick={() => setView("3d")}
              title="3D isometric view"
            >⬡ 3D</button>
            <button
              className={`lm3d-btn sm ${view === "top" ? "active" : ""}`}
              onClick={() => setView("top")}
              title="Top-down view"
            >⊞ Top</button>
            <button
              className="lm3d-btn sm"
              onClick={resetCamera}
              title="Reset camera to default position"
            >⌖ Reset</button>
          </div>
        </div>
        {/* Stats bar */}
        <div className="lm3d-stats">
          <span className="chip avail">{stats.available} available</span>
          <span className="chip booked">{stats.booked} booked</span>
          <span className="chip occupied">{stats.occupied} checked in</span>
          <span className="chip total">{stats.total} total</span>
        </div>
      </div>

      {/* ── Scene + Panel ── */}
      <div className="lm3d-body">
        {/* 3D Canvas */}
        <div className="lm3d-canvas-wrap">
          <Canvas
            shadows={view === "3d"}
            camera={{ position: cameraPos, fov: 42, near: 0.1, far: 400 }}
            gl={{ antialias: true, alpha: false }}
          >
            {view === "top"
              ? <OrthographicCamera makeDefault position={cameraPos} near={0.1} far={400} zoom={1} />
              : <PerspectiveCamera makeDefault position={cameraPos} fov={42} near={0.1} far={400} />}
            <CameraFit view={view} cameraPosition={cameraPos} target={target3D} controlsRef={orbitRef} />
            <color attach="background" args={["#e6f7fc"]} />
            {/* Lighting */}
            <ambientLight intensity={0.55} />
            <directionalLight
              position={[15, 25, 15]}
              intensity={1.1}
              castShadow={view === "3d"}
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-30}
              shadow-camera-right={30}
              shadow-camera-top={30}
              shadow-camera-bottom={-30}
            />
            <directionalLight position={[-10, 15, -10]} intensity={0.3} />

            <Suspense fallback={null}>
              {/* The floor scene */}
              <FloorScene3D
                floorData={floorData}
                seatState={seatState}
                selectedSeat={selectedSeat}
                selectedTable={selectedTable?.id}
                onSelect={handleSelect}
                onSelectTable={handleSelectTable}
              />
            </Suspense>

            {/* Camera controls */}
            <OrbitControls
              ref={orbitRef}
              enableDamping
              dampingFactor={0.08}
              enableRotate={enableRotate}
              enablePan
              enableZoom
              minDistance={view === "top" ? 12 : 5}
              maxDistance={view === "top" ? 150 : 70}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2.1}
              target={target3D}
            />
          </Canvas>

          {/* Legend overlay */}
        <div className="lm3d-legend">
            {availabilityError
              ? <span><i className="ldot unknown" />Seats shown · status not loaded</span>
              : <><span><i className="ldot av" />Available</span><span><i className="ldot bk" />Booked</span><span><i className="ldot oc" />Checked in</span><span><i className="ldot un" />Unavailable</span><span><i className="ldot sl" />Selected</span><span><i className="ldot hv" />Hover</span></>}
          </div>

          {/* Controls hint */}
          <div className="lm3d-hint">
            🖱 Drag · Scroll zoom · Right-drag pan · Pinch on mobile
          </div>
        </div>

        {/* Seat info panel */}
        <div className="lm3d-panel-col">
          {selectedTable ? (
            <div className="sp3d" role="region" aria-label="Selected table details">
              <div className="sp3d-header">
                <span className="sp3d-badge">TABLE SELECTED</span>
                <button className="sp3d-close" onClick={clearSelection} aria-label="Clear table selection">×</button>
              </div>
              <h2>{selectedTable.id}</h2>
              <p>{selectedTable.seats} individual seats · click a seat ID to inspect its live status.</p>
              <div className="sp3d-table-seats">
                {selectedTable.chairPositions.map((_, index) => {
                  const seatId = `${selectedTable.id}-S${index + 1}`;
                  const status = seatState[seatId] ?? STATUS.UNKNOWN;
                  return <button key={seatId} className={`sp3d-table-seat st-${status}`} onClick={() => handleSelect(seatId)}>{seatId} · {status}</button>;
                })}
              </div>
            </div>
          ) : <SeatPanel3D
            selectedSeat={selectedSeat}
            floor={floor}
            seatState={seatState}
            onClear={clearSelection}
            onBook={handleBook}
            onAvailabilityRangeChange={refreshAvailability}
            isAuthenticated={isAuthenticated}
            bookingError={bookingError}
            bookingSuccess={bookingSuccess}
            availabilityWarning={availabilityError}
            onOpenBookings={onOpenBookings}
          />}
          {!selectedSeat && !selectedTable && (
            <div className="lm3d-no-sel">
              <span>🪑</span>
              <p>{availabilityError || layoutError || "Tap an available blue chair to view its seat details."}</p>
              <p style={{fontSize:"12px",color:"#94a3b8",marginTop:"8px"}}>{layoutError ? "Showing the locally cached third-floor drawing." : "Layout and availability are read from the SeatSpace API."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
