// Bookshelf3D.jsx
// A single bookshelf unit with book-spine details.

export default function Bookshelf3D({ position, size }) {
  const [x, z] = position;
  const [w, d] = size;
  const shelfH = 2.1;
  const shelfColor = "#5c2b12";
  const colors = ["#a94b17", "#d2762d", "#ed9a4a", "#bf5b1e", "#e28a3b"];

  const numShelves = 4;
  const numBooks   = Math.floor(w / 0.15);

  return (
    <group position={[x, 0, z]}>
      {/* Carcass */}
      <mesh castShadow receiveShadow position={[0, shelfH / 2, 0]}>
        <boxGeometry args={[w, shelfH, d]} />
        <meshStandardMaterial color={shelfColor} roughness={0.7} />
      </mesh>

      {/* Book spines on each shelf */}
      {Array.from({ length: numShelves }, (_, si) => {
        const shelfY = 0.35 + si * 0.52;
        return Array.from({ length: numBooks }, (_, bi) => {
          const bx = -w / 2 + 0.08 + bi * 0.14;
          const bh = 0.32 + ((bi + si) % 3) * 0.035;
          return (
            <mesh key={`${si}-${bi}`} castShadow position={[bx, shelfY + bh / 2, 0]}>
              <boxGeometry args={[0.09, bh, d * 0.65]} />
              <meshStandardMaterial color={colors[(si * numBooks + bi) % colors.length]} roughness={0.8} />
            </mesh>
          );
        });
      })}
    </group>
  );
}
