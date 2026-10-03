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
};

export function readHits(value: unknown): Hits | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Hits>;
  if (!(data.version === 1 && Number.isSafeInteger(data.maximum) &&
    Number.isSafeInteger(data.remaining) && data.maximum! >= 1 &&
    data.maximum! <= 10 && data.remaining! >= 0 &&
    data.remaining! <= data.maximum!)) return null;
  const offsetPx = data.offsetPx ?? 0;
  if (!Number.isSafeInteger(offsetPx) || offsetPx < -200 || offsetPx > 200) return null;
  return { version: 1, maximum: data.maximum!, remaining: data.remaining!, offsetPx };
}

export function hitsData(maximum: number, remaining = maximum, settings?: Pick<Hits, "offsetPx">): Hits | null {
  return maximum === 0 ? null : {
    version: 1, maximum, remaining,
    offsetPx: settings?.offsetPx ?? 0,
  };
}
