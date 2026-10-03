import OBR, { type Item, type Theme } from "@owlbear-rodeo/sdk";
import { HP_KEY, hpData, readHp } from "./hp";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#hp")!;
const minus = document.querySelector<HTMLButtonElement>("#minus")!;
const plus = document.querySelector<HTMLButtonElement>("#plus")!;
const status = document.querySelector<HTMLElement>("#status")!;
let tokenId: string | undefined;
let current: number | null = null;
let queue = Promise.resolve();

function showStatus(message: string): void {
  status.textContent = message;
  status.hidden = !message;
}

function refreshButtons(): void {
  const draft = input.value.trim();
  const value = /^\d+$/.test(draft) && Number.isSafeInteger(Number(draft)) ? Number(draft) : current;
  minus.disabled = !tokenId || value === null || value === 0;
  plus.disabled = !tokenId;
}

function render(item: Item | undefined): void {
  current = item ? readHp(item.metadata[HP_KEY]) : null;
  if (document.activeElement !== input) input.value = current === null ? "" : String(current);
  input.disabled = !item;
  refreshButtons();
}

async function refresh(): Promise<void> {
  if (!tokenId) { render(undefined); return; }
  const [item] = await OBR.scene.items.getItems([tokenId]);
  render(item);
}

function update(change: (hp: number | null) => number | null): void {
  const id = tokenId;
  if (!id) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems((item) => item.id === id && item.layer === "CHARACTER", (items) => {
      for (const item of items) item.metadata[HP_KEY] = hpData(change(readHp(item.metadata[HP_KEY])));
    });
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save HP.");
    void refresh();
  });
}

function saveDraft(): void {
  if (!tokenId || input.disabled) return;
  const draft = input.value.trim();
  if (draft && (!/^\d+$/.test(draft) || !Number.isSafeInteger(Number(draft)))) {
    showStatus("Enter a whole number of 0 or more.");
    input.value = current === null ? "" : String(current);
    return;
  }
  const next = draft === "" ? null : Number(draft);
  if (next === current) return;
  update(() => next);
}

for (const button of [minus, plus]) {
  button.addEventListener("pointerdown", (event) => event.preventDefault());
}
minus.addEventListener("click", () => {
  const draft = input.value.trim();
  const base = /^\d+$/.test(draft) && Number.isSafeInteger(Number(draft)) ? Number(draft) : current;
  if (base === null || base <= 0) return;
  input.value = String(base - 1);
  refreshButtons();
  update(() => base - 1);
});
plus.addEventListener("click", () => {
  const draft = input.value.trim();
  const base = /^\d+$/.test(draft) && Number.isSafeInteger(Number(draft)) ? Number(draft) : current;
  const next = base === null ? 1 : base + 1;
  if (!Number.isSafeInteger(next)) return;
  input.value = String(next);
  refreshButtons();
  update(() => next);
});
input.addEventListener("blur", saveDraft);
input.addEventListener("input", refreshButtons);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); input.blur(); }
  if (event.key === "Escape") { input.value = current === null ? "" : String(current); input.blur(); }
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
