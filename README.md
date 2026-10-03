# Token Hit Counters

Hit counters for character tokens in Owlbear Rodeo. The GM selects a token and uses **Counters [remaining] of [maximum]** to edit its current and maximum hits. Either field can initialize a counter: entering a positive remaining count first copies it to the maximum, while entering the maximum first starts the counter full. Editing the maximum later preserves the remaining count, clamping it if necessary. Enter **0** or clear the maximum field to remove the counter. To start at zero remaining, enter **0** first and then enter a positive maximum.

The first menu row also has a right-aligned **AC** field. Enter 1–99 to show a white square with black AC text inside the token's upper-right corner, below the counter grid; enter 0 or clear the field to remove it. The badge is GM-only and can appear on tokens without hit counters. Its on-screen size and inset stay fixed through zoom and token resizing. The AC value is stored separately from the hit counter.

The GM sees boxes in fixed cells of a transparent two-row, five-column grid just above the token. Tokens with one to four boxes center that group horizontally over the token. Positions beyond the configured maximum are hidden. Spent boxes retain faint outlines so the GM can see the full capacity. Hits are spent from the top row, right to left, then the bottom row. The H tool treats the entire grid rectangle as one click target, including empty cells and a depleted counter. At zero, a single outline marks that click target around the token's chosen label; Shift-click it to restore a hit.

Players see a single continuous bar at the same width and offset, with a visible height of 17 px, matching one GM box. Its fill shows the percentage of hits remaining, without counts or numbers. Both GM boxes and player bars are green above 80%, yellow above 50% through 80%, and red at 50% or below. For example, a five-counter token shows green at 5, yellow at 4–3, and red at 2–1. At zero, both views show the chosen label in red with a 1 px black outline. The display follows the token while it is dragged, stays the same on-screen size through zoom, and resizes with the token. A normal one-cell token uses a 100 px-wide display.

At zero offset, the grid's bottom edge meets the token's top edge. Use **Offset [value] ♡ [label]** to move it up (negative) or down (positive) by a fixed screen-pixel distance and set the zero-counter label (up to 16 characters, default `DEAD`). The label field fills the rest of its row, and the label is displayed in uppercase. Both settings belong to each token and remain when its hit count changes.

The GM presses **H** to activate the Token Hit Counters tool on the right toolbar. Click the grid to spend one hit, or Shift-click to restore one. Press **W** to return to Owlbear's Move tool. The count stays between zero and its configured maximum. Players cannot edit hits through the extension.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies SDK types. Test the GM grid and player bar with separate clients: percentage fill, faint spent-box outlines, the custom zero label, positioning, zoom, resizing, and hidden tokens.
