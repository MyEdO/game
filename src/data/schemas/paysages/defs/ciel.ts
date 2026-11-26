import type { FamilleDeCouches } from '../types';
import { alea, n } from '../formes';

/** L'astre d'un ciel : le soleil ou la lune, et son halo de rayon `halo` et d'opacité `eclat`. */
type Astre = { x: number; y: number; halo: number; eclat: number; lune?: true };

/** Les nuages d'un ciel : leur jeton, et leur reflet de l'astre, dessus quand il est haut, dessous quand il est bas. */
type Nuees = { jeton: string; reflet: 'dessus' | 'dessous' };

/** Le ciel du moment `m` : son dégradé du zénith à l'horizon, ses étoiles (`etoiles` d'opacité `eclat`), son astre et
 *  `nuages` nuages `nuees`. */
function ciel(m: string, astre: Astre, etoiles: number, eclat: number, nuages: number, nuees: Nuees): string {
  const id = `ciel-${m}`;
  const r = alea(m.length * 7 + etoiles);
  const semis = Array.from({ length: etoiles }, () => `<circle cx="${n(r() * 1600)}" cy="${n(r() * 300)}" r="${n(0.6 + r() * 1)}" fill="var(--lune)" opacity="${n(eclat * (0.3 + r() * 0.7))}"/>`).join('');
  const formes = Array.from({ length: nuages }, () => {
    const [x, y, w, h] = [r() * 1800 - 100, 110 + r() * 300, 160 + r() * 420, 10 + r() * 24];
    const t = Math.min(1, Math.max(0, (y - 110) / 300));
    const corps = `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w / 2)}" ry="${n(h / 2)}" fill="var(--${nuees.jeton})" opacity="${n(0.35 + r() * 0.3 - t * 0.2)}"/>`;
    return corps + (nuees.reflet === 'dessus'
      ? `<ellipse cx="${n(x - 10)}" cy="${n(y - h * 0.22)}" rx="${n(w * 0.42)}" ry="${n(h * 0.26)}" fill="var(--astre)" opacity="0.7"/>`
      : `<ellipse cx="${n(x + 10)}" cy="${n(y + h * 0.42)}" rx="${n(w * 0.46)}" ry="${n(h * 0.22)}" fill="var(--astre-halo)" opacity="${n((0.12 + t * 0.4) * (astre.lune ? 0.4 : 1))}"/>`);
  }).join('');
  const disque = astre.lune
    ? `<circle cx="${astre.x}" cy="${astre.y}" r="22" fill="var(--lune)"/><circle cx="${astre.x - 9}" cy="${astre.y - 6}" r="19" fill="var(--ciel-${m}-bas)"/>`
    : `<circle cx="${astre.x}" cy="${astre.y}" r="30" fill="var(--astre)"/>`;
  return `
    <defs><linearGradient id="${id}-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ciel-${m}-haut)"/><stop offset="0.38" stop-color="var(--ciel-${m}-bas)"/><stop offset="0.62" stop-color="var(--ciel-${m}-horizon)"/></linearGradient>
    <radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--astre)" stop-opacity="0.9"/><stop offset="0.16" stop-color="var(--astre-halo)" stop-opacity="0.55"/><stop offset="1" stop-color="var(--astre-halo)" stop-opacity="0"/></radialGradient>
    <filter id="${id}-flou" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <rect x="0" y="0" width="1600" height="900" fill="url(#${id}-fond)"/>${semis}
    <circle cx="${astre.x}" cy="${astre.y}" r="${astre.halo}" fill="url(#${id}-halo)" opacity="${astre.eclat}"/>${disque}
    <g filter="url(#${id}-flou)">${formes}</g>`;
}

/* Les ciels du voyage, un par moment du jour (`DayPhaseId`, `src/engine/clock.ts`) : le soleil bas à l'aube et au soir,
   haut le jour, la lune la nuit, tous deux dans la bande que l'écran du voyage garde. */
export const couches: FamilleDeCouches = [
  {
    id: 'ciel-aube', label: 'Ciel d’aube', svg: ciel('aube', { x: 1180, y: 520, halo: 340, eclat: 0.9 }, 12, 0.4, 20, { jeton: 'nuage', reflet: 'dessous' }) },
  {
    id: 'ciel-jour', label: 'Ciel de jour', svg: ciel('jour', { x: 600, y: 300, halo: 240, eclat: 0.35 }, 0, 0, 16, { jeton: 'nuage-jour', reflet: 'dessus' }) },
  {
    id: 'ciel-soir', label: 'Ciel du soir', svg: ciel('soir', { x: 560, y: 500, halo: 330, eclat: 0.9 }, 40, 0.6, 26, { jeton: 'nuage', reflet: 'dessous' }) },
  {
    id: 'ciel-nuit', label: 'Ciel de nuit', svg: ciel('nuit', { x: 640, y: 300, halo: 220, eclat: 0.18, lune: true }, 110, 0.9, 14, { jeton: 'nuage', reflet: 'dessous' }) },
];
