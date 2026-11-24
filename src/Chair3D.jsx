// Chair3D.jsx
// One physical chair in the scene. Clickable. Changes color by seat state.

import { useRef, useState } from "react";
import { STATUS } from "./scene3DData";

const COLORS = {
  [STATUS.AVAILABLE]: "#2f8c57",
  [STATUS.BOOKED]:    "#e0b52f",
  [STATUS.OCCUPIED]: "#c74343",
  [STATUS.UNAVAILABLE]: "#94a3b8",
  [STATUS.SELECTED]:  "#24aeea",
  [STATUS.UNKNOWN]: "#1264e8",
};
const HOVER_LIGHTEN = "#f9d34a";

export default function Chair3D({ seatId, position, rotationY = 0, state, isSelected = false, onSelect }) {
  const meshRef  = useRef();
  const [hovered, setHovered] = useState(false);

  const isUnavailable = state === STATUS.BOOKED || state === STATUS.OCCUPIED || state === STATUS.UNAVAILABLE;
  const canSelect = true;
  const color    = isSelected ? COLORS[STATUS.SELECTED] : hovered && !isUnavailable ? HOVER_LIGHTEN : COLORS[state] ?? COLORS[STATUS.AVAILABLE];

  function handleClick(e) {
    e.stopPropagation();
    if (canSelect) onSelect(seatId);
  }

  // Chair geometry: seat plate + backrest
  const [cx, cy, cz] = position;

  return (
    <group
      position={[cx, cy, cz]}
      rotation={[0, rotationY, 0]}
      onPointerEnter={e => { e.stopPropagation(); if (canSelect) setHovered(true); document.body.style.cursor = canSelect ? "pointer" : "not-allowed"; }}
      onPointerLeave={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor = "auto"; }}
      onClick={handleClick}
    >
      {/* Seat plate */}
      <mesh ref={meshRef} castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[0.34, 0.06, 0.34]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Legs (4 thin boxes) */}
      {[
        [-0.13, 0, -0.13], [0.13, 0, -0.13],
        [-0.13, 0, 0.13], [0.13, 0, 0.13],
      ].map((lp, i) => (
        <mesh key={i} position={[lp[0], 0.1, lp[2]]} castShadow>
          <boxGeometry args={[0.035, 0.2, 0.035]} />
          <meshStandardMaterial color="#6b3c11" roughness={0.7} />
        </mesh>
      ))}

      {/* Backrest */}
      <mesh castShadow position={[0, 0.52, -0.19]}>
        <boxGeometry args={[0.32, 0.40, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Backrest top rail */}
      <mesh castShadow position={[0, 0.74, -0.19]}>
        <boxGeometry args={[0.32, 0.06, 0.06]} />
        <meshStandardMaterial color="#4a2007" roughness={0.5} />
      </mesh>

      {/* Selection ring (only when selected) */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.40, 24]} />
          <meshStandardMaterial color="#93c5fd" emissive="#3b82f6" emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}
