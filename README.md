# Token Hit Counters

Hit counters for character tokens in Owlbear Rodeo. The GM selects a token and uses **Counters: [remaining] / [maximum]** to edit its current and maximum hits. Setting the maximum to **1–10** refills the counter. Enter **0** or clear the maximum field to remove it.

The GM sees boxes in fixed cells of a transparent two-row, five-column grid just above the token. Unused positions are hidden. Hits are spent from the top row, right to left, then the bottom row. The H tool treats the entire grid rectangle as one click target, including empty cells and a depleted counter. At zero, `DEAD` appears across the grid; Shift-click the grid to restore a hit.

Players see a single continuous bar at the same width and offset, with the height of one box row. Its fill shows the percentage of hits remaining, without counts or numbers. Both GM boxes and player bars are green above 80%, yellow above 50% through 80%, and red at 50% or below. For example, a five-counter token shows green at 5, yellow at 4–3, and red at 2–1. At zero, players see red `DEAD` at the same size as the GM marker, with a 1 px black outline. The display follows the token while it is dragged, stays the same on-screen size through zoom, and resizes with the token. A normal one-cell token uses a 100 px-wide display.

At zero offset, the grid's bottom edge meets the token's top edge. Use **Offset (Y) [value] px** to move it up (negative) or down (positive) by a fixed screen distance. The offset belongs to each token and remains when its hit count changes.

The GM presses **H** to activate Token Hit Counters mode. Click the grid to spend one hit, or Shift-click to restore one. The count stays between zero and its configured maximum. Players cannot edit hits through the extension.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies SDK types. Test the GM grid and player bar with separate clients: percentage fill, zero-hit `DEAD`, color, positioning, zoom, resizing, and hidden tokens.
