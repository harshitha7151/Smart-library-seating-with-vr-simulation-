import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { floor3 } from "../src/scene3DData.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Convert the approved React/Three.js floor model into the small JSON document
 * consumed by Unity. The JavaScript map remains the editable source of truth;
 * this file is a generated export and should not be hand-edited.
 */
export function createUnityLayout() {
  const layout = {
    zones: floor3.floorZones,
    walls: floor3.wallSegments,
    doors: floor3.doors,
    patioBoundaries: floor3.fences,
    roomLabels: floor3.roomLabels,
    shelves: floor3.shelves,
    plants: floor3.plants,
    entrance: floor3.entrance,
    furniture: floor3.furniture,
    cameraDefault: floor3.cameraDefault,
  };

  const tables = floor3.tables.map((table) => ({
    id: table.id,
    label: table.label,
    seatCount: table.seats,
    position: table.pos,
    dimensions: table.size,
    outdoor: table.outdoor,
    seats: table.chairPositions.map(([offsetX, offsetZ, rotation], index) => ({
      id: `${table.id}-S${index + 1}`,
      number: index + 1,
      position: {
        x: table.pos[0] + offsetX,
        z: table.pos[1] + offsetZ,
        rotation,
      },
    })),
  }));

  const seatIds = tables.flatMap((table) => table.seats.map((seat) => seat.id));
  if (new Set(seatIds).size !== seatIds.length) throw new Error("The Unity export contains duplicate seat IDs.");
  if (tables.some((table) => table.seats.length !== table.seatCount)) {
    throw new Error("A table's seat count does not match its chair layout.");
  }

  return {
    floorNumber: 3,
    label: floor3.label,
    unitsPerPixel: 1 / 50,
    coordinateNotes: "Coordinates use Three.js ground-plane x/z units. Positive z points down the approved top-down drawing.",
    layout,
    tables,
  };
}

export async function writeUnityLayout() {
  const output = path.join(projectRoot, "UnityVirtualLibrary", "Assets", "StreamingAssets", "seatspace-floor3.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(createUnityLayout(), null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const output = await writeUnityLayout();
  const data = createUnityLayout();
  const seatCount = data.tables.reduce((sum, table) => sum + table.seats.length, 0);
  console.log(`Exported third-floor layout: ${data.tables.length} tables, ${seatCount} stable seat IDs → ${output}`);
}
