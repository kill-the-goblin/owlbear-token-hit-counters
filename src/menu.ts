import OBR, { type Item, type Theme } from "@owlbear-rodeo/sdk";
import { HITS_KEY, hitsData, readHits, type Hits } from "./hits";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#maximum")!;
const remaining = document.querySelector<HTMLElement>("#remaining")!;
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
  input.disabled = !item;
  remaining.textContent = current ? `${current.remaining}/${current.maximum} left` : "No counter";
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
        for (const item of items) item.metadata[HITS_KEY] = hitsData(maximum);
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save boxes.");
    void refresh();
  });
}

input.addEventListener("blur", saveDraft);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); input.blur(); }
  if (event.key === "Escape") { input.value = current ? String(current.maximum) : ""; input.blur(); }
});

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.style.setProperty("--obr-surface", theme.background.paper);
  root.style.setProperty("--obr-input", theme.background.default);
  root.style.setProperty("--obr-text", theme.text.primary);
  root.style.setProperty("--obr-muted", theme.text.secondary);
  root.style.colorScheme = theme.mode.toLowerCase();
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);
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
