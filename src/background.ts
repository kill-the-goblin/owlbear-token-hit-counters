import OBR from "@owlbear-rodeo/sdk";
import { clearCounters, scheduleCounterSync, tokenForCounter } from "./counters";
import { HITS_KEY, MENU_ID, MODE_ID, TOOL_ID, hitsData, readHits } from "./hits";

let clickQueue = Promise.resolve();

function adjustOne(tokenId: string, delta: -1 | 1): void {
  clickQueue = clickQueue.then(async () => {
    if (await OBR.player.getRole() !== "GM") return;
    await OBR.scene.items.updateItems(
      (item) => item.id === tokenId && item.layer === "CHARACTER",
      (items) => {
        for (const item of items) {
          const hits = readHits(item.metadata[HITS_KEY]);
          if (!hits) continue;
          const remaining = Math.max(0, Math.min(hits.maximum, hits.remaining + delta));
          if (remaining !== hits.remaining) item.metadata[HITS_KEY] = hitsData(hits.maximum, remaining);
        }
      },
    );
  }).catch((error: unknown) => {
    console.error("Could not adjust token hits", error);
    void OBR.notification.show("Could not adjust token hits.", "ERROR");
  });
}

OBR.onReady(async () => {
  if (await OBR.player.getRole() !== "GM") return;

  await OBR.contextMenu.create({
    id: MENU_ID,
    icons: [{ icon: "/icon.svg", label: "Token Hit Counters", filter: {
      max: 1, roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }],
    } }],
    embed: { url: "/menu.html", height: 62 },
  });

  await OBR.tool.createMode({
    id: MODE_ID,
    icons: [{ icon: "/icon.svg", label: "Spend or restore a hit" }],
    onToolClick(_context, event) {
      const tokenId = event.target ? tokenForCounter(event.target.id) : undefined;
      if (!tokenId) return true;
      adjustOne(tokenId, event.shiftKey ? 1 : -1);
      return false;
    },
  });
  await OBR.tool.create({
    id: TOOL_ID,
    icons: [{ icon: "/icon.svg", label: "Token Hit Counters" }],
    shortcut: "H",
    defaultMode: MODE_ID,
  });

  OBR.scene.items.onChange(scheduleCounterSync);
  OBR.scene.onReadyChange((ready) => {
    if (!ready) clearCounters();
    else void OBR.scene.items.getItems().then(scheduleCounterSync);
  });
  if (await OBR.scene.isReady()) scheduleCounterSync(await OBR.scene.items.getItems());
});
