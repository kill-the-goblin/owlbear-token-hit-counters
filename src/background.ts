import OBR from "@owlbear-rodeo/sdk";

const ID = "com.nealenssle.obr-token-hp";
const TOOL_ID = `${ID}/tool`;
const MODE_ID = `${ID}/mode`;

OBR.onReady(async () => {
  if (await OBR.player.getRole() !== "GM") return;

  await OBR.tool.createMode({
    id: MODE_ID,
    icons: [{ icon: "/icon.svg", label: "Adjust HP" }],
  });
  await OBR.tool.create({
    id: TOOL_ID,
    icons: [{ icon: "/icon.svg", label: "Token HP" }],
    shortcut: "H",
    defaultMode: MODE_ID,
  });
});
