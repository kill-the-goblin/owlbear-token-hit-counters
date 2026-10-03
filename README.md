# Token Hit Counters

A GM-only hit counter for character tokens in Owlbear Rodeo. Select a token and enter **1–10** in the **Boxes** field to set its maximum and refill it. Enter **0** or clear the field to remove the counter.

The counter shows boxes in fixed cells of a transparent two-row, five-column grid just above the token. Unused positions are hidden. Hits are spent from the top row, right to left, then the bottom row. The H tool treats the entire grid rectangle as one click target, including empty cells and a depleted counter. The grid follows the token while it is dragged. Its on-screen size stays constant as the map zoom changes, while resizing the token changes the grid's size. Each box is 17% of the grid width, with a 3 px gap; a normal one-cell token uses a 100 px grid. At zero, `DEAD` appears across the grid; Shift-click the grid to restore a hit.

At zero offset, the grid's bottom edge meets the token's top edge. Use **Offset Y (px)** to move it up (negative) or down (positive) by a fixed screen distance. Choose one of ten box colors, including white and black; red is the default. These settings belong to each token and remain when its hit count changes.

Press **H** to activate Token Hit Counters mode. Click the grid to spend one hit, or Shift-click to restore one. The count stays between zero and its configured maximum. Only the GM sees the grid.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies SDK types. Test grid placement, fixed on-screen size through zoom, token resizing, click and Shift-click behavior, and GM-only visibility in a disposable scene.
