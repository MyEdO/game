import { ICON_DEFS } from '../data/icons';
import type { IconId } from '../data/icons';

/* Primitive d'icône UI (LOT 4 — remplace les emojis d'affordance). Rend le fragment SVG du
   registre src/data/icons/ dans un viewBox 24×24 qui hérite la couleur du texte (currentColor).
   Un id est un `IconId` (union générée) ; celui de la DONNÉE se juge au parse (`idDIconeSchema`). */

const SIZES = { sm: 14, md: 18, lg: 24 } as const;

/** Fragment SVG interne (viewBox 0 0 24 24) d'une icône du registre — pour les rendus qui composent
 *  leur propre SVG (galeries SSR, `IconG`). Throw en DEV si l'id est inconnu (pas de repli muet). */
export function iconSvg(id: IconId): string {
  const def = ICON_DEFS[id];
  if (!def) {
    // `?.` : import.meta.env n'existe pas sous tsx (scripts de galerie SSR).
    if (import.meta.env?.DEV) throw new Error(`Icône inconnue : « ${id} » — déposer une def dans src/data/icons/defs/ puis \`npm run gen\`.`);
    return '';
  }
  return def.svg;
}

/** Icône posée DANS un `<svg>` existant (pion, carte du monde, FX…) : un `<g>` translaté/échellé
 *  qui rend le fragment 24×24 à `size` px, coin haut-gauche en (x,y). Couleur via `currentColor`
 *  (poser `color` sur un ancêtre). Pendant SVG de `<Icon>` (contexte HTML). */
export function IconG({ id, x = 0, y = 0, size = 24 }: { id: IconId; x?: number; y?: number; size?: number }) {
  const svg = iconSvg(id);
  if (!svg) return null;
  return <g transform={`translate(${x},${y}) scale(${size / 24})`} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Icon({ id, size = 'md', className }: { id: IconId; size?: number | keyof typeof SIZES; className?: string }) {
  const def = ICON_DEFS[id];
  if (!def) {
    // `?.` : import.meta.env n'existe pas sous tsx (scripts de galerie SSR).
    if (import.meta.env?.DEV) throw new Error(`Icône inconnue : « ${id} » — déposer une def dans src/data/icons/defs/ puis \`npm run gen\`.`);
    return null;
  }
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width={px}
      height={px}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: def.svg }}
    />
  );
}
