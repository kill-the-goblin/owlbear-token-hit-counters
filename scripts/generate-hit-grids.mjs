import { mkdir, writeFile } from "node:fs/promises";
import palette from "../src/palette.json" with { type: "json" };

const output = new URL("../public/hit-grids/", import.meta.url);
const barOutput = new URL("../public/player-bars/", import.meta.url);
const fillOrder = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4];
await mkdir(output, { recursive: true });
await mkdir(barOutput, { recursive: true });

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

const barRatios = new Map();
for (let maximum = 1; maximum <= 10; maximum += 1) {
  for (let remaining = 1; remaining <= maximum; remaining += 1) {
    const divisor = gcd(remaining, maximum);
    barRatios.set(`${remaining / divisor}-${maximum / divisor}`, remaining / maximum);
  }
}

for (const color of palette) {
  const folder = new URL(`${color.id}/`, output);
  const barFolder = new URL(`${color.id}/`, barOutput);
  await mkdir(folder, { recursive: true });
  await mkdir(barFolder, { recursive: true });
  for (let remaining = 0; remaining <= 10; remaining += 1) {
    const boxes = Array.from({ length: remaining }, (_, index) => {
      const cell = fillOrder[index];
      const x = 1 + (cell % 5) * 20;
      const y = 1 + Math.floor(cell / 5) * 20;
      return `<rect x="${x}" y="${y}" width="17" height="17" rx="2" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1"/>`;
    }).join("");
    const dead = remaining === 0
      ? `<rect width="100" height="40" fill="#fff" fill-opacity="0.04"/><text x="50" y="28" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="800" letter-spacing="1" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1" paint-order="stroke">DEAD</text>`
      : "";
    // The SVG rasterizes at 8x its logical size so large tokens stay sharp.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 100 40">${boxes}${dead}</svg>\n`;
    await writeFile(new URL(`${remaining === 0 ? "dead" : remaining}.svg`, folder), svg);
  }

  for (const [fraction, ratio] of barRatios) {
    const fillWidth = (98 * ratio).toFixed(3);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="136" viewBox="0 0 100 17"><defs><clipPath id="bar"><rect x="1" y="1" width="98" height="15" rx="2"/></clipPath></defs><rect x="1" y="1" width="98" height="15" rx="2" fill="${color.fill}" fill-opacity="0.12"/><rect x="1" y="1" width="${fillWidth}" height="15" fill="${color.fill}" clip-path="url(#bar)"/><rect x="1" y="1" width="98" height="15" rx="2" fill="none" stroke="${color.stroke}" stroke-width="1"/></svg>\n`;
    await writeFile(new URL(`${fraction}.svg`, barFolder), svg);
  }
  const deadBar = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="136" viewBox="0 0 100 17"><rect x="1" y="1" width="98" height="15" rx="2" fill="#fff" fill-opacity="0.04" stroke="${color.stroke}" stroke-width="1"/><text x="50" y="13" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="800" letter-spacing="1" fill="${color.fill}" stroke="${color.stroke}" stroke-width="0.5" paint-order="stroke">DEAD</text></svg>\n`;
  await writeFile(new URL("dead.svg", barFolder), deadBar);
}
