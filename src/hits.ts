import palette from "./palette.json";

export const ID = "com.nealenssle.obr-token-hits";
export const HITS_KEY = `${ID}/hits`;
export const MENU_ID = `${ID}/menu`;
export const TOOL_ID = `${ID}/tool`;
export const MODE_ID = `${ID}/mode`;

export type Hits = {
  version: 1;
  maximum: number;
  remaining: number;
  offsetPx: number;
  color: string;
};

export const HIT_COLORS = palette;
export const DEFAULT_COLOR = "red";

export function isHitColor(value: unknown): value is string {
  return typeof value === "string" && palette.some((color) => color.id === value);
}

export function readHits(value: unknown): Hits | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Hits>;
  if (!(data.version === 1 && Number.isSafeInteger(data.maximum) &&
    Number.isSafeInteger(data.remaining) && data.maximum! >= 1 &&
    data.maximum! <= 10 && data.remaining! >= 0 &&
    data.remaining! <= data.maximum!)) return null;
  const offsetPx = data.offsetPx ?? 0;
  const color = data.color ?? DEFAULT_COLOR;
  if (!Number.isSafeInteger(offsetPx) || offsetPx < -200 || offsetPx > 200 || !isHitColor(color)) return null;
  return { version: 1, maximum: data.maximum!, remaining: data.remaining!, offsetPx, color };
}

export function hitsData(maximum: number, remaining = maximum, settings?: Pick<Hits, "offsetPx" | "color">): Hits | null {
  return maximum === 0 ? null : {
    version: 1, maximum, remaining,
    offsetPx: settings?.offsetPx ?? 0,
    color: settings?.color ?? DEFAULT_COLOR,
  };
}
