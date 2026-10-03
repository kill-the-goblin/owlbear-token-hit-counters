# Owlbear Rodeo Token HP

Scaffold for a GM tool to adjust hit points by clicking badges attached to tokens. This version only registers the tool and `H` shortcut; it does not track HP yet.

## Development

```sh
npm install
npm run dev
```

Load `http://localhost:11209/manifest.json` as a custom extension in Owlbear Rodeo. The manifest and background page are served by Vite. Run `npm run build` for a static `dist/` directory.

## Planned first prototype

- Attach a screen-size-stable label to a character token and store current HP in namespaced item metadata.
- Verify badge hit detection in the active tool mode.
- Settle click, damage entry, healing, and player-visibility behavior before implementing the tracker.
