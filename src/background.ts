import OBR from "@owlbear-rodeo/sdk";
import { clearBadges, scheduleBadgeSync, tokenForBadge } from "./badges";
import { HP_KEY, MENU_ID, MODE_ID, TOOL_ID, hpData, readHp } from "./hp";

let clickQueue = Promise.resolve();

function adjustOne(tokenId: string, delta: -1 | 1): void {
  clickQueue = clickQueue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems((item) => item.id === tokenId && item.layer === "CHARACTER", (items) => {
      for (const item of items) {
        const hp = readHp(item.metadata[HP_KEY]);
        if (hp !== null && (delta < 0 ? hp > 0 : hp < Number.MAX_SAFE_INTEGER)) {
          item.metadata[HP_KEY] = hpData(hp + delta);
        }
      }
    });
  }).catch((error: unknown) => {
    console.error("Could not adjust token HP", error);
    void OBR.notification.show("Could not adjust token HP.", "ERROR");
  });
}

OBR.onReady(async () => {
  if (await OBR.player.getRole() !== "GM") return;

  await OBR.contextMenu.create({
    id: MENU_ID,
    icons: [{ icon: "/icon.svg", label: "Token HP", filter: {
      max: 1, roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }],
    } }],
    embed: { url: "/menu.html", height: 46 },
  });

  await OBR.tool.createMode({
    id: MODE_ID,
    icons: [{ icon: "/icon.svg", label: "Adjust HP" }],
    onToolClick(_context, event) {
      const tokenId = event.target ? tokenForBadge(event.target.id) : undefined;
      if (!tokenId) return true;
      adjustOne(tokenId, event.shiftKey ? 1 : -1);
      return false;
    },
  });
  await OBR.tool.create({
    id: TOOL_ID,
    icons: [{ icon: "/icon.svg", label: "Token HP" }],
    shortcut: "H",
    defaultMode: MODE_ID,
  });

  OBR.scene.items.onChange(scheduleBadgeSync);
  OBR.scene.onReadyChange((ready) => {
    if (!ready) clearBadges();
    else void OBR.scene.items.getItems().then(scheduleBadgeSync);
  });
  if (await OBR.scene.isReady()) scheduleBadgeSync(await OBR.scene.items.getItems());
});
