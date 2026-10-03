import { mkdir, writeFile } from "node:fs/promises";

const output = new URL("../public/hit-grids/", import.meta.url);
await mkdir(output, { recursive: true });

for (let remaining = 0; remaining <= 10; remaining += 1) {
  const boxes = Array.from({ length: remaining }, (_, index) => {
    const x = 2 + (index % 5) * 20;
    const y = 2 + Math.floor(index / 5) * 20;
    return `<rect x="${x}" y="${y}" width="16" height="16" rx="2" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>`;
  }).join("");
  const zero = remaining === 0
    ? '<text x="50" y="28" text-anchor="middle" font-family="sans-serif" font-size="25" font-weight="700" fill="#dc2626">0</text>'
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><rect width="100" height="40" fill="#fff" fill-opacity="0.001"/>${boxes}${zero}</svg>\n`;
  await writeFile(new URL(`${remaining}.svg`, output), svg);
}
