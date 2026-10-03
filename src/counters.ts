import OBR, { buildBillboard, type Billboard, type Item } from "@owlbear-rodeo/sdk";
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
let initialized = false;

export function tokenForCounter(itemId: string): string | undefined {
  for (const counter of counters.values()) if (counter.id === itemId) return counter.tokenId;
  return undefined;
}

export function clearCounters(): void {
  counters.clear();
  latestItems = null;
  initialized = false;
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

function counterImageUrl(remaining: number): string {
  return new URL(`/hit-grids/${remaining}.svg`, window.location.origin).href;
}

function counterSize(tokenWidth: number, sceneDpi: number): number {
  return tokenWidth / sceneDpi * 80;
}

async function reconcile(items: Item[]): Promise<void> {
  if (!initialized) {
    const previous = await OBR.scene.local.getItems((item) =>
      typeof item.metadata[`${ID}/counter`] === "string",
    );
    if (previous.length) await OBR.scene.local.deleteItems(previous.map((item) => item.id));
    initialized = true;
  }
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
    const counter = counters.get(token.id);
    if (counter) {
      if (counter.maximum !== hits.maximum || counter.remaining !== hits.remaining ||
          counter.x !== x || counter.y !== y || counter.width !== width ||
          counter.visible !== token.visible) {
        await OBR.scene.local.updateItems([counter.id], (items) => {
          for (const item of items) {
            if (item.type !== "BILLBOARD") continue;
            const billboard = item as Billboard;
            billboard.image.url = counterImageUrl(hits.remaining);
            billboard.scale = { x: width / 100, y: width / 100 };
            billboard.position = { x, y };
            billboard.visible = token.visible;
            billboard.description = `${hits.remaining} of ${hits.maximum} hits remaining`;
          }
        });
        Object.assign(counter, { maximum: hits.maximum, remaining: hits.remaining, x, y, width, visible: token.visible });
      }
      continue;
    }
    const billboard = buildBillboard(
      { width: 100, height: 40, mime: "image/svg+xml", url: counterImageUrl(hits.remaining) },
      { dpi: sceneDpi, offset: { x: 50, y: 0 } },
    )
      .position({ x, y })
      .scale({ x: width / 100, y: width / 100 })
      .layer("TEXT")
      .visible(token.visible)
      .locked(true)
      .name("Token Hit Counter")
      .description(`${hits.remaining} of ${hits.maximum} hits remaining`)
      .metadata({ [`${ID}/counter`]: token.id })
      .minViewScale(0.01)
      .maxViewScale(100)
      .build();
    await OBR.scene.local.addItems([billboard]);
    counters.set(token.id, {
      id: billboard.id, tokenId: token.id, maximum: hits.maximum, remaining: hits.remaining,
      x, y, width, visible: token.visible,
    });
  }
}
