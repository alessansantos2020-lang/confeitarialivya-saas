import type { CSSProperties } from "react";

const DEFAULT_PRIMARY = "#db2777";
const DEFAULT_SECONDARY = "#fdf2f8";

/**
 * Gera as variáveis de tema da loja para aplicar no container do painel.
 * O Tailwind v4 emite `bg-pink-600` como `var(--color-pink-600)`, então
 * sobrescrever essas variáveis num elemento pai recolore todo o painel
 * (admin/staff) com a cor da loja ativa, sem tocar em cada classe.
 * Os tons são derivados da cor primária via color-mix (oklch).
 */
export function storeThemeVars(
  primary?: string | null,
  secondary?: string | null,
): CSSProperties {
  const p = primary || DEFAULT_PRIMARY;
  const s = secondary || DEFAULT_SECONDARY;

  return {
    "--color-pink-50": s,
    "--color-pink-100": `color-mix(in oklch, ${p}, white 82%)`,
    "--color-pink-200": `color-mix(in oklch, ${p}, white 65%)`,
    "--color-pink-400": `color-mix(in oklch, ${p}, white 25%)`,
    "--color-pink-500": `color-mix(in oklch, ${p}, white 12%)`,
    "--color-pink-600": p,
    "--color-pink-700": `color-mix(in oklch, ${p}, black 15%)`,
    "--color-pink-900": `color-mix(in oklch, ${p}, black 40%)`,
    "--color-rose-50": s,
    "--color-rose-100": `color-mix(in oklch, ${p}, white 82%)`,
    "--color-rose-300": `color-mix(in oklch, ${p}, white 35%)`,
    "--color-rose-500": p,
    "--color-rose-600": `color-mix(in oklch, ${p}, black 8%)`,
    "--primary-color": p,
    "--secondary-color": s,
  } as CSSProperties;
}
