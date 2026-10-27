/** Numeric limits for image marker sizes: px values stay within the classic bounds, em values scale with the font. */
export const MAX_IMAGE_DIMENSION = 512;
export const MAX_IMAGE_EM_DIMENSION = 32;

// JSON Schema has no regexp flags or numeric coercion: spell out the units
// and bounded numeric forms accepted by parseImageSize (including leading zeros).
const pxAmount = "0*(?:[1-9]\\d?|[1-4]\\d{2}|50\\d|51[0-2])(?:\\.0+)?";
const emAmount = "(?:0+\\.\\d*[1-9]\\d*|0*(?:[1-9]|[12]\\d|3[01])(?:\\.\\d+)?|0*32(?:\\.0+)?)";
export const IMAGE_SIZE_PATTERN = `^\\s*(?:${pxAmount}(?:[pP][xX])?|${emAmount}[eE][mM])\\s*$`;

export interface ImageSize {
  amount: number;
  unit: "px" | "em";
}

/** Parse a size written as a number, "24", "24px" or "1.5em"; a missing unit means px. */
export function parseImageSize(value: unknown): ImageSize | null {
  if (typeof value === "number") {
    return isPxAmount(value) ? { amount: value, unit: "px" } : null;
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|em)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2] ? (match[2].toLowerCase() as "px" | "em") : "px";
  if (unit === "em") return amount <= MAX_IMAGE_EM_DIMENSION ? { amount, unit } : null;
  return isPxAmount(amount) ? { amount, unit } : null;
}

function isPxAmount(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0 && value <= MAX_IMAGE_DIMENSION;
}

/** Store px sizes as numbers and em sizes as unit strings so existing data files stay unchanged. */
export function toStoredImageSize(size: ImageSize): number | string {
  return size.unit === "px" ? size.amount : `${size.amount}em`;
}

export function formatImageSize(value: number | string | undefined): string {
  if (value === undefined) return "";
  return String(value);
}
