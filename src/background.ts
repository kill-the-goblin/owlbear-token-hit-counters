import OBR, { type ToolEvent } from "@owlbear-rodeo/sdk";
import { clearCounters, scheduleCounterSync, setCounterDisplay, syncCounterViewport, tokenAtGridPoint, tokenForCounter } from "./counters";
import { HITS_KEY, MENU_ID, MODE_ID, TOOL_ID, hitsData, readHits } from "./hits";

const pendingDeltas = new Map<string, number>();
const adjusting = new Set<string>();
let recentSingles: { tokenId: string; shiftKey: boolean; time: number }[] = [];

function adjustOne(tokenId: string, delta: -1 | 1): void {
  pendingDeltas.set(tokenId, (pendingDeltas.get(tokenId) ?? 0) + delta);
  if (!adjusting.has(tokenId)) void flushClicks(tokenId);
}

async function flushClicks(tokenId: string): Promise<void> {
  adjusting.add(tokenId);
  try {
    while (pendingDeltas.has(tokenId)) {
      const delta = pendingDeltas.get(tokenId)!;
      pendingDeltas.delete(tokenId);
      if (delta === 0 || await OBR.player.getRole() !== "GM") continue;
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
    }
  } catch (error: unknown) {
    console.error("Could not adjust token hits", error);
    void OBR.notification.show("Could not adjust token hits.", "ERROR");
  } finally {
    adjusting.delete(tokenId);
    if (pendingDeltas.has(tokenId)) void flushClicks(tokenId);
  }
}

function handleCounterClick(event: ToolEvent, doubleClick = false): boolean {
  const tokenId = (event.target ? tokenForCounter(event.target.id) : undefined) ??
    tokenAtGridPoint(event.pointerPosition);
  if (!tokenId) return true;
  const now = Date.now();
  recentSingles = recentSingles.filter((click) => now - click.time < 500);
  if (doubleClick) {
    const prior = recentSingles.filter((click) => click.tokenId === tokenId && click.shiftKey === event.shiftKey).length;
    for (let index = prior; index < 2; index += 1) adjustOne(tokenId, event.shiftKey ? 1 : -1);
    recentSingles = [];
  } else {
    recentSingles.push({ tokenId, shiftKey: event.shiftKey, time: now });
    adjustOne(tokenId, event.shiftKey ? 1 : -1);
  }
  return false;
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
      id: MODE_ID,
      icons: [{ icon: "/icon.svg", label: "Spend or restore a hit", filter: { activeTools: [TOOL_ID] } }],
      onToolClick(_context, event) { return handleCounterClick(event); },
      onToolDoubleClick(_context, event) { return handleCounterClick(event, true); },
    });
    await OBR.tool.create({
      id: TOOL_ID,
      icons: [{ icon: "/icon.svg", label: "Token Hit Counters" }],
      shortcut: "C",
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
