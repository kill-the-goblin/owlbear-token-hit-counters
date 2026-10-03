export const ID = "com.nealenssle.obr-token-hits";
export const HITS_KEY = `${ID}/hits`;
export const MENU_ID = `${ID}/menu`;
export const TOOL_ID = `${ID}/tool`;
export const MODE_ID = `${ID}/mode`;
export const DEFAULT_ZERO_LABEL = "DEAD";
export const MAX_ZERO_LABEL_LENGTH = 16;

export type Hits = {
  version: 1;
  maximum: number;
  remaining: number;
  offsetPx: number;
  zeroLabel: string;
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
  const zeroLabel = (data.zeroLabel ?? DEFAULT_ZERO_LABEL);
  if (typeof zeroLabel !== "string" || !zeroLabel.trim() ||
      Array.from(zeroLabel).length > MAX_ZERO_LABEL_LENGTH || /[\x00-\x1f\x7f]/.test(zeroLabel)) return null;
  return { version: 1, maximum: data.maximum!, remaining: data.remaining!, offsetPx, zeroLabel: zeroLabel.toUpperCase() };
}

export function hitsData(maximum: number, remaining = maximum, settings?: Pick<Hits, "offsetPx" | "zeroLabel">): Hits | null {
  return maximum === 0 ? null : {
    version: 1, maximum, remaining,
    offsetPx: settings?.offsetPx ?? 0,
    zeroLabel: (settings?.zeroLabel ?? DEFAULT_ZERO_LABEL).toUpperCase(),
  };
}
