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

function boxPosition(maximum, index) {
  if (maximum <= 5) return { x: 1 + (5 - maximum) * 10 + index * 20, y: 21 };
  const bottomCount = Math.ceil(maximum / 2);
  const topCount = maximum - bottomCount;
  const bottomRow = index < bottomCount;
  const rowCount = bottomRow ? bottomCount : topCount;
  const column = bottomRow ? index : index - bottomCount;
  return { x: 1 + (5 - rowCount) * 10 + column * 20, y: bottomRow ? 21 : 1 };
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
  await mkdir(folder, { recursive: true });
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

}

for (let maximum = 1; maximum <= 10; maximum += 1) {
  for (let remaining = 1; remaining <= maximum; remaining += 1) {
    const colorId = remaining * 5 > maximum * 4 ? "green" : remaining * 2 > maximum ? "yellow" : "red";
    const color = palette.find((entry) => entry.id === colorId);
    if (!color) throw new Error(`Missing grid color: ${colorId}`);
    const folder = new URL(`${colorId}/`, output);
    const boxes = Array.from({ length: maximum }, (_, index) => {
      const { x, y } = boxPosition(maximum, index);
      return index < remaining
        ? `<rect x="${x}" y="${y}" width="17" height="17" rx="2" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1"/>`
        : `<rect x="${x}" y="${y}" width="17" height="17" rx="2" fill="#000" fill-opacity="0.12" stroke="#fff" stroke-opacity="0.4" stroke-width="1"/>`;
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 100 40">${boxes}</svg>\n`;
    await writeFile(new URL(`${remaining}-${maximum}.svg`, folder), svg);
  }
}

const zeroOutline = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 100 40"><rect x="1" y="1" width="98" height="38" rx="3" fill="#000" fill-opacity="0.08" stroke="#fff" stroke-opacity="0.5" stroke-width="1"/></svg>\n`;
await writeFile(new URL("red/0.svg", output), zeroOutline);

for (const id of ["green", "yellow", "red"]) {
  const color = palette.find((entry) => entry.id === id);
  if (!color) throw new Error(`Missing player bar color: ${id}`);
  const barFolder = new URL(`${id}/`, barOutput);
  await mkdir(barFolder, { recursive: true });
  for (const [fraction, ratio] of barRatios) {
    const fillWidth = (98 * ratio).toFixed(3);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="152" viewBox="0 0 100 19"><defs><clipPath id="bar"><rect x="1" y="1" width="98" height="17" rx="2"/></clipPath></defs><rect x="1" y="1" width="98" height="17" rx="2" fill="${color.fill}" fill-opacity="0.12"/><rect x="1" y="1" width="${fillWidth}" height="17" fill="${color.fill}" clip-path="url(#bar)"/><rect x="1" y="1" width="98" height="17" rx="2" fill="none" stroke="${color.stroke}" stroke-width="1"/></svg>\n`;
    await writeFile(new URL(`${fraction}.svg`, barFolder), svg);
  }
}

const red = palette.find((entry) => entry.id === "red");
if (!red) throw new Error("Missing red player bar color");
const deadBar = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 100 40"><rect width="100" height="40" fill="#fff" fill-opacity="0.04"/><text x="50" y="28" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="800" letter-spacing="1" fill="${red.fill}" stroke="#000" stroke-width="1" paint-order="stroke">DEAD</text></svg>\n`;
await writeFile(new URL("red/dead-large.svg", barOutput), deadBar);
