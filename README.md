# Token Hit Counters

A GM-only hit counter for character tokens in Owlbear Rodeo. Select a token and enter **1–10** in the **Boxes** field to set its maximum and refill it. Enter **0** or clear the field to remove the counter.

The counter shows boxes in fixed cells of a transparent two-row, five-column grid at the top of the token. Unused positions are hidden. The full grid remains clickable, including at zero. The grid follows the token while it is dragged. Its on-screen size stays constant as the map zoom changes, while resizing the token changes the grid's size. At zero, a `0` marker remains visible.

Use **Offset Y (px)** to move the grid up (negative) or down (positive) by a fixed screen distance. Choose one of eight box colors; red is the default. These settings belong to each token and remain when its hit count changes.

Press **H** to activate Token Hit Counters mode. Click the grid to spend one hit, or Shift-click to restore one. The count stays between zero and its configured maximum. Only the GM sees the grid.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies SDK types. Test grid placement, fixed on-screen size through zoom, token resizing, click and Shift-click behavior, and GM-only visibility in a disposable scene.
