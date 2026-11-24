// FloorSVG4.jsx — 4th Floor SVG map
// SVG coordinate space: 900 × 520

import { STATUS } from "./floorData";

const C = {
  indoorFill:   "#fffbf0",
  outdoorFill:  "#d9ead3",
  wallStroke:   "#5a4a2a",
  bookshelf:    "#8B4513",
  gardenFill:   "#4a7c59",
  gardenLight:  "#6aaa78",
  tableFill:    "#c8a46e",
  tableStroke:  "#8B6914",
  available:    "#22c55e",
  booked:       "#ef4444",
  selected:     "#3b82f6",
  selectedGlow: "#93c5fd",
  glassFill:    "rgba(173,216,230,0.35)",
  glassStroke:  "#4a90c4",
};

function SeatCircle({ id, cx, cy, r, state, onClick }) {
  const fill = state === STATUS.SELECTED ? C.selected
              : state === STATUS.BOOKED   ? C.booked
              : C.available;
  const outlineW = state === STATUS.SELECTED ? 3 : 0;
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={fill}
      stroke={state === STATUS.SELECTED ? C.selectedGlow : "none"}
      strokeWidth={outlineW}
      style={{ cursor: state === STATUS.BOOKED ? "not-allowed" : "pointer" }}
      onClick={() => state !== STATUS.BOOKED && onClick(id)}
      aria-label={`Seat ${id} — ${state}`}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && state !== STATUS.BOOKED && onClick(id)}
    />
  );
}

function SeatsAround({ tableId, cx, cy, tw, th, seats, seatState, onSeatClick }) {
  const elements = [];
  const r = 9;
  const gap = 4;
  const topCount    = Math.ceil(seats / 4);
  const bottomCount = Math.ceil(seats / 4);
  const leftCount   = Math.floor(seats / 8);
  const rightCount  = seats - topCount - bottomCount - leftCount;
  let idx = 0;
  for (let i = 0; i < topCount && idx < seats; i++, idx++) {
    const sx = cx - tw / 2 + (tw / (topCount + 1)) * (i + 1);
    const sy = cy - th / 2 - gap - r;
    elements.push(<SeatCircle key={`${tableId}-S${idx+1}`} id={`${tableId}-S${idx+1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx+1}`]} onClick={onSeatClick} />);
  }
  for (let i = 0; i < bottomCount && idx < seats; i++, idx++) {
    const sx = cx - tw / 2 + (tw / (bottomCount + 1)) * (i + 1);
    const sy = cy + th / 2 + gap + r;
    elements.push(<SeatCircle key={`${tableId}-S${idx+1}`} id={`${tableId}-S${idx+1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx+1}`]} onClick={onSeatClick} />);
  }
  for (let i = 0; i < leftCount && idx < seats; i++, idx++) {
    const sx = cx - tw / 2 - gap - r;
    const sy = cy - th / 2 + (th / (leftCount + 1)) * (i + 1);
    elements.push(<SeatCircle key={`${tableId}-S${idx+1}`} id={`${tableId}-S${idx+1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx+1}`]} onClick={onSeatClick} />);
  }
  for (let i = 0; i < rightCount && idx < seats; i++, idx++) {
    const sx = cx + tw / 2 + gap + r;
    const sy = cy - th / 2 + (th / (rightCount + 1)) * (i + 1);
    elements.push(<SeatCircle key={`${tableId}-S${idx+1}`} id={`${tableId}-S${idx+1}`} cx={sx} cy={sy} r={r} state={seatState[`${tableId}-S${idx+1}`]} onClick={onSeatClick} />);
  }
  return <>{elements}</>;
}

function Bookshelf({ x, y, w, h }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.bookshelf} rx={3} />
      {Array.from({ length: Math.floor(w / 12) }).map((_, i) => (
        <line key={i} x1={x + 12 * i + 8} y1={y + 2} x2={x + 12 * i + 8} y2={y + h - 2} stroke="#5a2a00" strokeWidth={1} opacity={0.5} />
      ))}
    </g>
  );
}

function Plant({ cx, cy, r = 10 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.gardenFill} opacity={0.85} />
      <circle cx={cx - r*0.3} cy={cy - r*0.3} r={r*0.55} fill={C.gardenLight} opacity={0.7} />
    </g>
  );
}

function Table({ x, y, w, h, label }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={C.tableFill} stroke={C.tableStroke} strokeWidth={1.5} />
      <text x={x + w/2} y={y + h/2 + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#4a2c00">{label}</text>
    </g>
  );
}

export default function FloorSVG4({ seatState, onSeatClick, selectedSeat }) {
  const W = 900, H = 520;

  const small = { tw: 55, th: 30 };
  const big   = { tw: 120, th: 42 };

  // Big left cluster tables (4 long tables, 8 seats each)
  const bigLeftTables = [
    { id: "F4-BL1", cx: 235, cy: 118 },
    { id: "F4-BL2", cx: 235, cy: 210 },
    { id: "F4-BL3", cx: 235, cy: 302 },
    { id: "F4-BL4", cx: 235, cy: 394 },
  ];

  // Centre small tables T1–T4
  const centreTables = [
    { id: "F4-T1", cx: 450, cy: 150 },
    { id: "F4-T2", cx: 565, cy: 150 },
    { id: "F4-T3", cx: 450, cy: 260 },
    { id: "F4-T4", cx: 565, cy: 260 },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", display: "block" }}
      role="img"
      aria-label="4th Floor library map"
    >
      {/* Background */}
      <rect width={W} height={H} fill="#c8d8e8" />

      {/* ── Main indoor area (L-shaped) ── */}
      {/* Main body */}
      <rect x={135} y={40} width={625} height={450} fill={C.indoorFill} rx={4} />
      <rect x={135} y={40} width={625} height={450} fill="none" stroke={C.wallStroke} strokeWidth={4} rx={4} />

      {/* ── Office — top-left separate room ── */}
      <rect x={10}  y={40}  width={120} height={120} fill="#e8e0d0" stroke={C.wallStroke} strokeWidth={3} />
      <text x={70}  y={100} textAnchor="middle" fontSize={11} fill="#333" fontWeight="bold">Office</text>
      {/* Hatch to indicate stairs/passage */}
      <line x1={130} y1={40}  x2={135} y2={40}  stroke={C.wallStroke} strokeWidth={2} />
      <line x1={130} y1={160} x2={135} y2={160} stroke={C.wallStroke} strokeWidth={2} />
      {/* Staircase hatch marks */}
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1={130} y1={55 + i * 18} x2={135} y2={55 + i * 18} stroke="#888" strokeWidth={1} />
      ))}

      {/* ── Entrance ── */}
      <rect x={350} y={20} width={80} height={38} fill="#e0eaff" stroke={C.wallStroke} strokeWidth={2} rx={4} />
      <text x={390} y={44} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#285bd4">Entrance</text>
      <polygon points="375,58 390,50 405,58" fill="#285bd4" opacity={0.7} />

      {/* ── Workshop ── */}
      <rect x={295} y={370} width={200} height={80} fill="#e8dcc8" stroke={C.wallStroke} strokeWidth={3} rx={4} />
      <text x={395} y={415} textAnchor="middle" fontSize={12} fill="#4a2c00" fontWeight="bold">Workshop</text>

      {/* ── Librarian Glass Office (bottom-right) ── */}
      <rect x={660} y={320} width={170} height={140} fill={C.glassFill} stroke={C.glassStroke} strokeWidth={3} rx={6} strokeDasharray="6 3" />
      <text x={745} y={388} textAnchor="middle" fontSize={10} fill="#1a5276" fontWeight="bold">Librarian Office</text>
      <text x={745} y={402} textAnchor="middle" fontSize={9} fill="#1a5276">(Glass Room)</text>
      {/* Desk inside glass room */}
      <rect x={695} y={350} width={55} height={30} fill={C.tableFill} rx={4} />
      <circle cx={752} cy={365} r={8} fill="#3b82f6" opacity={0.6} />

      {/* ── Bookshelves along walls ── */}
      <Bookshelf x={140} y={42}  w={340} h={15} />
      <Bookshelf x={140} y={474} w={200} h={15} />
      <Bookshelf x={140} y={42}  w={15}  h={180} />

      {/* ── Floor label ── */}
      <text x={145} y={62} fontSize={13} fontWeight="bold" fill="#172033">4th Floor — RVCE Library</text>

      {/* ── Plants near entrance & glass room ── */}
      <Plant cx={500} cy={58} r={9} />
      <Plant cx={520} cy={58} r={9} />
      <Plant cx={660} cy={330} r={10} />
      <Plant cx={826} cy={330} r={10} />

      {/* ======================================================== */}
      {/* ── BIG LEFT TABLES ── */}
      {bigLeftTables.map(({ id, cx, cy }) => (
        <g key={id}>
          <Table x={cx - big.tw/2} y={cy - big.th/2} w={big.tw} h={big.th} label={id.replace("F4-","")} />
          <SeatsAround tableId={id} cx={cx} cy={cy} tw={big.tw} th={big.th} seats={8} seatState={seatState} onSeatClick={onSeatClick} />
        </g>
      ))}

      {/* ── CENTRE SMALL TABLES (T1–T4) ── */}
      {centreTables.map(({ id, cx, cy }) => (
        <g key={id}>
          <Table x={cx - small.tw/2} y={cy - small.th/2} w={small.tw} h={small.th} label={id.replace("F4-","")} />
          <SeatsAround tableId={id} cx={cx} cy={cy} tw={small.tw} th={small.th} seats={4} seatState={seatState} onSeatClick={onSeatClick} />
        </g>
      ))}
    </svg>
  );
}
