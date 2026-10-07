import OBR, { buildBillboard, buildLabel, type Billboard, type Image, type Item, type Label, type Vector2 } from "@owlbear-rodeo/sdk";
import { AC_KEY, HITS_KEY, ID, readAC, readHits, type Hits } from "./hits";

type Counter = {
  id: string;
  kind: "BILLBOARD" | "LABEL";
  labelId?: string;
  boxIds?: string[];
  tokenId: string;
  maximum: number;
  remaining: number;
  zeroLabel: string;
  offsetPx: number;
  x: number;
  y: number;
  width: number;
  geometryKey: string;
  viewScale: number;
  visible: boolean;
};

type ACBadge = {
  id: string;
  value: number;
  x: number;
  y: number;
  geometryKey: string;
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
const BOX_IMAGE_SIZE = 18 * IMAGE_SCALE;
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

export function tokenAtGridPoint(point: Vector2): string | undefined {
  if (display !== "GM" || counters.size === 0) return undefined;
  for (const counter of counters.values()) {
    if (!counter.visible) continue;
    // These are the scene-space dimensions used to build the billboard. Owlbear's
    // reported billboard bounds do not cover its scaled, transparent grid area.
    const halfWidth = counter.width / 2;
    const bottom = counter.y + counter.offsetPx;
    const top = bottom - counter.width * (counter.maximum > 10 ? 0.6 : 0.4);
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
    return new URL(`/hit-grids/base/${hits.maximum}.svg?v=2`, window.location.origin).href;
  }
  const divisor = gcd(hits.remaining, hits.maximum);
  const fraction = `${hits.remaining / divisor}-${hits.maximum / divisor}`;
  return new URL(`/player-bars/${counterColor(hits)}/${fraction}.svg`, window.location.origin).href;
}

function boxPosition(maximum: number, index: number): Vector2 {
  if (maximum <= 5) return { x: 1 + (5 - maximum) * 10 + index * 20, y: 21 };
  const rows = maximum <= 10 ? 2 : 3;
  const counts = Array.from({ length: rows }, () => Math.floor(maximum / rows));
  for (let extra = maximum % rows, row = rows - 1; extra > 0; extra -= 1, row -= 1) counts[row] += 1;
  let remainingIndex = index;
  for (let row = rows - 1; row >= 0; row -= 1) {
    if (remainingIndex < counts[row]) {
      return { x: 1 + (5 - counts[row]) * 10 + remainingIndex * 20, y: 1 + row * 20 };
    }
    remainingIndex -= counts[row];
  }
  throw new Error(`Invalid hit box ${index} of ${maximum}`);
}

function boxOffset(maximum: number, index: number, width: number, offsetPx: number): Vector2 {
  const position = boxPosition(maximum, index);
  const gridHeight = maximum > 10 ? 60 : 40;
  return {
    x: (50.5 - position.x) * IMAGE_SCALE,
    y: (gridHeight - position.y + 0.5) * IMAGE_SCALE - offsetPx * IMAGE_WIDTH / width,
  };
}

function boxImageUrl(hits: Hits, index: number): string {
  const state = hits.remaining === 0 ? "gray" : index < hits.remaining ? counterColor(hits) : "empty";
  return new URL(`/hit-grids/box/${state}.svg${state === "gray" ? "?v=2" : ""}`, window.location.origin).href;
}

function counterSize(tokenWidth: number, sceneDpi: number): number {
  return tokenWidth / sceneDpi * 100;
}

function tokenGeometryKey(token: Item): string {
  const image = token.type === "IMAGE" ? token as Image : undefined;
  return JSON.stringify({
    position: token.position, scale: token.scale, rotation: token.rotation,
    image: image?.image, grid: image?.grid,
  });
}

function makeBox(token: Item, hits: Hits, index: number, x: number, y: number, width: number, sceneDpi: number): Billboard {
  return buildBillboard(
    { width: BOX_IMAGE_SIZE, height: BOX_IMAGE_SIZE, mime: "image/svg+xml", url: boxImageUrl(hits, index) },
    { dpi: sceneDpi * IMAGE_SCALE, offset: boxOffset(hits.maximum, index, width, hits.offsetPx) },
  )
    .position({ x, y })
    .scale({ x: width / 100, y: width / 100 })
    .attachedTo(token.id)
    .disableAttachmentBehavior(["ROTATION", "LOCKED", "COPY", "VISIBLE"])
    .layer("TEXT")
    .visible(true)
    .locked(true)
    .disableHit(true)
    .name("Token Hit Box")
    .metadata({ [`${ID}/counter`]: token.id })
    .minViewScale(1)
    .maxViewScale(1)
    .build();
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
    .disableAttachmentBehavior(display === "GM" ? ["ROTATION", "LOCKED", "COPY", "VISIBLE"] : ["ROTATION", "LOCKED", "COPY"])
    .layer("TEXT")
    .visible(display === "GM" || token.visible)
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
    await OBR.scene.local.deleteItems(obsolete.flatMap((counter) => [counter.id, ...(counter.labelId ? [counter.labelId] : []), ...(counter.boxIds ?? [])]));
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
    const visible = display === "GM" || token.visible;
    const geometryKey = tokenGeometryKey(token);
    let counter = counters.get(token.id);
    const bounds = counter?.geometryKey === geometryKey ? undefined : await OBR.scene.items.getItemBounds([token.id]);
    const x = bounds ? bounds.min.x + bounds.width / 2 : counter!.x;
    const y = bounds ? bounds.min.y : counter!.y;
    const width = bounds ? counterSize(bounds.width, sceneDpi) : counter!.width;
    const imageHeight = display === "GM"
      ? hits.maximum > 10 ? THREE_ROW_GRID_HEIGHT : GRID_HEIGHT
      : hits.remaining === 0 ? GRID_HEIGHT : BAR_HEIGHT;
    const kind = display === "PLAYER" && hits.remaining === 0 ? "LABEL" : "BILLBOARD";
    // The grid's bottom edge rests on the token's top edge at zero offset.
    const offsetY = imageHeight - hits.offsetPx * IMAGE_WIDTH / width;
    if (counter && counter.kind !== kind) {
      await OBR.scene.local.deleteItems([counter.id, ...(counter.labelId ? [counter.labelId] : []), ...(counter.boxIds ?? [])]);
      counters.delete(token.id);
      counter = undefined;
    }
    if (counter) {
      const maximumChanged = counter.maximum !== hits.maximum;
      const remainingChanged = counter.remaining !== hits.remaining;
      const zeroLabelChanged = counter.zeroLabel !== hits.zeroLabel;
      const viewScaleChanged = counter.viewScale !== viewScale;
      const visibilityChanged = counter.visible !== visible;
      const geometryChanged = counter.offsetPx !== hits.offsetPx || counter.x !== x || counter.y !== y || counter.width !== width;
      const colorChanged = display === "GM" && counterColor({ ...hits, maximum: counter.maximum, remaining: counter.remaining }) !== counterColor(hits);
      if (counter.maximum !== hits.maximum || counter.remaining !== hits.remaining ||
          zeroLabelChanged ||
          geometryChanged ||
          ((kind === "LABEL" || counter.labelId) && viewScaleChanged) ||
          visibilityChanged) {
        await OBR.scene.local.updateItems([counter.id], (items) => {
          for (const item of items) {
            if (item.type === "LABEL") {
              updateZeroLabel(item as Label, hits, x, y, width, viewScale, visible);
            } else if (item.type === "BILLBOARD") {
              const billboard = item as Billboard;
              const nextUrl = counterImageUrl(hits);
              if (billboard.image.url !== nextUrl) billboard.image.url = nextUrl;
              if (billboard.image.height !== imageHeight) billboard.image.height = imageHeight;
              if (geometryChanged || maximumChanged) {
                billboard.grid.offset.y = offsetY;
                billboard.scale = { x: width / 100, y: width / 100 };
                billboard.position = { x, y };
              }
              if (visibilityChanged) billboard.visible = visible;
              billboard.description = display === "GM"
                ? `${hits.remaining} of ${hits.maximum} hits remaining`
                : "Token hits bar";
            }
          }
        });
      }
      if (display === "GM") {
        if (maximumChanged || !counter.boxIds) {
          if (counter.boxIds?.length) await OBR.scene.local.deleteItems(counter.boxIds);
          const boxes = Array.from({ length: hits.maximum }, (_, index) => makeBox(token, hits, index, x, y, width, sceneDpi));
          await OBR.scene.local.addItems(boxes);
          counter.boxIds = boxes.map((box) => box.id);
        } else if (remainingChanged || colorChanged || geometryChanged || visibilityChanged) {
          const zeroTransition = (counter.remaining === 0) !== (hits.remaining === 0);
          const ids = counter.boxIds.filter((_, index) => geometryChanged || zeroTransition || (colorChanged && index < hits.remaining) ||
            (index < counter.remaining) !== (index < hits.remaining));
          const indices = new Map(counter.boxIds.map((id, index) => [id, index]));
          if (ids.length) await OBR.scene.local.updateItems(ids, (items) => {
            for (const item of items) {
              if (item.type !== "BILLBOARD") continue;
              const box = item as Billboard;
              const index = indices.get(box.id);
              if (index === undefined) continue;
              const nextUrl = boxImageUrl(hits, index);
              if (box.image.url !== nextUrl) box.image.url = nextUrl;
              if (geometryChanged) {
                box.grid.offset = boxOffset(hits.maximum, index, width, hits.offsetPx);
                box.position = { x, y };
                box.scale = { x: width / 100, y: width / 100 };
              }
            }
          });
        }
      }
      Object.assign(counter, { maximum: hits.maximum, remaining: hits.remaining, zeroLabel: hits.zeroLabel,
        offsetPx: hits.offsetPx, x, y, width, geometryKey, viewScale, visible });
      if (counter.labelId) {
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
        zeroLabel: hits.zeroLabel, offsetPx: hits.offsetPx, x, y, width, geometryKey, viewScale, visible,
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
      .disableAttachmentBehavior(display === "GM" ? ["ROTATION", "LOCKED", "COPY", "VISIBLE"] : ["ROTATION", "LOCKED", "COPY"])
      .layer("TEXT")
      .visible(visible)
      .locked(true)
      .disableHit(display === "PLAYER")
      .name(display === "GM" ? "Token Hit Counter" : "Token Hits Bar")
      .description(display === "GM" ? `${hits.remaining} of ${hits.maximum} hits remaining` : "Token hits bar")
      .metadata({ [`${ID}/counter`]: token.id })
      .minViewScale(1)
      .maxViewScale(1)
      .build();
    const boxes = display === "GM"
      ? Array.from({ length: hits.maximum }, (_, index) => makeBox(token, hits, index, x, y, width, sceneDpi))
      : [];
    await OBR.scene.local.addItems([billboard, ...boxes]);
    counters.set(token.id, {
      id: billboard.id, kind, boxIds: boxes.map((box) => box.id), tokenId: token.id, maximum: hits.maximum, remaining: hits.remaining,
      zeroLabel: hits.zeroLabel,
      offsetPx: hits.offsetPx, geometryKey, viewScale,
      x, y, width, visible,
    });
  }

  for (const { token, value } of acWanted.values()) {
    const badge = acBadges.get(token.id);
    const geometryKey = tokenGeometryKey(token);
    if (badge && badge.geometryKey === geometryKey && badge.value === value && badge.visible === token.visible) continue;
    const bounds = badge?.geometryKey === geometryKey ? undefined : await OBR.scene.items.getItemBounds([token.id]);
    const x = bounds ? bounds.max.x : badge!.x;
    const y = bounds ? bounds.min.y : badge!.y;
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
        Object.assign(badge, { value, x, y, geometryKey, visible: token.visible });
      }
      badge.geometryKey = geometryKey;
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
    acBadges.set(token.id, { id: billboard.id, value, x, y, geometryKey, visible: token.visible });
  }
}
