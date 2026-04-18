import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculates the relative luminance of a color.
 * Supports #RRGGBB and #RGB formats.
 */
export function getLuminance(hex: string): number {
  let color = hex.startsWith('#') ? hex.substring(1) : hex;
  
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Returns either '#ffffff' or '#111111' depending on the luminance of the input hex color.
 */
export function getContrastColor(hex: string): '#ffffff' | '#111111' {
  try {
    // If it's a transparent value or not a hex, default to white (assuming dark theme)
    if (!hex || !hex.startsWith('#')) return '#ffffff';
    return getLuminance(hex) > 0.45 ? '#111111' : '#ffffff';
  } catch (e) {
    return '#ffffff';
  }
}
