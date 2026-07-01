import { createCanvasThumbnail } from "./db";

export function captureLiveThumbnail(
  root: HTMLElement | null,
  name: string,
  type: "excalidraw" | "tldraw",
  data: string | null
): string {
  const fallback = createCanvasThumbnail(name, type, data);
  if (!root) return fallback;

  try {
    const source = Array.from(root.querySelectorAll("canvas"))
      .filter((canvas) => canvas.width > 0 && canvas.height > 0)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!source) return fallback;

    const width = 480;
    const height = 270;
    const target = document.createElement("canvas");
    target.width = width;
    target.height = height;
    const ctx = target.getContext("2d");
    if (!ctx) return fallback;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const scale = Math.min(width / source.width, height / source.height);
    const drawWidth = source.width * scale;
    const drawHeight = source.height * scale;
    ctx.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    return target.toDataURL("image/png");
  } catch {
    return fallback;
  }
}
