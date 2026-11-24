import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

// Canvas text gives the floor labels a self-contained font source, so they
// remain visible without a remote font request or a delayed scene render.
export default function MapLabel3D({ text, position, size, rotation = [-Math.PI / 2, 0, 0], color = "#1737b5", fontSize = 60 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = String(text).split("\n");
    const lineHeight = fontSize * 1.1;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, canvas.width / 2, startY + index * lineHeight, 492));
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [color, fontSize, text]);

  return (
    <mesh position={position} rotation={rotation} renderOrder={4}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
