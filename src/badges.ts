import OBR, { buildLabel, type Item, type Label } from "@owlbear-rodeo/sdk";
import { HP_KEY, ID, readHp } from "./hp";

type Badge = { id: string; tokenId: string; hp: number; x: number; y: number; visible: boolean };
const badges = new Map<string, Badge>();
let latestItems: Item[] | null = null;
let syncing = false;

export function tokenForBadge(labelId: string): string | undefined {
  for (const badge of badges.values()) if (badge.id === labelId) return badge.tokenId;
  return undefined;
}

export function clearBadges(): void {
  badges.clear();
  latestItems = null;
}

export function scheduleBadgeSync(items: Item[]): void {
  latestItems = items;
  if (!syncing) void syncBadges();
}

async function syncBadges(): Promise<void> {
  syncing = true;
  try {
    while (latestItems !== null) {
      const snapshot = latestItems;
      latestItems = null;
      await reconcile(snapshot);
    }
  } catch (error) {
    console.error("Token HP badge sync failed", error);
  } finally {
    syncing = false;
    if (latestItems !== null) void syncBadges();
  }
}

async function reconcile(items: Item[]): Promise<void> {
  const wanted = new Map<string, { token: Item; hp: number }>();
  for (const token of items) {
    if (token.layer !== "CHARACTER") continue;
    const hp = readHp(token.metadata[HP_KEY]);
    if (hp !== null) wanted.set(token.id, { token, hp });
  }

  const obsolete = [...badges.values()].filter((badge) => !wanted.has(badge.tokenId));
  if (obsolete.length) {
    await OBR.scene.local.deleteItems(obsolete.map((badge) => badge.id));
    for (const badge of obsolete) badges.delete(badge.tokenId);
  }

  for (const { token, hp } of wanted.values()) {
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const x = bounds.max.x - bounds.width * 0.12;
    const y = bounds.min.y + bounds.height * 0.12;
    const badge = badges.get(token.id);
    if (badge) {
      if (badge.hp !== hp || badge.x !== x || badge.y !== y || badge.visible !== token.visible) {
        await OBR.scene.local.updateItems([badge.id], (labels) => {
          for (const item of labels) {
            if (item.type !== "LABEL") continue;
            const label = item as Label;
            label.text.plainText = String(hp);
            label.position = { x, y };
            label.visible = token.visible;
          }
        });
        badge.hp = hp;
        badge.x = x;
        badge.y = y;
        badge.visible = token.visible;
      }
      continue;
    }
    const label = buildLabel()
      .plainText(String(hp))
      .position({ x, y })
      .layer("TEXT")
      .visible(token.visible)
      .locked(true)
      .name("Token HP")
      .description(`GM-only hit points: ${hp}`)
      .metadata({ [`${ID}/badge`]: token.id })
      .backgroundColor("#b42333")
      .fillColor("#ffffff")
      .cornerRadius(8)
      .minViewScale(0.01)
      .maxViewScale(100)
      .pointerWidth(0)
      .pointerHeight(0)
      .fontSize(12)
      .fontWeight(700)
      .height(16)
      .padding(2)
      .build();
    await OBR.scene.local.addItems([label]);
    badges.set(token.id, { id: label.id, tokenId: token.id, hp, x, y, visible: token.visible });
  }
}
