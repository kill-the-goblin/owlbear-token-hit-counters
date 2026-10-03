# Token Hit Counters

Hit counters for character tokens in Owlbear Rodeo. The GM selects a token and enters **1–10** in the **Boxes** field to set its maximum and refill it. Enter **0** or clear the field to remove the counter.

The GM sees boxes in fixed cells of a transparent two-row, five-column grid just above the token. Unused positions are hidden. Hits are spent from the top row, right to left, then the bottom row. The H tool treats the entire grid rectangle as one click target, including empty cells and a depleted counter. At zero, `DEAD` appears across the grid; Shift-click the grid to restore a hit.

Players see a single continuous bar at the same width and offset, with the height of one box row. Its fill shows the percentage of hits remaining, without counts or numbers. At zero, players see `DEAD`. The GM's chosen color applies to both displays. The display follows the token while it is dragged, stays the same on-screen size through zoom, and resizes with the token. A normal one-cell token uses a 100 px-wide display.

At zero offset, the grid's bottom edge meets the token's top edge. Use **Offset Y (px)** to move it up (negative) or down (positive) by a fixed screen distance. Choose one of ten box colors, including white and black; red is the default. These settings belong to each token and remain when its hit count changes.

The GM presses **H** to activate Token Hit Counters mode. Click the grid to spend one hit, or Shift-click to restore one. The count stays between zero and its configured maximum. Players cannot edit hits through the extension.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies SDK types. Test the GM grid and player bar with separate clients: percentage fill, zero-hit `DEAD`, color, positioning, zoom, resizing, and hidden tokens.
