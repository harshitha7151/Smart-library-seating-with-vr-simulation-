// Table3D.jsx
// One 3D table with all its chairs (and optional computer monitors on 4th floor).

import Chair3D   from "./Chair3D";
import MapLabel3D from "./MapLabel3D";
import { STATUS } from "./scene3DData";

export default function Table3D({ tableData, seatState, selectedSeat, selectedTable, onSelect, onSelectTable }) {
  const { id, label, pos, size, chairPositions, outdoor } = tableData;
  const [tx, tz] = pos;
  const [tw, td] = size;   // half-width, half-depth

  // Table top color
  const tableColor  = outdoor ? "#efa23d" : "#f0a13a";
  const legColor    = "#6b3c11";

  // Table height
  const tableH      = 0.76;   // top surface Y
  const tableThick  = 0.06;
  const legH        = tableH - tableThick / 2;

  return (
    <group
      position={[tx, 0, tz]}
      onClick={(event) => { event.stopPropagation(); onSelectTable?.(id); }}
      onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
      onPointerLeave={() => { document.body.style.cursor = "auto"; }}
    >
      {/* Table top */}
        <mesh
          castShadow
          receiveShadow
          position={[0, tableH, 0]}
        >
        <boxGeometry args={[tw * 2, tableThick, td * 2]} />
          <meshStandardMaterial color={selectedTable === id ? "#ffd07a" : tableColor} roughness={0.5} metalness={0.05} />
      </mesh>

      {/* 4 table legs */}
      {[
        [-tw + 0.12,  td - 0.12],
        [ tw - 0.12,  td - 0.12],
        [-tw + 0.12, -td + 0.12],
        [ tw - 0.12, -td + 0.12],
      ].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, legH / 2, lz]}>
          <boxGeometry args={[0.08, legH, 0.08]} />
          <meshStandardMaterial color={legColor} roughness={0.6} />
        </mesh>
      ))}

      {/* Table label */}
      <MapLabel3D text={label} position={[0, tableH + 0.26, 0]} size={[tw * 1.72, td * 1.55]} color="#172033" fontSize={55} />

      {/* Chairs (and optional monitors) */}
      {chairPositions.map(([cx, cz, rotationY = 0], idx) => {
        const seatId = `${id}-S${idx + 1}`;
        const st = seatState[seatId] ?? STATUS.AVAILABLE;
        return (
          <group key={seatId}>
            <Chair3D
              seatId={seatId}
              position={[cx, 0, cz]}
              rotationY={rotationY}
              state={st}
              isSelected={selectedSeat === seatId}
              onSelect={onSelect}
            />
          </group>
        );
      })}
    </group>
  );
}
