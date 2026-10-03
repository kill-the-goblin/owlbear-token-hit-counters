import OBR, { buildLabel, type Item } from "@owlbear-rodeo/sdk";
import { HP_KEY, ID, readHp } from "./hp";

type Badge = { id: string; tokenId: string; hp: number };
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
    const badge = badges.get(token.id);
    if (badge) {
      if (badge.hp !== hp) {
        await OBR.scene.local.updateItems([badge.id], (labels) => {
          for (const label of labels) if (label.type === "LABEL") label.text.plainText = String(hp);
        });
        badge.hp = hp;
      }
      continue;
    }
    const bounds = await OBR.scene.items.getItemBounds([token.id]);
    const label = buildLabel()
      .plainText(String(hp))
      .position({ x: bounds.max.x - bounds.width * 0.12, y: bounds.min.y + bounds.height * 0.12 })
      .attachedTo(token.id)
      .layer("ATTACHMENT")
      .locked(true)
      .name("Token HP")
      .description(`GM-only hit points: ${hp}`)
      .metadata({ [`${ID}/badge`]: token.id })
      .backgroundColor("#b42333")
      .fillColor("#ffffff")
      .cornerRadius(8)
      .pointerWidth(0)
      .pointerHeight(0)
      .fontSize(14)
      .fontWeight(700)
      .padding(5)
      .build();
    await OBR.scene.local.addItems([label]);
    badges.set(token.id, { id: label.id, tokenId: token.id, hp });
  }
}
