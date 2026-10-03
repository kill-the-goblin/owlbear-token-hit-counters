# Owlbear Rodeo Token HP

A GM-only hit point tracker for character tokens. Select one token to open its **Token HP** menu section. Type current HP and leave the field to save, or use the **−** and **+** buttons to change it by one immediately. Empty HP removes the badge; values stop at zero.

A red badge at the token's upper-right corner shows current HP to the GM. Press **H** to activate Token HP mode, then click a badge to subtract one HP or Shift-click to add one HP. Other map clicks retain Owlbear's normal selection behavior.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. Run `npm run build` for a static `dist/` directory.

## Verification needed in Owlbear

The build verifies the SDK types, but badge placement, local-item hit detection, the `H` shortcut, and GM-only display need a live test in a disposable scene.
