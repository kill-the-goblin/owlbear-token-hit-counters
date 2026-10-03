import { mkdir, writeFile } from "node:fs/promises";
import palette from "../src/palette.json" with { type: "json" };

const output = new URL("../public/hit-grids/", import.meta.url);
await mkdir(output, { recursive: true });

for (const color of palette) {
  const folder = new URL(`${color.id}/`, output);
  await mkdir(folder, { recursive: true });
  for (let remaining = 0; remaining <= 10; remaining += 1) {
    const boxes = Array.from({ length: remaining }, (_, index) => {
      const x = 1 + (index % 5) * 20;
      const y = 1 + Math.floor(index / 5) * 20;
      return `<rect x="${x}" y="${y}" width="18" height="18" rx="2" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1"/>`;
    }).join("");
    const zero = remaining === 0
      ? `<text x="50" y="28" text-anchor="middle" font-family="sans-serif" font-size="25" font-weight="700" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1" paint-order="stroke">0</text>`
      : "";
    // The SVG rasterizes at 8x its logical size so large tokens stay sharp.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 100 40">${boxes}${zero}</svg>\n`;
    await writeFile(new URL(`${remaining}.svg`, folder), svg);
  }
}
