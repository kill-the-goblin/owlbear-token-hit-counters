import OBR, { buildLabel, type Item, type Label } from "@owlbear-rodeo/sdk";
import { HITS_KEY, ID, readHits, type Hits } from "./hits";

type Counter = {
  id: string;
  tokenId: string;
  maximum: number;
  remaining: number;
  x: number;
  y: number;
  width: number;
  visible: boolean;
};

const counters = new Map<string, Counter>();
let latestItems: Item[] | null = null;
let syncing = false;

export function tokenForCounter(labelId: string): string | undefined {
  for (const counter of counters.values()) if (counter.id === labelId) return counter.tokenId;
  return undefined;
}

export function clearCounters(): void {
  counters.clear();
  latestItems = null;
}

export function scheduleCounterSync(items: Item[]): void {
  latestItems = items;
  if (!syncing) void syncCounters();
}

async function syncCounters(): Promise<void> {
  syncing = true;
  try {
    while (latestItems !== null) {
      const snapshot = latestItems;
      latestItems = null;
      await reconcile(snapshot);
    }
  } catch (error) {
    console.error("Token hit counter sync failed", error);
  } finally {
    syncing = false;
    if (latestItems !== null) void syncCounters();
  }
}

function gridText(remaining: number): string {
  if (remaining === 0) return "0";
  const row = (start: number) => Array.from({ length: 5 }, (_, index) =>
    start + index < remaining ? "■" : "\u00a0",
  ).join(" ");
  return `${row(0)}\n${row(5)}`;
}

function counterSize(tokenWidth: number, sceneDpi: number): number {
  return tokenWidth / sceneDpi * 80;
}

async function reconcile(items: Item[]): Promise<void> {
  const wanted = new Map<string, { token: Item; hits: Hits }>();
  for (const token of items) {
    if (token.layer !== "CHARACTER") continue;
    const hits = readHits(token.metadata[HITS_KEY]);
    if (hits) wanted.set(token.id, { token, hits });
  }

  const obsolete = [...counters.values()].filter((counter) => !wanted.has(counter.tokenId));
  if (obsolete.length) {
    await OBR.scene.local.deleteItems(obsolete.map((counter) => counter.id));
    for (const counter of obsolete) counters.delete(counter.tokenId);
  }

  if (wanted.size === 0) return;
  const sceneDpi = await OBR.scene.grid.getDpi();
  for (const { token, hits } of wanted.values()) {
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const x = bounds.min.x + bounds.width / 2;
    const y = bounds.min.y;
    const width = counterSize(bounds.width, sceneDpi);
    const height = width * 2 / 5;
    const fontSize = width * 0.75 / 5;
    const counter = counters.get(token.id);
    if (counter) {
      if (counter.maximum !== hits.maximum || counter.remaining !== hits.remaining ||
          counter.x !== x || counter.y !== y || counter.width !== width ||
          counter.visible !== token.visible) {
        await OBR.scene.local.updateItems([counter.id], (labels) => {
          for (const item of labels) {
            if (item.type !== "LABEL") continue;
            const label = item as Label;
            label.text.plainText = gridText(hits.remaining);
            label.text.width = width;
            label.text.height = height;
            label.text.style.fontSize = fontSize;
            label.position = { x, y };
            label.visible = token.visible;
            label.description = `${hits.remaining} of ${hits.maximum} hits remaining`;
          }
        });
        Object.assign(counter, { maximum: hits.maximum, remaining: hits.remaining, x, y, width, visible: token.visible });
      }
      continue;
    }
    const label = buildLabel()
      .plainText(gridText(hits.remaining))
      .position({ x, y })
      .layer("TEXT")
      .visible(token.visible)
      .locked(true)
      .name("Token Hit Counter")
      .description(`${hits.remaining} of ${hits.maximum} hits remaining`)
      .metadata({ [`${ID}/counter`]: token.id })
      .backgroundColor("#8e1d2b")
      .backgroundOpacity(0.85)
      .fillColor("#ffffff")
      .cornerRadius(4)
      .minViewScale(0.01)
      .maxViewScale(100)
      .pointerWidth(0)
      .pointerHeight(0)
      .pointerDirection("DOWN")
      .fontFamily("monospace")
      .fontSize(fontSize)
      .fontWeight(700)
      .lineHeight(1)
      .textAlign("CENTER")
      .textAlignVertical("MIDDLE")
      .width(width)
      .height(height)
      .padding(0)
      .build();
    await OBR.scene.local.addItems([label]);
    counters.set(token.id, {
      id: label.id, tokenId: token.id, maximum: hits.maximum, remaining: hits.remaining,
      x, y, width, visible: token.visible,
    });
  }
}
