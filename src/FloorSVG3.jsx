// FloorSVG3.jsx — 3rd Floor SVG map
// SVG coordinate space: 900 × 720
// All measurements are in SVG user-units (px equivalent at 1:1 scale).

import { STATUS } from "./floorData";

// ── Color palette ────────────────────────────────────────────────────────────
const C = {
  indoorFill:   "#fffbf0",
  outdoorFill:  "#d9ead3",
  wallStroke:   "#5a4a2a",
  wallFill:     "#8B7355",
  roofFill:     "#c8b89a",
  bookshelf:    "#8B4513",
  gardenFill:   "#4a7c59",
  gardenLight:  "#6aaa78",
  tableFill:    "#c8a46e",
  tableStroke:  "#8B6914",
  available:    "#22c55e",
  booked:       "#ef4444",
  selected:     "#3b82f6",
  selectedGlow: "#93c5fd",
  corridor:     "#f5f0e8",
};

// ── Utility: draw a rounded table rectangle ──────────────────────────────────
function Table({ x, y, w, h, label, seats, onClick, seatState, tableId, wide }) {
  const rx = 8;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={C.tableFill} stroke={C.tableStroke} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={wide ? 11 : 9} fontWeight="bold" fill="#4a2c00">
        {label}
      </text>
    </g>
  );
}

// ── Utility: draw individual seat circles around a table ─────────────────────
function SeatsAround({ tableId, cx, cy, tw, th, seats, seatState, onSeatClick }) {
  const elements = [];
  const r = 9; // seat circle radius
  const gap = 4; // gap between table edge and seat

  // Distribute seats: top, bottom, left, right rows
  const topCount    = Math.ceil(seats / 4);
  const bottomCount = Math.ceil(seats / 4);
  const leftCount   = Math.floor(seats / 8);
  const rightCount  = seats - topCount - bottomCount - leftCount;

  let idx = 0;

  // Top row
  for (let i = 0; i < topCount && idx < seats; i++, idx++) {
    const sx = cx - tw / 2 + (tw / (topCount + 1)) * (i + 1);
    const sy = cy - th / 2 - gap - r;
    elements.push(<SeatCircle key={`${tableId}-S${idx + 1}`} id={`${tableId}-S${idx + 1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx + 1}`]} onClick={onSeatClick} />);
  }
  // Bottom row
  for (let i = 0; i < bottomCount && idx < seats; i++, idx++) {
    const sx = cx - tw / 2 + (tw / (bottomCount + 1)) * (i + 1);
    const sy = cy + th / 2 + gap + r;
    elements.push(<SeatCircle key={`${tableId}-S${idx + 1}`} id={`${tableId}-S${idx + 1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx + 1}`]} onClick={onSeatClick} />);
  }
  // Left column
  for (let i = 0; i < leftCount && idx < seats; i++, idx++) {
    const sx = cx - tw / 2 - gap - r;
    const sy = cy - th / 2 + (th / (leftCount + 1)) * (i + 1);
    elements.push(<SeatCircle key={`${tableId}-S${idx + 1}`} id={`${tableId}-S${idx + 1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx + 1}`]} onClick={onSeatClick} />);
  }
  // Right column
  for (let i = 0; i < rightCount && idx < seats; i++, idx++) {
    const sx = cx + tw / 2 + gap + r;
    const sy = cy - th / 2 + (th / (rightCount + 1)) * (i + 1);
    elements.push(<SeatCircle key={`${tableId}-S${idx + 1}`} id={`${tableId}-S${idx + 1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx + 1}`]} onClick={onSeatClick} />);
  }

  return <>{elements}</>;
}

function SeatCircle({ id, cx, cy, r, state, onClick }) {
  const fill = state === STATUS.SELECTED ? C.selected
              : state === STATUS.BOOKED   ? C.booked
              : C.available;
  const outline = state === STATUS.SELECTED ? C.selectedGlow : "none";
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={fill}
      stroke={outline}
      strokeWidth={state === STATUS.SELECTED ? 3 : 0}
      style={{ cursor: state === STATUS.BOOKED ? "not-allowed" : "pointer" }}
      onClick={() => state !== STATUS.BOOKED && onClick(id)}
      aria-label={`Seat ${id} — ${state}`}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && state !== STATUS.BOOKED && onClick(id)}
    />
  );
}

// ── Bookshelf rectangle helper ───────────────────────────────────────────────
function Bookshelf({ x, y, w, h }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.bookshelf} rx={3} />
      {/* Wood-grain lines */}
      {Array.from({ length: Math.floor(w / 12) }).map((_, i) => (
        <line key={i} x1={x + 12 * i + 8} y1={y + 2} x2={x + 12 * i + 8} y2={y + h - 2} stroke="#5a2a00" strokeWidth={1} opacity={0.5} />
      ))}
    </g>
  );
}

// ── Plant/tree helper ────────────────────────────────────────────────────────
function Plant({ cx, cy, r = 10 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.gardenFill} opacity={0.85} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.55} fill={C.gardenLight} opacity={0.7} />
    </g>
  );
}

// ── Main FloorSVG3 component ─────────────────────────────────────────────────
export default function FloorSVG3({ seatState, onSeatClick, selectedSeat }) {
  const W = 900, H = 720;

  // Table geometry helpers: [centerX, centerY, tableW, tableH]
  // Small 4-seat table: 55×30, big 8-seat: 85×40, T6 big: 170×42

  const small = { tw: 55, th: 30 };
  const big   = { tw: 90, th: 42 };
  const t6    = { tw: 170, th: 42 };

  // Outdoor left tables (T1–T5) centred at x=62
  const outdoorLeft = [
    { id: "T1",  cx: 62,  cy: 140 },
    { id: "T2",  cx: 62,  cy: 205 },
    { id: "T3",  cx: 62,  cy: 270 },
    { id: "T4",  cx: 62,  cy: 335 },
    { id: "T5",  cx: 62,  cy: 400 },
  ];

  // Indoor cluster (T7–T11) — two columns
  const indoorCluster = [
    { id: "T7",  cx: 250, cy: 145 },
    { id: "T8",  cx: 250, cy: 225 },
    { id: "T9",  cx: 250, cy: 305 },
    { id: "T10", cx: 335, cy: 145 },
    { id: "T10b",cx: 335, cy: 225 },
    { id: "T11", cx: 335, cy: 305 },
  ];

  // T6 big table
  const t6Table = { id: "T6", cx: 252, cy: 415, tw: t6.tw, th: t6.th };

  // Right corridor tables (T12, T13, T15, T16, T24)
  const corridorTables = [
    { id: "T12", cx: 555, cy: 340 },
    { id: "T13", cx: 555, cy: 430 },
    { id: "T15", cx: 555, cy: 520 },
    { id: "T16", cx: 555, cy: 610 },
    { id: "T24", cx: 555, cy: 692 },
  ];

  // Outdoor garden right column (T17–T23)
  const gardenTables = [
    { id: "T17", cx: 760, cy: 95 },
    { id: "T18", cx: 760, cy: 185 },
    { id: "T19", cx: 760, cy: 275 },
    { id: "T20", cx: 760, cy: 365 },
    { id: "T21", cx: 760, cy: 455 },
    { id: "T22", cx: 760, cy: 545 },
    { id: "T23", cx: 760, cy: 635 },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", display: "block" }}
      role="img"
      aria-label="3rd Floor library map"
    >
      {/* ── Background ── */}
      <rect width={W} height={H} fill="#c8d8e8" />

      {/* ── Outdoor seating area (left) ── */}
      <rect x={10} y={60} width={110} height={420} fill="#d6d6d6" rx={6} opacity={0.9} />
      <text x={55} y={85} textAnchor="middle" fontSize={8} fill="#444" fontWeight="bold">Outdoor</text>
      <text x={55} y={97} textAnchor="middle" fontSize={8} fill="#444">Seating Area</text>
      {/* Shrubs along outdoor left edges */}
      {[75, 130, 190, 250, 310, 370, 430, 468].map((y, i) => (
        <Plant key={i} cx={18} cy={y} r={8} />
      ))}
      {[75, 130, 190, 250, 310, 370, 430, 468].map((y, i) => (
        <Plant key={i + 100} cx={110} cy={y} r={8} />
      ))}

      {/* ── Main indoor area (centre-left block) ── */}
      <rect x={125} y={60} width={400} height={530} fill={C.indoorFill} rx={4} />
      {/* Indoor wall border */}
      <rect x={125} y={60} width={400} height={530} fill="none" stroke={C.wallStroke} strokeWidth={4} rx={4} />

      {/* ── Office (top-centre-right of main block) ── */}
      <rect x={378} y={65} width={145} height={130} fill="#e8e0d0" stroke={C.wallStroke} strokeWidth={3} />
      <text x={450} y={135} textAnchor="middle" fontSize={11} fill="#333" fontWeight="bold">Office</text>
      {/* Door arc for office */}
      <path d="M378 175 Q368 165 378 155" stroke={C.wallStroke} strokeWidth={2} fill="none" />

      {/* ── Washrooms ── */}
      <rect x={378} y={198} width={145} height={80} fill="#dce8f5" stroke={C.wallStroke} strokeWidth={3} />
      <text x={450} y={242} textAnchor="middle" fontSize={10} fill="#333" fontWeight="bold">Washrooms</text>
      <text x={435} y={258} textAnchor="middle" fontSize={14}>🚻</text>

      {/* ── Reception ── */}
      <rect x={390} y={295} width={130} height={55} fill="#f5e6c8" stroke={C.wallStroke} strokeWidth={2} rx={4} />
      <text x={455} y={327} textAnchor="middle" fontSize={10} fill="#4a2c00" fontWeight="bold">Reception</text>

      {/* ── Bookshelves inside main room ── */}
      <Bookshelf x={130} y={65}  w={240} h={18} />
      <Bookshelf x={130} y={440} w={240} h={14} />

      {/* ── Right corridor (T12–T24 area) ── */}
      <rect x={490} y={295} width={155} height={420} fill={C.corridor} stroke={C.wallStroke} strokeWidth={3} rx={4} />
      {/* Bookshelf along corridor east wall */}
      <Bookshelf x={628} y={300} w={14} h={410} />

      {/* ── Outdoor garden (right) ── */}
      <rect x={648} y={25} width={240} height={680} fill={C.outdoorFill} rx={6} />
      {/* Plant border */}
      {Array.from({ length: 16 }).map((_, i) => (
        <Plant key={i + 200} cx={658} cy={40 + i * 43} r={9} />
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <Plant key={i + 300} cx={878} cy={40 + i * 43} r={9} />
      ))}
      <text x={768} y={710} textAnchor="middle" fontSize={10} fill="#2d6a4f" fontWeight="bold">Garden / Outdoor Area</text>

      {/* ── Entrance ── */}
      <rect x={415} y={25} width={80} height={40} fill="#e0eaff" stroke={C.wallStroke} strokeWidth={2} rx={4} />
      <text x={455} y={50} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#285bd4">Entrance</text>
      {/* Door chevron */}
      <polygon points="440,63 455,55 470,63" fill="#285bd4" opacity={0.7} />

      {/* ── Floor label ── */}
      <rect x={130} y={68} width={110} height={28} fill="none" />
      <text x={135} y={82} fontSize={13} fontWeight="bold" fill="#172033">3rd Floor — RVCE Library</text>

      {/* ======================================================== */}
      {/* ── OUTDOOR LEFT TABLES (T1–T5) ── */}
      {outdoorLeft.map(({ id, cx, cy }) => (
        <g key={id}>
          <Table x={cx - small.tw / 2} y={cy - small.th / 2} w={small.tw} h={small.th} label={id} seats={4} />
          <SeatsAround tableId={id} cx={cx} cy={cy} tw={small.tw} th={small.th} seats={4} seatState={seatState} onSeatClick={onSeatClick} />
        </g>
      ))}

      {/* ── INDOOR CLUSTER (T7–T11) ── */}
      {indoorCluster.map(({ id, cx, cy }) => (
        <g key={id}>
          <Table x={cx - small.tw / 2} y={cy - small.th / 2} w={small.tw} h={small.th} label={id === "T10b" ? "T10" : id} seats={4} />
          <SeatsAround tableId={id} cx={cx} cy={cy} tw={small.tw} th={small.th} seats={4} seatState={seatState} onSeatClick={onSeatClick} />
        </g>
      ))}

      {/* ── T6 BIG TABLE (14 seats) ── */}
      <g>
        <Table x={t6Table.cx - t6Table.tw / 2} y={t6Table.cy - t6Table.th / 2} w={t6Table.tw} h={t6Table.th} label="T6 (14)" seats={14} wide />
        <SeatsAround tableId="T6" cx={t6Table.cx} cy={t6Table.cy} tw={t6Table.tw} th={t6Table.th} seats={14} seatState={seatState} onSeatClick={onSeatClick} />
      </g>

      {/* ── RIGHT CORRIDOR TABLES (T12, T13, T15, T16, T24) ── */}
      {corridorTables.map(({ id, cx, cy }) => (
        <g key={id}>
          <Table x={cx - big.tw / 2} y={cy - big.th / 2} w={big.tw} h={big.th} label={id} seats={8} />
          <SeatsAround tableId={id} cx={cx} cy={cy} tw={big.tw} th={big.th} seats={8} seatState={seatState} onSeatClick={onSeatClick} />
        </g>
      ))}

      {/* ── GARDEN RIGHT TABLES (T17–T23) ── */}
      {gardenTables.map(({ id, cx, cy }) => (
        <g key={id}>
          <Table x={cx - big.tw / 2} y={cy - big.th / 2} w={big.tw} h={big.th} label={id} seats={8} />
          <SeatsAround tableId={id} cx={cx} cy={cy} tw={big.tw} th={big.th} seats={8} seatState={seatState} onSeatClick={onSeatClick} />
        </g>
      ))}

      {/* ── Selected seat highlight ring (rendered last = on top) ── */}
      {selectedSeat && (() => {
        // Find the seat circle among all tables and highlight with a pulsing ring
        // (the SeatCircle already draws the selected style; this is a screen-reader aid)
        return null;
      })()}
    </svg>
  );
}
