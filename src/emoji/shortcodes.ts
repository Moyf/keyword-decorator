import { EMOJI_SHORTCODES } from "./data";

/** Exact, case-sensitive shortcodes; unknown names leave the note unchanged. */
export function lookupEmojiShortcode(shortcode: string): string | undefined {
  if (!/^:[a-z0-9_+-]+:$/.test(shortcode)) return undefined;
  const name = shortcode.slice(1, -1);
  return Object.prototype.hasOwnProperty.call(EMOJI_SHORTCODES, name) ? EMOJI_SHORTCODES[name] : undefined;
}
