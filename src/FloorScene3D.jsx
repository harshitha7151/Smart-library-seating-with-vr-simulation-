// Builds the approved 3rd-floor plan from real floor, wall and furniture geometry.
import { Line } from "@react-three/drei";
import Table3D from "./Table3D";
import Bookshelf3D from "./Bookshelf3D";
import Plant3D from "./Plant3D";
import MapLabel3D from "./MapLabel3D";

const WALL_H = 0.62;
const WALL_T = 0.22;

function FloorTile({ x, y = 0, z, w, d, color }) {
  return (
    <group>
      <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallSegment({ x1, z1, x2, z2 }) {
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const len = Math.hypot(x2 - x1, z2 - z1) + WALL_T;
  const rot = Math.atan2(x2 - x1, z2 - z1);
  return (
    <mesh position={[cx, WALL_H / 2, cz]} rotation={[0, rot, 0]} castShadow receiveShadow>
      <boxGeometry args={[WALL_T, WALL_H, len]} />
      <meshStandardMaterial color="#191817" roughness={0.82} />
    </mesh>
  );
}

function Door({ door }) {
  const { x, z, width, rotation } = door;
  const arc = Array.from({ length: 13 }, (_, i) => { const a = (Math.PI / 2) * (i / 12); return [Math.sin(a) * width, 0.026, (1 - Math.cos(a)) * width]; });
  return (
    <group position={[x, 0.015, z]} rotation={[0, rotation, 0]}>
      <mesh position={[width / 2, 0.29, 0]} castShadow>
        <boxGeometry args={[width, 0.55, 0.055]} />
        <meshStandardMaterial color="#76502f" roughness={0.68} />
      </mesh>
      <mesh position={[width * 0.82, 0.3, 0.04]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#d4b477" metalness={0.55} roughness={0.3} />
      </mesh>
      <Line points={arc} color="#5a4631" lineWidth={1} />
    </group>
  );
}

function PatioFence({ segment }) {
  const { x1, z1, x2, z2 } = segment;
  const length = Math.hypot(x2 - x1, z2 - z1);
  // The rail's local length runs along +X, so rotate +X onto the segment's
  // world-space X/Z direction (Three.js Y rotation maps +X to [cos, -sin]).
  const rotation = Math.atan2(-(z2 - z1), x2 - x1);
  const count = Math.max(2, Math.floor(length / 0.42));
  return (
    <group position={[(x1 + x2) / 2, 0.08, (z1 + z2) / 2]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[length, 0.045, 0.035]} />
        <meshStandardMaterial color="#343331" metalness={0.25} roughness={0.7} />
      </mesh>
      {Array.from({ length: count + 1 }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (length * i) / count, 0, 0]} castShadow>
          <boxGeometry args={[0.035, 0.18, 0.035]} />
          <meshStandardMaterial color="#343331" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function EntranceSign({ pos, label }) {
  const [x, z] = pos;
  return (
    <group position={[x, 0.035, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 0.72]} />
        <meshBasicMaterial color="#ffe7e2" />
      </mesh>
      <MapLabel3D text={label} position={[0, 0.012, 0]} size={[1.7, 0.52]} color="#1536b4" fontSize={62} />
      <mesh position={[0, 0.01, 0.53]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 3]} />
        <meshBasicMaterial color="#e61e18" />
      </mesh>
    </group>
  );
}

function ReceptionCounter({ pos, size }) {
  const [x, z] = pos;
  const [w, d] = size;
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[w, 0.78, d]} />
        <meshStandardMaterial color="#d78a3d" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[w + 0.08, 0.08, d + 0.12]} />
        <meshStandardMaterial color="#f2b45f" roughness={0.62} />
      </mesh>
      <MapLabel3D text="Reception" position={[0, 0.92, 0]} size={[w * 0.82, d * 0.65]} color="#302117" fontSize={58} />
    </group>
  );
}

function Sofa({ pos, size }) {
  const [x, z] = pos;
  const [w, d] = size;
  const cushionD = d / 3.2;
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[w, 0.42, d]} />
        <meshStandardMaterial color="#9a56b2" roughness={0.76} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} castShadow position={[0, 0.52, i * cushionD]}>
          <boxGeometry args={[w * 0.83, 0.12, cushionD * 0.88]} />
          <meshStandardMaterial color="#c27bd0" roughness={0.7} />
        </mesh>
      ))}
      <mesh castShadow position={[-w * 0.43, 0.68, 0]}>
        <boxGeometry args={[0.18, 0.74, d]} />
        <meshStandardMaterial color="#8d48a7" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.68, -d * 0.43]}>
        <boxGeometry args={[w, 0.74, 0.18]} />
        <meshStandardMaterial color="#8d48a7" roughness={0.78} />
      </mesh>
    </group>
  );
}

export default function FloorScene3D({ floorData, seatState, selectedSeat, selectedTable, onSelect, onSelectTable }) {
  const { floorZones, wallSegments, doors, fences, roomLabels, shelves, plants, tables, entrance, furniture } = floorData;

  return (
    <group>
      {floorZones.map(({ id, ...zone }) => <FloorTile key={id} {...zone} />)}
      {wallSegments.map((segment, i) => <WallSegment key={i} {...segment} />)}
      {fences?.map((segment, i) => <PatioFence key={`fence-${i}`} segment={segment} />)}
      {doors?.map((door) => <Door key={door.id} door={door} />)}

      {roomLabels.map((room) => (
        <MapLabel3D key={room.id} text={room.label} position={[room.x, WALL_H + 0.045, room.z]} size={[2.2, 0.52]} color={room.color} fontSize={56} />
      ))}

      {shelves.map((shelf, i) => <Bookshelf3D key={i} position={[shelf.x, shelf.z]} size={[shelf.w, shelf.d]} />)}
      {plants.map((plant, i) => <Plant3D key={i} position={[plant.x, plant.z]} scale={plant.scale ?? 0.9} />)}
      {furniture?.reception && <ReceptionCounter {...furniture.reception} />}
      {furniture?.sofa && <Sofa {...furniture.sofa} />}
      {entrance && <EntranceSign pos={entrance.pos} label={entrance.label} />}

      {tables.map((table) => (
        <Table3D
          key={table.id}
          tableData={table}
          seatState={seatState}
          selectedSeat={selectedSeat}
          selectedTable={selectedTable}
          onSelect={onSelect}
          onSelectTable={onSelectTable}
        />
      ))}
    </group>
  );
}
