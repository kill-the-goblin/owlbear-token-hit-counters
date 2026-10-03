export const ID = "com.nealenssle.obr-token-hp";
export const HP_KEY = `${ID}/hp`;
export const MENU_ID = `${ID}/menu`;
export const TOOL_ID = `${ID}/tool`;
export const MODE_ID = `${ID}/mode`;

export function readHp(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { version?: unknown; current?: unknown };
  return data.version === 1 && typeof data.current === "number" &&
    Number.isSafeInteger(data.current) && data.current >= 0 ? data.current : null;
}

export function hpData(current: number | null): { version: 1; current: number } | null {
  return current === null ? null : { version: 1, current };
}
