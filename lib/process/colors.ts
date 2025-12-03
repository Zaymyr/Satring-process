const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/i;
const RGB_COLOR_REGEX = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const RGBA_COLOR_REGEX =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i;

const FALLBACK_STEP_FILL_ALPHA = 0.12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toRgba = (color: string, alpha: number, fallback: string) => {
  if (!color) {
    return fallback;
  }

  const normalizedAlpha = clamp(Number.isFinite(alpha) ? alpha : FALLBACK_STEP_FILL_ALPHA, 0, 1);

  if (HEX_COLOR_REGEX.test(color)) {
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
  }

  const rgbMatch = color.match(RGB_COLOR_REGEX);
  if (rgbMatch) {
    const [, red, green, blue] = rgbMatch;
    return `rgba(${Number(red)}, ${Number(green)}, ${Number(blue)}, ${normalizedAlpha})`;
  }

  const rgbaMatch = color.match(RGBA_COLOR_REGEX);
  if (rgbaMatch) {
    const [, red, green, blue] = rgbaMatch;
    return `rgba(${Number(red)}, ${Number(green)}, ${Number(blue)}, ${normalizedAlpha})`;
  }

  return fallback;
};

export { clamp, FALLBACK_STEP_FILL_ALPHA, HEX_COLOR_REGEX, RGB_COLOR_REGEX, RGBA_COLOR_REGEX, toRgba };
