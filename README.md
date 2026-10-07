# Token Hit Counters

Hit counters for character tokens in Owlbear Rodeo. The GM selects a token and uses **Counters [remaining] of [maximum]** to edit its current and maximum hits. Either field can initialize a counter: entering a positive remaining count first copies it to the maximum, while entering the maximum first starts the counter full. Editing the maximum later preserves the remaining count, clamping it if necessary. Enter **0** or clear the maximum field to remove the counter. To start at zero remaining, enter **0** first and then enter a positive maximum.

The first menu row also has a right-aligned **AC** field. Enter 1–99 to show a white square with black AC text inside the token's upper-right corner, below the counter grid; enter 0 or clear the field to remove it. The badge is GM-only and can appear on tokens without hit counters. Its on-screen size and inset stay fixed through zoom and token resizing. The AC value is stored separately from the hit counter.

The GM sees boxes in fixed cells of a transparent grid just above the token. Counts of one to five use one row. Counts of 6–10 use centered rows of 3+3, 3+4, 4+4, 4+5, or 5+5. Counts of 11–15 use three centered rows, top to bottom: 3+4+4, 4+4+4, 4+4+5, 4+5+5, or 5+5+5. The bottom row stays against the token, and the third row extends the grid upward without shrinking the boxes. Spent boxes are transparent with visible outlines; remaining boxes have bright fills and dark outlines. Hits are spent from the top row, right to left, then the rows below. The C tool treats the entire grid rectangle as one click target, including empty cells and a depleted counter. At zero, all boxes remain empty and outlined; Shift-click the grid to restore a hit. The grid stays visible and clickable to the GM when its token is hidden from players.

Players see a single continuous bar at the same width and offset, with a visible height of 17 px, matching one GM box. Its fill shows the percentage of hits remaining, without counts or numbers. Both GM boxes and player bars are green above 80%, yellow above 50% through 80%, and red at 50% or below. For example, a five-counter token shows green at 5, yellow at 4–3, and red at 2–1. At zero, the player view shows the token's zero label (default `DEAD`). The display follows the token while it is dragged, stays the same on-screen size through zoom, and resizes with the token. A normal one-cell token uses a 100 px-wide display.

At Offset 0, the grid's bottom edge sits 5 px above the token. New counters show Offset 0, and existing counters keep their saved Offset values; the grid and player bar both render 5 px higher than before. The compact bottom menu row shows Offset [value], then HP / Box [value] and current/total, with a 14 px gap before HP / Box. Offset moves the grid up (negative) or down (positive) by a fixed screen-pixel distance. HP / Box accepts 1–999, defaults to 1 for existing tokens, and multiplies the remaining and maximum box counts for the displayed current and total HP. The number of boxes changed by a click stays one. These settings belong to each token and remain when its hit count changes.

The GM presses **C** to activate the Token Hit Counters tool on the right toolbar. Click the grid to spend one hit, or Shift-click to restore one. Press **W** to return to Owlbear's Move tool. The count stays between zero and its configured maximum. Players cannot edit hits through the extension.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies SDK types. Test the GM grid and player bar with separate clients: percentage fill, clear spent-box outlines, outlined boxes at zero, the player zero label, HP / Box calculation, positioning, zoom, resizing, and hidden tokens.
