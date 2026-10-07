import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { AC_KEY, DEFAULT_OFFSET_PX, HITS_KEY, MAX_HITS, MAX_HP_PER_BOX, hitsData, readAC, readHits, type Hits } from "./hits";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#maximum")!;
const remaining = document.querySelector<HTMLInputElement>("#remaining")!;
const ac = document.querySelector<HTMLInputElement>("#ac")!;
const offset = document.querySelector<HTMLInputElement>("#offset")!;
const hpPerBox = document.querySelector<HTMLInputElement>("#hp-per-box")!;
const hpTotal = document.querySelector<HTMLOutputElement>("#hp-total")!;
const status = document.querySelector<HTMLElement>("#status")!;
let tokenId: string | undefined;
let current: Hits | null = null;
let currentAC: number | null = null;
let pendingZero = false;
let queue = Promise.resolve();

function showStatus(message: string): void {
  status.textContent = message;
  status.hidden = !message;
}

function updateHpTotal(): void {
  const maximum = Number(input.value);
  const count = remaining.value.trim() === "" ? maximum : Number(remaining.value);
  const perBox = Number(hpPerBox.value);
  hpTotal.value = Number.isSafeInteger(maximum) && maximum >= 0 && maximum <= MAX_HITS &&
    Number.isSafeInteger(count) && count >= 0 && count <= maximum &&
    Number.isSafeInteger(perBox) && perBox >= 1 && perBox <= MAX_HP_PER_BOX
      ? `${count * perBox}/${maximum * perBox}` : "—";
}

function render(item: Item | undefined): void {
  current = item ? readHits(item.metadata[HITS_KEY]) : null;
  currentAC = item ? readAC(item.metadata[AC_KEY]) : null;
  if (document.activeElement !== input) input.value = current ? String(current.maximum) : "";
  if (document.activeElement !== remaining) remaining.value = current ? String(current.remaining) : pendingZero ? "0" : "";
  if (document.activeElement !== offset) offset.value = String(current?.offsetPx ?? DEFAULT_OFFSET_PX);
  if (document.activeElement !== hpPerBox) hpPerBox.value = String(current?.hpPerBox ?? 1);
  if (document.activeElement !== ac) ac.value = currentAC === null ? "" : String(currentAC);
  input.disabled = !item;
  remaining.disabled = !item;
  offset.disabled = !current;
  hpPerBox.disabled = !current;
  ac.disabled = !item;
  updateHpTotal();
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
  if (draft && (!/^\d+$/.test(draft) || Number(draft) > MAX_HITS)) {
    showStatus(`Enter a total from 0 to ${MAX_HITS}.`);
    input.value = current ? String(current.maximum) : "";
    return;
  }
  const maximum = draft === "" ? 0 : Number(draft);
  if (maximum === 0) {
    pendingZero = false;
    remaining.value = "";
    if (current) queueCounts(id, 0, 0);
    else showStatus("");
    return;
  }
  const draftRemaining = remaining.value.trim();
  if (draftRemaining && (!/^\d+$/.test(draftRemaining) || Number(draftRemaining) > MAX_HITS ||
      (!current && Number(draftRemaining) > maximum))) {
    showStatus(`Enter 0–${maximum} remaining.`);
    return;
  }
  const desired = draftRemaining ? Number(draftRemaining) : current?.remaining ?? maximum;
  const next = current ? Math.min(desired, maximum) : desired;
  pendingZero = false;
  remaining.value = String(next);
  if (maximum !== current?.maximum || next !== current.remaining) queueCounts(id, maximum, next);
  else showStatus("");
}

function saveRemaining(): void {
  const id = tokenId;
  if (!id || remaining.disabled) return;
  const draft = remaining.value.trim();
  const next = Number(draft);
  const draftMaximum = input.value.trim();
  const maximum = draftMaximum && /^\d+$/.test(draftMaximum) && Number(draftMaximum) <= MAX_HITS
    ? Number(draftMaximum) : current?.maximum ?? 0;
  if (!/^\d+$/.test(draft) || !Number.isSafeInteger(next) || next > MAX_HITS || (maximum > 0 && next > maximum)) {
    showStatus(`Enter 0–${maximum || MAX_HITS} remaining.`);
    remaining.value = current ? String(current.remaining) : "";
    return;
  }
  if (!current && maximum === 0 && next === 0) {
    pendingZero = true;
    showStatus("Enter a total to use 0 remaining.");
    return;
  }
  const total = maximum || next;
  pendingZero = false;
  input.value = String(total);
  if (current?.maximum !== total || current.remaining !== next) queueCounts(id, total, next);
  else showStatus("");
}

function queueCounts(id: string, maximum: number, next: number): void {
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const hits = readHits(item.metadata[HITS_KEY]);
          item.metadata[HITS_KEY] = hitsData(maximum, next, hits ?? undefined);
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

function saveAC(): void {
  const id = tokenId;
  if (!id || ac.disabled) return;
  const draft = ac.value.trim();
  if (draft && (!/^\d+$/.test(draft) || Number(draft) > 99)) {
    showStatus("Enter AC from 0 to 99.");
    ac.value = currentAC === null ? "" : String(currentAC);
    return;
  }
  const next = draft && Number(draft) > 0 ? Number(draft) : null;
  if (next === currentAC) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) item.metadata[AC_KEY] = next;
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save AC.");
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

function saveHpPerBox(): void {
  const id = tokenId;
  if (!id || !current) return;
  const draft = hpPerBox.value.trim();
  const next = Number(draft);
  if (!/^\d+$/.test(draft) || !Number.isSafeInteger(next) || next < 1 || next > MAX_HP_PER_BOX) {
    showStatus(`Enter 1–${MAX_HP_PER_BOX} HP per box.`);
    hpPerBox.value = String(current.hpPerBox);
    updateHpTotal();
    return;
  }
  hpPerBox.value = String(next);
  updateHpTotal();
  if (next === current.hpPerBox) return;
  queue = queue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === id && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const hits = readHits(item.metadata[HITS_KEY]);
          if (hits) item.metadata[HITS_KEY] = hitsData(hits.maximum, hits.remaining, { ...hits, hpPerBox: next });
        }
      },
    );
    await refresh();
    showStatus("");
  }).catch((error: unknown) => {
    showStatus(error instanceof Error ? error.message : "Could not save HP per box.");
    void refresh();
  });
}

input.addEventListener("blur", saveDraft);
input.addEventListener("focus", () => input.select());
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); input.blur(); }
  if (event.key === "Escape") { input.value = current ? String(current.maximum) : ""; input.blur(); }
});
remaining.addEventListener("blur", saveRemaining);
remaining.addEventListener("focus", () => remaining.select());
remaining.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); remaining.blur(); }
  if (event.key === "Escape") { remaining.value = current ? String(current.remaining) : ""; remaining.blur(); }
});
ac.addEventListener("blur", saveAC);
ac.addEventListener("focus", () => ac.select());
ac.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); ac.blur(); }
  if (event.key === "Escape") { ac.value = currentAC === null ? "" : String(currentAC); ac.blur(); }
});
offset.addEventListener("blur", saveSettings);
offset.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); offset.blur(); }
  if (event.key === "Escape") { offset.value = String(current?.offsetPx ?? DEFAULT_OFFSET_PX); offset.blur(); }
});
hpPerBox.addEventListener("blur", saveHpPerBox);
hpPerBox.addEventListener("focus", () => hpPerBox.select());
hpPerBox.addEventListener("input", updateHpTotal);
hpPerBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); hpPerBox.blur(); }
  if (event.key === "Escape") { hpPerBox.value = String(current?.hpPerBox ?? 1); hpPerBox.blur(); }
});
input.addEventListener("input", updateHpTotal);
remaining.addEventListener("input", updateHpTotal);

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
  pendingZero = false;
  showStatus("");
  await refresh();
}
