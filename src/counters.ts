import OBR, { buildBillboard, type Billboard, type Item, type Vector2 } from "@owlbear-rodeo/sdk";
import { HITS_KEY, ID, readHits, type Hits } from "./hits";

type Counter = {
  id: string;
  tokenId: string;
  maximum: number;
  remaining: number;
  color: string;
  offsetPx: number;
  x: number;
  y: number;
  width: number;
  visible: boolean;
};

const counters = new Map<string, Counter>();
const IMAGE_SCALE = 8;
const IMAGE_WIDTH = 100 * IMAGE_SCALE;
const IMAGE_HEIGHT = 40 * IMAGE_SCALE;
let latestItems: Item[] | null = null;
let syncing = false;
let initialized = false;

export function tokenForCounter(itemId: string): string | undefined {
  for (const counter of counters.values()) if (counter.id === itemId) return counter.tokenId;
  return undefined;
}

export async function tokenAtGridPoint(point: Vector2): Promise<string | undefined> {
  if (counters.size === 0) return undefined;
  const viewScale = await OBR.viewport.getScale();
  if (!Number.isFinite(viewScale) || viewScale <= 0) return undefined;
  for (const counter of counters.values()) {
    if (!counter.visible) continue;
    const halfWidth = counter.width / (2 * viewScale);
    const bottom = counter.y + counter.offsetPx / viewScale;
    const top = bottom - counter.width * 0.4 / viewScale;
    if (point.x >= counter.x - halfWidth && point.x <= counter.x + halfWidth &&
        point.y >= top && point.y <= bottom) return counter.tokenId;
  }
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

function counterImageUrl(remaining: number, color: string): string {
  return new URL(`/hit-grids/${color}/${remaining}.svg`, window.location.origin).href;
}

function counterSize(tokenWidth: number, sceneDpi: number): number {
  return tokenWidth / sceneDpi * 100;
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
    // The grid's bottom edge rests on the token's top edge at zero offset.
    const offsetY = IMAGE_HEIGHT - hits.offsetPx * IMAGE_WIDTH / width;
    const counter = counters.get(token.id);
    if (counter) {
      if (counter.maximum !== hits.maximum || counter.remaining !== hits.remaining ||
          counter.color !== hits.color || counter.offsetPx !== hits.offsetPx ||
          counter.x !== x || counter.y !== y || counter.width !== width ||
          counter.visible !== token.visible) {
        await OBR.scene.local.updateItems([counter.id], (items) => {
          for (const item of items) {
            if (item.type !== "BILLBOARD") continue;
            const billboard = item as Billboard;
            billboard.image.url = counterImageUrl(hits.remaining, hits.color);
            billboard.grid.offset.y = offsetY;
            billboard.scale = { x: width / 100, y: width / 100 };
            billboard.position = { x, y };
            billboard.visible = token.visible;
            billboard.description = `${hits.remaining} of ${hits.maximum} hits remaining`;
          }
        });
        Object.assign(counter, { maximum: hits.maximum, remaining: hits.remaining, color: hits.color,
          offsetPx: hits.offsetPx, x, y, width, visible: token.visible });
      }
      continue;
    }
    const billboard = buildBillboard(
      { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, mime: "image/svg+xml", url: counterImageUrl(hits.remaining, hits.color) },
      { dpi: sceneDpi * IMAGE_SCALE, offset: { x: IMAGE_WIDTH / 2, y: offsetY } },
    )
      .position({ x, y })
      .scale({ x: width / 100, y: width / 100 })
      .attachedTo(token.id)
      .disableAttachmentBehavior(["ROTATION", "LOCKED", "COPY"])
      .layer("TEXT")
      .visible(token.visible)
      .locked(true)
      .disableHit(false)
      .name("Token Hit Counter")
      .description(`${hits.remaining} of ${hits.maximum} hits remaining`)
      .metadata({ [`${ID}/counter`]: token.id })
      .minViewScale(1)
      .maxViewScale(1)
      .build();
    await OBR.scene.local.addItems([billboard]);
    counters.set(token.id, {
      id: billboard.id, tokenId: token.id, maximum: hits.maximum, remaining: hits.remaining,
      color: hits.color, offsetPx: hits.offsetPx,
      x, y, width, visible: token.visible,
    });
  }
}
