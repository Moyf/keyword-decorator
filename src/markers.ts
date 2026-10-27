import { App, setIcon, TFile } from "obsidian";
import { ImageSize, parseImageSize } from "./image-size";

export interface MarkerRule {
  prefixType?: string;
  prefixValue?: string;
  prefixValues?: Partial<Record<string, string>>;
  textColor?: string | null;
  iconInheritColor?: boolean;
  backgroundIncludesMarker?: boolean;
  color?: string | null;
  imageWidth?: number | string;
  imageHeight?: number | string;
  imageCornerRadius?: number | string;
}

const imageCache = new WeakMap<App, Map<string, string>>();
const sanitizedSvgCache = new WeakMap<Document, Map<string, SVGSVGElement | null>>();
const failedImageSources = new WeakMap<App, Set<string>>();
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MAX_SVG_CACHE_ENTRIES = 64;
const MAX_SVG_SOURCE_LENGTH = 50_000;
const ALLOWED_SVG_ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "title", "desc", "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern", "symbol", "use",
]);
const ALLOWED_SVG_GRAPHICS = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "use"]);
const ALLOWED_SVG_ATTRIBUTES = new Set([
  "id", "viewbox", "width", "height", "preserveaspectratio", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform", "spreadmethod", "clip-path", "clip-rule", "mask", "font-size", "font-family", "font-weight", "text-anchor", "dominant-baseline", "dx", "dy", "href", "xlink:href", "role", "aria-label", "aria-hidden",
]);

export function clearImageCache(app: App) {
  imageCache.delete(app);
  failedImageSources.delete(app);
}

export function isImageSourceFailed(app: App, input: string): boolean {
  const src = resolveImage(app, input);
  return !!src && !!failedImageSources.get(app)?.has(src);
}

export function isSvgMarkupValid(doc: Document, source: string): boolean {
  return !!getSanitizedSvgTemplate(doc, source);
}

function getSanitizedSvgTemplate(doc: Document, input: string): SVGSVGElement | null {
  const source = input.trim();
  if (!source || source.length > MAX_SVG_SOURCE_LENGTH || /<!doctype|<!entity/i.test(source)) return null;
  let cache = sanitizedSvgCache.get(doc);
  if (!cache) sanitizedSvgCache.set(doc, (cache = new Map<string, SVGSVGElement | null>()));
  if (cache.has(source)) return cache.get(source) || null;
  let template: SVGSVGElement | null = null;
  const Parser = doc.defaultView?.DOMParser;
  if (Parser) {
    try {
      const opening = source.match(/^<svg\b[^>]*>/i)?.[0];
      const normalized = opening && !/\sxmlns\s*=/.test(opening)
        ? source.replace(opening, opening.replace(/>$/, ` xmlns="${SVG_NAMESPACE}">`))
        : source;
      const parsed = new Parser().parseFromString(normalized, "image/svg+xml");
      const root = parsed.documentElement;
      if (root.localName.toLowerCase() === "svg" && root.namespaceURI === SVG_NAMESPACE && !parsed.querySelector("parsererror")) {
        for (const element of Array.from(root.querySelectorAll("*"))) {
          if (element.namespaceURI !== SVG_NAMESPACE || !ALLOWED_SVG_ELEMENTS.has(element.localName.toLowerCase())) element.remove();
        }
        for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
          for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim();
            if (!ALLOWED_SVG_ATTRIBUTES.has(name) || ((name === "href" || name.endsWith(":href")) && value && !value.startsWith("#")) || /(?:javascript:|data:|https?:|file:)|url\s*\(\s*(?!#)/i.test(value)) {
              element.removeAttribute(attribute.name);
            }
          }
        }
        if (Array.from(root.querySelectorAll("*")).some(element => ALLOWED_SVG_GRAPHICS.has(element.localName.toLowerCase()))) {
          template = root as unknown as SVGSVGElement;
        }
      }
    } catch { template = null; }
  }
  if (cache.size >= MAX_SVG_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(source, template);
  return template;
}

export function resolveImage(app: App, input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:/i.test(trimmed)) return normalizeImageUrl(trimmed);
  if (/^(data:|app:|file:)/i.test(trimmed)) return trimmed;
  let cache = imageCache.get(app);
  if (!cache) imageCache.set(app, (cache = new Map<string, string>()));
  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached;
  const normalized = trimmed.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  const file = app.metadataCache.getFirstLinkpathDest(normalized, "");
  if (file instanceof TFile) {
    const src = app.vault.getResourcePath(file);
    if (cache.size >= 256) cache.delete(cache.keys().next().value as string);
    cache.set(trimmed, src);
    return src;
  }
  if (cache.size >= 256) cache.delete(cache.keys().next().value as string);
  cache.set(trimmed, "");
  return "";
}

export function createPrefixNode(app: App, doc: Document, rule: MarkerRule, onImageError?: () => void): HTMLElement | null {
  const type = rule.prefixType;
  if (!type || type === "none") return null;
  const value = rule.prefixValue ?? rule.prefixValues?.[type] ?? "";
  const prefix = doc.adoptNode(createSpan());
  prefix.addClass("keyword-decorator-prefix");
  prefix.dataset.kdIconInheritColor = String(rule.iconInheritColor !== false);
  const prefixStyles: Record<string, string> = {};
  if (rule.backgroundIncludesMarker && rule.color) prefixStyles["background-color"] = rule.color;
  if (rule.iconInheritColor !== false && rule.textColor) prefixStyles.color = rule.textColor;
  prefix.setCssProps(prefixStyles);
  if (type === "emoji") {
    prefix.textContent = value || "✨";
    return prefix;
  }
  if (type === "icon") {
    setIcon(prefix, value || "sparkles");
    if (rule.iconInheritColor === false) prefix.setCssProps({ color: "var(--text-normal)" });
    return prefix;
  }
  if (type === "svg") {
    const source = value.trim();
    try {
      const template = getSanitizedSvgTemplate(doc, source);
      if (!template) return null;
      const width = markerSize(rule.imageWidth), height = markerSize(rule.imageHeight);
      const importedSvg = doc.importNode(template, true);
      importedSvg.setAttribute("aria-hidden", "true");
      importedSvg.style.width = sizeCss(width);
      importedSvg.style.height = sizeCss(height);
      for (const [attribute, size] of [["width", width], ["height", height]] as const) {
        // Length attributes only understand device units; em sizes stay in the style layer.
        if (size.unit === "px") importedSvg.setAttribute(attribute, String(size.amount));
        else importedSvg.removeAttribute(attribute);
      }
      applyCornerRadius(importedSvg, rule.imageCornerRadius);
      prefix.appendChild(importedSvg);
      prefix.dataset.kdImageValid = "true";
      return prefix;
    } catch {
      return null;
    }
  }
  if (type === "image" || type === "url") {
    const src = type === "url" ? normalizeImageUrl(value) : resolveImage(app, value);
    if (!src) {
      prefix.dataset.kdImageValid = "false";
      setIcon(prefix, "image-off");
      return prefix;
    }
    prefix.dataset.kdImageValid = "true";
    const image = doc.adoptNode(createEl("img"));
    image.src = src;
    image.referrerPolicy = "no-referrer";
    image.alt = "";
    image.addClass("keyword-decorator-prefix-image");
    const width = markerSize(rule.imageWidth), height = markerSize(rule.imageHeight);
    image.style.width = sizeCss(width);
    image.style.height = sizeCss(height);
    if (width.unit === "px" && height.unit === "px") {
      image.width = width.amount;
      image.height = height.amount;
    }
    applyCornerRadius(image, rule.imageCornerRadius);
    image.onerror = () => {
      image.remove();
      let failed = failedImageSources.get(app);
      if (!failed) failedImageSources.set(app, (failed = new Set<string>()));
      failed.add(src);
      prefix.dataset.kdImageValid = "false";
      prefix.closest(".keyword-decorator-reading-mark")?.classList.add("keyword-decorator-image-error");
      setIcon(prefix, "image-off");
      onImageError?.();
    };
    prefix.appendChild(image);
    return prefix;
  }
  return null;
}

export function normalizeImageUrl(input: string): string {
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}

function markerSize(value: number | string | undefined, fallback = 24): ImageSize {
  return parseImageSize(value) ?? { amount: fallback, unit: "px" };
}

function sizeCss(size: ImageSize): string {
  return size.unit === "em" ? `${size.amount}em` : `${size.amount}px`;
}

function applyCornerRadius(element: HTMLElement | SVGSVGElement, value: number | string | undefined) {
  if (value === undefined) return;
  const radius = parseImageSize(value);
  if (radius) element.style.borderRadius = sizeCss(radius);
}
