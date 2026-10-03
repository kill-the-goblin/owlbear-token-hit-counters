import OBR from "@owlbear-rodeo/sdk";
import { clearCounters, scheduleCounterSync, setCounterDisplay, syncCounterViewport, tokenAtGridPoint, tokenForCounter } from "./counters";
import { HITS_KEY, MENU_ID, MODE_ID, MOVE_MODE_ID, TOOL_ID, hitsData, readHits } from "./hits";

const POINTER_TOOL_ID = "rodeo.owlbear.tools/pointer";

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
          if (remaining !== hits.remaining) item.metadata[HITS_KEY] = hitsData(hits.maximum, remaining, hits);
        }
      },
    );
  }).catch((error: unknown) => {
    console.error("Could not adjust token hits", error);
    void OBR.notification.show("Could not adjust token hits.", "ERROR");
  });
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  setCounterDisplay(role);

  if (role === "GM") {
    await OBR.contextMenu.create({
      id: MENU_ID,
      icons: [{ icon: "/icon.svg", label: "Token Hit Counters", filter: {
        max: 1, roles: ["GM"], every: [{ key: "layer", value: "CHARACTER" }],
      } }],
      embed: { url: "/menu.html", height: 80 },
    });

    await OBR.tool.createMode({
      id: MOVE_MODE_ID,
      icons: [{ icon: "/move.svg", label: "Move", filter: { activeTools: [TOOL_ID] } }],
    });

    await OBR.tool.createMode({
      id: MODE_ID,
      icons: [{ icon: "/icon.svg", label: "Spend or restore a hit", filter: { activeTools: [POINTER_TOOL_ID, TOOL_ID] } }],
      async onToolClick(_context, event) {
        const tokenId = await tokenAtGridPoint(event.pointerPosition) ??
          (event.target ? tokenForCounter(event.target.id) : undefined);
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
  }

  OBR.scene.items.onChange(scheduleCounterSync);
  OBR.player.onChange(async () => {
    setCounterDisplay(await OBR.player.getRole());
    if (await OBR.scene.isReady()) scheduleCounterSync(await OBR.scene.items.getItems());
  });
  OBR.scene.onReadyChange((ready) => {
    if (!ready) clearCounters();
    else void OBR.scene.items.getItems().then(scheduleCounterSync);
  });
  if (await OBR.scene.isReady()) scheduleCounterSync(await OBR.scene.items.getItems());
  setInterval(() => { void syncCounterViewport(); }, 200);
});
