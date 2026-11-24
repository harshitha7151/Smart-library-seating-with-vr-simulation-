// Low-poly 3D planting that reads as a leafy star from the approved top view.
export default function Plant3D({ position, scale = 1 }) {
  const [x, z] = position;

  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.25 * scale, 0]}>
        <cylinderGeometry args={[0.07 * scale, 0.11 * scale, 0.5 * scale, 8]} />
        <meshStandardMaterial color="#68401f" roughness={0.9} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        const radius = 0.2 * scale;
        const green = index % 3 === 0 ? "#8acb28" : index % 3 === 1 ? "#4b9b19" : "#63b91f";
        return (
          <mesh
            key={index}
            castShadow
            scale={[0.15 * scale, 0.12 * scale, 0.4 * scale]}
            position={[Math.sin(angle) * radius, 0.72 * scale, Math.cos(angle) * radius]}
            rotation={[0.16, angle, -0.12]}
          >
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={green} roughness={0.76} />
          </mesh>
        );
      })}
      <mesh castShadow position={[0, 0.78 * scale, 0]}>
        <dodecahedronGeometry args={[0.22 * scale, 0]} />
        <meshStandardMaterial color="#a3d934" roughness={0.8} />
      </mesh>
    </group>
  );
}
