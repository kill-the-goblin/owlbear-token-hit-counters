import OBR, { buildBillboard, buildLabel, type Billboard, type Item, type Label, type Vector2 } from "@owlbear-rodeo/sdk";
import { AC_KEY, HITS_KEY, ID, readAC, readHits, type Hits } from "./hits";

type Counter = {
  id: string;
  kind: "BILLBOARD" | "LABEL";
  labelId?: string;
  tokenId: string;
  maximum: number;
  remaining: number;
  zeroLabel: string;
  offsetPx: number;
  x: number;
  y: number;
  width: number;
  viewScale: number;
  visible: boolean;
};

type ACBadge = {
  id: string;
  value: number;
  x: number;
  y: number;
  visible: boolean;
};

const counters = new Map<string, Counter>();
const acBadges = new Map<string, ACBadge>();
const IMAGE_SCALE = 8;
const IMAGE_WIDTH = 100 * IMAGE_SCALE;
const GRID_HEIGHT = 40 * IMAGE_SCALE;
const THREE_ROW_GRID_HEIGHT = 60 * IMAGE_SCALE;
const BAR_HEIGHT = 19 * IMAGE_SCALE;
const AC_SIZE = 26 * IMAGE_SCALE;
const AC_INSET = 2 * IMAGE_SCALE;
let latestItems: Item[] | null = null;
let sceneItems: Item[] | null = null;
let syncing = false;
let initialized = false;
let display: "GM" | "PLAYER" = "GM";

export function setCounterDisplay(role: "GM" | "PLAYER"): void {
  if (display === role) return;
  display = role;
  counters.clear();
  acBadges.clear();
  initialized = false;
}

export function tokenForCounter(itemId: string): string | undefined {
  for (const counter of counters.values()) if (counter.id === itemId || counter.labelId === itemId) return counter.tokenId;
  return undefined;
}

export async function tokenAtGridPoint(point: Vector2): Promise<string | undefined> {
  if (display !== "GM" || counters.size === 0) return undefined;
  const viewScale = await OBR.viewport.getScale();
  if (!Number.isFinite(viewScale) || viewScale <= 0) return undefined;
  for (const counter of counters.values()) {
    if (!counter.visible) continue;
    const halfWidth = counter.width / (2 * viewScale);
    const bottom = counter.y + counter.offsetPx / viewScale;
    const gridHeight = counter.maximum > 10 ? 0.6 : 0.4;
    const top = bottom - counter.width * gridHeight / viewScale;
    if (point.x >= counter.x - halfWidth && point.x <= counter.x + halfWidth &&
        point.y >= top && point.y <= bottom) return counter.tokenId;
  }
  return undefined;
}

export function clearCounters(): void {
  counters.clear();
  acBadges.clear();
  latestItems = null;
  sceneItems = null;
  initialized = false;
}

export function scheduleCounterSync(items: Item[]): void {
  sceneItems = items;
  latestItems = items;
  if (!syncing) void syncCounters();
}

export async function syncCounterViewport(): Promise<void> {
  if (!sceneItems || ![...counters.values()].some((counter) => counter.kind === "LABEL" || counter.labelId)) return;
  const viewScale = await OBR.viewport.getScale();
  if ([...counters.values()].some((counter) => (counter.kind === "LABEL" || counter.labelId) && counter.viewScale !== viewScale)) {
    scheduleCounterSync(sceneItems);
  }
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

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

function counterColor(hits: Hits): "green" | "yellow" | "red" {
  if (hits.remaining * 5 > hits.maximum * 4) return "green";
  if (hits.remaining * 2 > hits.maximum) return "yellow";
  return "red";
}

function counterImageUrl(hits: Hits): string {
  if (display === "GM") {
    if (hits.remaining === 0) return new URL(hits.maximum > 10 ? "/hit-grids/red/0-3.svg" : "/hit-grids/red/0.svg", window.location.origin).href;
    return new URL(`/hit-grids/${counterColor(hits)}/${hits.remaining}-${hits.maximum}.svg`, window.location.origin).href;
  }
  const divisor = gcd(hits.remaining, hits.maximum);
  const fraction = `${hits.remaining / divisor}-${hits.maximum / divisor}`;
  return new URL(`/player-bars/${counterColor(hits)}/${fraction}.svg`, window.location.origin).href;
}

function counterSize(tokenWidth: number, sceneDpi: number): number {
  return tokenWidth / sceneDpi * 100;
}

function makeZeroLabel(token: Item, hits: Hits, x: number, y: number, width: number, viewScale: number): Label {
  const height = display === "GM" && hits.maximum > 10 ? 60 : 40;
  return buildLabel()
    .plainText(hits.zeroLabel)
    .width(100)
    .height(height)
    .padding(0)
    .fontFamily("sans-serif")
    .fontSize(Math.min(24, Math.floor(150 / Array.from(hits.zeroLabel).length)))
    .fontWeight(800)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor("#dc2626")
    .strokeColor("#000000")
    .strokeWidth(1)
    .backgroundOpacity(0)
    .pointerWidth(0)
    .pointerHeight(0)
    .pointerDirection("DOWN")
    .position({ x, y: y + hits.offsetPx / viewScale })
    .scale({ x: width / 100, y: width / 100 })
    .attachedTo(token.id)
    .disableAttachmentBehavior(["ROTATION", "LOCKED", "COPY"])
    .layer("TEXT")
    .visible(token.visible)
    .locked(true)
    .disableHit(true)
    .name("Token Hits Zero Label")
    .description(display === "GM" ? `${hits.remaining} of ${hits.maximum} hits remaining` : "Token hits bar")
    .metadata({ [`${ID}/counter`]: token.id })
    .minViewScale(1)
    .maxViewScale(1)
    .build();
}

function updateZeroLabel(label: Label, hits: Hits, x: number, y: number, width: number, viewScale: number, visible: boolean): void {
  label.text.plainText = hits.zeroLabel;
  label.text.height = display === "GM" && hits.maximum > 10 ? 60 : 40;
  label.text.style.fontSize = Math.min(24, Math.floor(150 / Array.from(hits.zeroLabel).length));
  label.scale = { x: width / 100, y: width / 100 };
  label.position = { x, y: y + hits.offsetPx / viewScale };
  label.visible = visible;
}

async function reconcile(items: Item[]): Promise<void> {
  if (!initialized) {
    const previous = await OBR.scene.local.getItems((item) =>
      typeof item.metadata[`${ID}/counter`] === "string" || typeof item.metadata[`${ID}/ac-badge`] === "string",
    );
    if (previous.length) await OBR.scene.local.deleteItems(previous.map((item) => item.id));
    initialized = true;
  }
  const wanted = new Map<string, { token: Item; hits: Hits }>();
  const acWanted = new Map<string, { token: Item; value: number }>();
  for (const token of items) {
    if (token.layer !== "CHARACTER") continue;
    const hits = readHits(token.metadata[HITS_KEY]);
    if (hits) wanted.set(token.id, { token, hits });
    const ac = readAC(token.metadata[AC_KEY]);
    if (display === "GM" && ac !== null) acWanted.set(token.id, { token, value: ac });
  }

  const obsolete = [...counters.values()].filter((counter) => !wanted.has(counter.tokenId));
  if (obsolete.length) {
    await OBR.scene.local.deleteItems(obsolete.flatMap((counter) => [counter.id, ...(counter.labelId ? [counter.labelId] : [])]));
    for (const counter of obsolete) counters.delete(counter.tokenId);
  }

  const obsoleteAC = [...acBadges.entries()].filter(([tokenId]) => !acWanted.has(tokenId));
  if (obsoleteAC.length) {
    await OBR.scene.local.deleteItems(obsoleteAC.map(([, badge]) => badge.id));
    for (const [tokenId] of obsoleteAC) acBadges.delete(tokenId);
  }

  if (wanted.size === 0 && acWanted.size === 0) return;
  const sceneDpi = await OBR.scene.grid.getDpi();
  const viewScale = await OBR.viewport.getScale();
  for (const { token, hits } of wanted.values()) {
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const x = bounds.min.x + bounds.width / 2;
    const y = bounds.min.y;
    const width = counterSize(bounds.width, sceneDpi);
    const imageHeight = display === "GM"
      ? hits.maximum > 10 ? THREE_ROW_GRID_HEIGHT : GRID_HEIGHT
      : hits.remaining === 0 ? GRID_HEIGHT : BAR_HEIGHT;
    const kind = display === "PLAYER" && hits.remaining === 0 ? "LABEL" : "BILLBOARD";
    // The grid's bottom edge rests on the token's top edge at zero offset.
    const offsetY = imageHeight - hits.offsetPx * IMAGE_WIDTH / width;
    let counter = counters.get(token.id);
    if (counter && counter.kind !== kind) {
      await OBR.scene.local.deleteItems([counter.id, ...(counter.labelId ? [counter.labelId] : [])]);
      counters.delete(token.id);
      counter = undefined;
    }
    if (counter) {
      if (counter.maximum !== hits.maximum || counter.remaining !== hits.remaining ||
          counter.zeroLabel !== hits.zeroLabel ||
          counter.offsetPx !== hits.offsetPx ||
          counter.x !== x || counter.y !== y || counter.width !== width ||
          ((kind === "LABEL" || counter.labelId) && counter.viewScale !== viewScale) ||
          counter.visible !== token.visible) {
        await OBR.scene.local.updateItems([counter.id], (items) => {
          for (const item of items) {
            if (item.type === "LABEL") {
              updateZeroLabel(item as Label, hits, x, y, width, viewScale, token.visible);
            } else if (item.type === "BILLBOARD") {
              const billboard = item as Billboard;
              billboard.image.url = counterImageUrl(hits);
              billboard.image.height = imageHeight;
              billboard.grid.offset.y = offsetY;
              billboard.scale = { x: width / 100, y: width / 100 };
              billboard.position = { x, y };
              billboard.visible = token.visible;
              billboard.description = display === "GM"
                ? `${hits.remaining} of ${hits.maximum} hits remaining`
                : "Token hits bar";
            }
          }
        });
        Object.assign(counter, { maximum: hits.maximum, remaining: hits.remaining, zeroLabel: hits.zeroLabel,
          offsetPx: hits.offsetPx, x, y, width, viewScale, visible: token.visible });
      }
      if (display === "GM" && hits.remaining === 0) {
        if (counter.labelId) {
          await OBR.scene.local.updateItems([counter.labelId], (items) => {
            for (const item of items) if (item.type === "LABEL") updateZeroLabel(item as Label, hits, x, y, width, viewScale, token.visible);
          });
        } else {
          const label = makeZeroLabel(token, hits, x, y, width, viewScale);
          await OBR.scene.local.addItems([label]);
          counter.labelId = label.id;
        }
      } else if (counter.labelId) {
        await OBR.scene.local.deleteItems([counter.labelId]);
        counter.labelId = undefined;
      }
      continue;
    }
    if (kind === "LABEL") {
      const label = makeZeroLabel(token, hits, x, y, width, viewScale);
      await OBR.scene.local.addItems([label]);
      counters.set(token.id, {
        id: label.id, kind, tokenId: token.id, maximum: hits.maximum, remaining: hits.remaining,
        zeroLabel: hits.zeroLabel, offsetPx: hits.offsetPx, x, y, width, viewScale, visible: token.visible,
      });
      continue;
    }
    const billboard = buildBillboard(
      { width: IMAGE_WIDTH, height: imageHeight, mime: "image/svg+xml", url: counterImageUrl(hits) },
      { dpi: sceneDpi * IMAGE_SCALE, offset: { x: IMAGE_WIDTH / 2, y: offsetY } },
    )
      .position({ x, y })
      .scale({ x: width / 100, y: width / 100 })
      .attachedTo(token.id)
      .disableAttachmentBehavior(["ROTATION", "LOCKED", "COPY"])
      .layer("TEXT")
      .visible(token.visible)
      .locked(true)
      .disableHit(display === "PLAYER")
      .name(display === "GM" ? "Token Hit Counter" : "Token Hits Bar")
      .description(display === "GM" ? `${hits.remaining} of ${hits.maximum} hits remaining` : "Token hits bar")
      .metadata({ [`${ID}/counter`]: token.id })
      .minViewScale(1)
      .maxViewScale(1)
      .build();
    const label = hits.remaining === 0 ? makeZeroLabel(token, hits, x, y, width, viewScale) : undefined;
    await OBR.scene.local.addItems(label ? [billboard, label] : [billboard]);
    counters.set(token.id, {
      id: billboard.id, kind, labelId: label?.id, tokenId: token.id, maximum: hits.maximum, remaining: hits.remaining,
      zeroLabel: hits.zeroLabel,
      offsetPx: hits.offsetPx, viewScale,
      x, y, width, visible: token.visible,
    });
  }

  for (const { token, value } of acWanted.values()) {
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const x = bounds.max.x;
    const y = bounds.min.y;
    const badge = acBadges.get(token.id);
    if (badge) {
      if (badge.value !== value || badge.x !== x || badge.y !== y ||
          badge.visible !== token.visible) {
        await OBR.scene.local.updateItems([badge.id], (localItems) => {
          for (const item of localItems) {
            if (item.type !== "BILLBOARD") continue;
            const acBillboard = item as Billboard;
            acBillboard.image.url = new URL(`/ac-badges/${value}.svg`, window.location.origin).href;
            acBillboard.position = { x, y };
            acBillboard.visible = token.visible;
            acBillboard.description = `Armor Class ${value}`;
          }
        });
        Object.assign(badge, { value, x, y, visible: token.visible });
      }
      continue;
    }
    const billboard = buildBillboard(
      { width: AC_SIZE, height: AC_SIZE, mime: "image/svg+xml", url: new URL(`/ac-badges/${value}.svg`, window.location.origin).href },
      { dpi: sceneDpi * IMAGE_SCALE, offset: { x: AC_SIZE + AC_INSET, y: -AC_INSET } },
    )
      .position({ x, y })
      .attachedTo(token.id)
      .disableAttachmentBehavior(["ROTATION", "LOCKED", "COPY", "SCALE"])
      .layer("TEXT")
      .visible(token.visible)
      .locked(true)
      .disableHit(true)
      .name("Token Armor Class")
      .description(`Armor Class ${value}`)
      .metadata({ [`${ID}/ac-badge`]: token.id })
      .minViewScale(1)
      .maxViewScale(1)
      .build();
    await OBR.scene.local.addItems([billboard]);
    acBadges.set(token.id, { id: billboard.id, value, x, y, visible: token.visible });
  }
}
