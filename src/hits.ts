export const ID = "com.nealenssle.obr-token-hits";
export const HITS_KEY = `${ID}/hits`;
export const AC_KEY = `${ID}/ac`;
export const MENU_ID = `${ID}/menu`;
export const TOOL_ID = `${ID}/tool`;
export const MODE_ID = `${ID}/mode`;
export const DEFAULT_ZERO_LABEL = "DEAD";
export const MAX_ZERO_LABEL_LENGTH = 16;
export const MAX_HITS = 15;
export const MAX_HP_PER_BOX = 999;
export const DEFAULT_OFFSET_PX = 0;
export const DEFAULT_HP_PER_BOX = 5;
const LEGACY_HP_PER_BOX = 1;

export function readAC(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 99
    ? value as number : null;
}

export type Hits = {
  version: 1;
  maximum: number;
  remaining: number;
  offsetPx: number;
  zeroLabel: string;
  hpPerBox: number;
};

export function readHits(value: unknown): Hits | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<Hits>;
  if (!(data.version === 1 && Number.isSafeInteger(data.maximum) &&
    Number.isSafeInteger(data.remaining) && data.maximum! >= 1 &&
    data.maximum! <= MAX_HITS && data.remaining! >= 0 &&
    data.remaining! <= data.maximum!)) return null;
  const offsetPx = data.offsetPx ?? DEFAULT_OFFSET_PX;
  if (!Number.isSafeInteger(offsetPx) || offsetPx < -200 || offsetPx > 200) return null;
  const zeroLabel = (data.zeroLabel ?? DEFAULT_ZERO_LABEL);
  if (typeof zeroLabel !== "string" || !zeroLabel.trim() ||
      Array.from(zeroLabel).length > MAX_ZERO_LABEL_LENGTH || /[\x00-\x1f\x7f]/.test(zeroLabel)) return null;
  const hpPerBox = data.hpPerBox ?? LEGACY_HP_PER_BOX;
  if (!Number.isSafeInteger(hpPerBox) || hpPerBox < 1 || hpPerBox > MAX_HP_PER_BOX) return null;
  return { version: 1, maximum: data.maximum!, remaining: data.remaining!, offsetPx, zeroLabel: zeroLabel.toUpperCase(), hpPerBox };
}

export function hitsData(maximum: number, remaining = maximum, settings?: Pick<Hits, "offsetPx" | "zeroLabel" | "hpPerBox">): Hits | null {
  return maximum === 0 ? null : {
    version: 1, maximum, remaining,
    offsetPx: settings?.offsetPx ?? DEFAULT_OFFSET_PX,
    zeroLabel: (settings?.zeroLabel ?? DEFAULT_ZERO_LABEL).toUpperCase(),
    hpPerBox: settings?.hpPerBox ?? DEFAULT_HP_PER_BOX,
  };
}
