// Monitor3D.jsx
// A desktop computer monitor placed on the table in front of each chair.
// Used only on the 4th floor (computer lab).
//
// Props:
//   position  [x, y, z]   – world-space position (already offset from table centre)
//   rotationY             – Y-axis rotation so the screen faces the chair
//   isSelected            – highlight the screen when the seat is selected

export default function Monitor3D({ position, rotationY = 0, isSelected = false }) {
  const [x, y, z] = position;

  // Dimensions (metres)
  const screenW = 0.46;
  const screenH = 0.30;
  const screenD = 0.04;
  const bezelT  = 0.025;          // bezel thickness around screen
  const standH  = 0.20;
  const standW  = 0.06;
  const baseW   = 0.26;
  const baseD   = 0.18;
  const baseH   = 0.025;

  const screenColor = isSelected ? "#93c5fd" : "#111827";
  const emissiveCol = isSelected ? "#3b82f6" : "#1e3a5f";
  const emissiveInt = isSelected ? 0.7 : 0.15;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      {/* ── Base ── */}
      <mesh castShadow position={[0, baseH / 2, 0]}>
        <boxGeometry args={[baseW, baseH, baseD]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* ── Stand ── */}
      <mesh castShadow position={[0, baseH + standH / 2, 0]}>
        <boxGeometry args={[standW, standH, standW]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* ── Bezel (outer shell of the display head) ── */}
      <mesh castShadow position={[0, baseH + standH + (screenH + bezelT * 2) / 2, 0]}>
        <boxGeometry args={[screenW + bezelT * 2, screenH + bezelT * 2, screenD + bezelT]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* ── Screen panel ── */}
      <mesh position={[0, baseH + standH + (screenH + bezelT * 2) / 2, bezelT / 2]}>
        <boxGeometry args={[screenW, screenH, screenD]} />
        <meshStandardMaterial
          color={screenColor}
          emissive={emissiveCol}
          emissiveIntensity={emissiveInt}
          roughness={0.1}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
