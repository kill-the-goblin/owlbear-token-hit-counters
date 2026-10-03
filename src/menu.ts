import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { DEFAULT_ZERO_LABEL, HITS_KEY, MAX_ZERO_LABEL_LENGTH, hitsData, readHits, type Hits } from "./hits";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#maximum")!;
const remaining = document.querySelector<HTMLInputElement>("#remaining")!;
const offset = document.querySelector<HTMLInputElement>("#offset")!;
const zeroLabel = document.querySelector<HTMLInputElement>("#zero-label")!;
const status = document.querySelector<HTMLElement>("#status")!;
let tokenId: string | undefined;
let current: Hits | null = null;
let queue = Promise.resolve();

function showStatus(message: string): void {
  status.textContent = message;
  status.hidden = !message;
}

function render(item: Item | undefined): void {
  current = item ? readHits(item.metadata[HITS_KEY]) : null;
  if (document.activeElement !== input) input.value = current ? String(current.maximum) : "";
  if (document.activeElement !== remaining) remaining.value = current ? String(current.remaining) : "";
  if (document.activeElement !== offset) offset.value = String(current?.offsetPx ?? 0);
  if (document.activeElement !== zeroLabel) zeroLabel.value = current?.zeroLabel ?? DEFAULT_ZERO_LABEL;
  input.disabled = !item;
  remaining.disabled = !current;
  offset.disabled = !current;
  zeroLabel.disabled = !current;
}

async function refresh(): Promise<void> {
  if (!tokenId) { render(undefined); return; }
  const [item] = await OBR.scene.items.getItems([tokenId]);
  render(item);
}

function saveDraft(): void {
  const id = tokenId;
  if (!id || input.disabled) return;
  const draft = input.value.trim();
  if (draft && (!/^\d+$/.test(draft) || Number(draft) > 10)) {
    showStatus("Enter 0–10 boxes.");
    input.value = current ? String(current.maximum) : "";
    return;
  }
  const maximum = draft === "" ? 0 : Number(draft);
  if (maximum === (current?.maximum ?? 0) && (!current || current.remaining === maximum)) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const previous = readHits(item.metadata[HITS_KEY]);
          item.metadata[HITS_KEY] = hitsData(maximum, maximum, previous ?? undefined);
        }
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save boxes.");
    void refresh();
  });
}

function saveRemaining(): void {
  const id = tokenId;
  if (!id || !current) return;
  const draft = remaining.value.trim();
  const next = Number(draft);
  if (!/^\d+$/.test(draft) || !Number.isSafeInteger(next) || next > current.maximum) {
    showStatus(`Enter 0–${current.maximum} counters.`);
    remaining.value = String(current.remaining);
    return;
  }
  if (next === current.remaining) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const hits = readHits(item.metadata[HITS_KEY]);
          if (hits) item.metadata[HITS_KEY] = hitsData(hits.maximum, Math.min(next, hits.maximum), hits);
        }
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save counters.");
    void refresh();
  });
}

function saveSettings(): void {
  const id = tokenId;
  if (!id || !current) return;
  const offsetPx = Number(offset.value);
  if (!Number.isSafeInteger(offsetPx) || offsetPx < -200 || offsetPx > 200) {
    showStatus("Enter an offset from -200 to 200 px.");
    offset.value = String(current.offsetPx);
    return;
  }
  if (offsetPx === current.offsetPx) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const hits = readHits(item.metadata[HITS_KEY]);
          if (hits) item.metadata[HITS_KEY] = hitsData(hits.maximum, hits.remaining, { ...hits, offsetPx });
        }
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save settings.");
    void refresh();
  });
}

function saveZeroLabel(): void {
  const id = tokenId;
  if (!id || !current) return;
  const label = zeroLabel.value.trim().toUpperCase() || DEFAULT_ZERO_LABEL;
  if (Array.from(label).length > MAX_ZERO_LABEL_LENGTH || /[\x00-\x1f\x7f]/.test(label)) {
    showStatus(`Enter a single-line label of at most ${MAX_ZERO_LABEL_LENGTH} characters.`);
    zeroLabel.value = current.zeroLabel;
    return;
  }
  zeroLabel.value = label;
  if (label === current.zeroLabel) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const hits = readHits(item.metadata[HITS_KEY]);
          if (hits) item.metadata[HITS_KEY] = hitsData(hits.maximum, hits.remaining, { ...hits, zeroLabel: label });
        }
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save zero label.");
    void refresh();
  });
}

input.addEventListener("blur", saveDraft);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); input.blur(); }
  if (event.key === "Escape") { input.value = current ? String(current.maximum) : ""; input.blur(); }
});
remaining.addEventListener("blur", saveRemaining);
remaining.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); remaining.blur(); }
  if (event.key === "Escape") { remaining.value = current ? String(current.remaining) : ""; remaining.blur(); }
});
offset.addEventListener("blur", saveSettings);
offset.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); offset.blur(); }
  if (event.key === "Escape") { offset.value = String(current?.offsetPx ?? 0); offset.blur(); }
});
zeroLabel.addEventListener("blur", saveZeroLabel);
zeroLabel.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); zeroLabel.blur(); }
  if (event.key === "Escape") { zeroLabel.value = current?.zeroLabel ?? DEFAULT_ZERO_LABEL; zeroLabel.blur(); }
});

OBR.onReady(async () => {
  OBR.scene.items.onChange((items) => {
    if (tokenId) render(items.find((item) => item.id === tokenId));
  });
  OBR.player.onChange(() => { void refreshSelection(); });
  await refreshSelection();
});

async function refreshSelection(): Promise<void> {
  const selected = await OBR.player.getSelection();
  const nextId = selected?.length === 1 ? selected[0] : undefined;
  if (nextId === tokenId) return;
  tokenId = nextId;
  showStatus("");
  await refresh();
}
