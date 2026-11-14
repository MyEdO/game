import type { FamilleDeCouches } from '../types';
import { n } from '../formes';

/** La teinte du ciel d'une arche : celle de ses jetons `ciel-<teinte>-…`. */
type Teinte = 'aube' | 'jour' | 'soir' | 'nuit';

/** L'astre d'une arche : sa part de la course, du levant (0) au couchant (1), et s'il est la lune. */
type Astre = { course: number; lune?: true };

/** Le ciel de l'arche du moment `m`, dessiné dans un cadre de 112 sur 66 posé au centre de celui du paysage : le
 *  dégradé de la teinte `t` sous une arche de laiton, `etoiles` étoiles, la course de l'astre en pointillé et l'astre à
 *  sa place, un horizon de collines et de sapins, le pied de laiton et ses deux rivets. */
function arche(m: string, t: Teinte, astre: Astre, etoiles: number): string {
  const id = `arche-${m}`;
  const angle = Math.PI * (1 - astre.course);
  const [x, y] = [56 + Math.cos(angle) * 38, 58 - Math.sin(angle) * 38];
  const semis = [[22, 30, 0.9], [30, 20, 0.7], [41, 26, 0.6], [36, 38, 0.5], [52, 17, 0.5], [18, 44, 0.6], [70, 22, 0.7], [84, 32, 0.6], [62, 30, 0.5], [92, 44, 0.5]]
    .slice(0, etoiles).map(([ex, ey, o]) => `<circle cx="${ex}" cy="${ey}" r="0.8" fill="var(--lune)" opacity="${o}"/>`).join('');
  const disque = astre.lune
    ? `<circle cx="${n(x)}" cy="${n(y)}" r="9" fill="url(#${id}-halo)" opacity="0.5"/><path d="M${n(x - 1)},${n(y - 5)}a5,5 0 1 0 4,7.5a4,4 0 1 1 -4,-7.5z" fill="var(--lune)"/>`
    : `<circle cx="${n(x)}" cy="${n(y)}" r="22" fill="url(#${id}-halo)"/><circle cx="${n(x)}" cy="${n(y)}" r="6" fill="var(--astre)"/>`;
  const sapins = [[34, 48], [39, 49], [60, 50], [66, 51], [70, 51.5]].map(([sx, sy]) => `<path d="M${sx},${sy + 3}l2.5,-8l2.5,8z" fill="var(--talus)"/>`).join('');
  return `
    <defs><linearGradient id="${id}-laiton" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--laiton-sombre)"/><stop offset="0.3" stop-color="var(--laiton)"/><stop offset="0.5" stop-color="var(--laiton-clair)"/><stop offset="0.7" stop-color="var(--laiton)"/><stop offset="1" stop-color="var(--laiton-sombre)"/></linearGradient>
    <linearGradient id="${id}-ciel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ciel-${t}-haut)"/><stop offset="0.55" stop-color="var(--ciel-${t}-bas)"/><stop offset="1" stop-color="var(--ciel-${t}-horizon)"/></linearGradient>
    <radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="var(--astre)" stop-opacity="0.95"/><stop offset="0.35" stop-color="var(--astre-halo)" stop-opacity="0.55"/><stop offset="1" stop-color="var(--astre-halo)" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}-coupe"><path d="M10,58A46,46 0 0 1 102,58Z"/></clipPath></defs>
    <g transform="translate(38 2) scale(13.6)">
    <path d="M3,61A53,53 0 0 1 109,61Z" fill="url(#${id}-laiton)" stroke="var(--fer-sombre)" stroke-width="1"/>
    <g clip-path="url(#${id}-coupe)"><rect x="8" y="10" width="96" height="50" fill="url(#${id}-ciel)"/>${semis}
    <path d="M18,58A38,38 0 0 1 94,58" fill="none" stroke="var(--astre)" stroke-width="1" stroke-dasharray="1.5 4" stroke-linecap="round" opacity="0.6"/>${disque}
    <path d="M8,60V53C16,50 22,52 30,49C38,46 44,51 52,50C62,49 68,53 78,51C88,49 96,52 104,50V60Z" fill="var(--talus)"/>${sapins}</g>
    <path d="M10,58A46,46 0 0 1 102,58" fill="none" stroke="var(--fer-sombre)" stroke-width="1.4"/>
    <rect x="1" y="58" width="110" height="6" rx="1.5" fill="url(#${id}-laiton)" stroke="var(--fer-sombre)" stroke-width="0.8"/>
    <circle cx="8" cy="61" r="1.4" fill="var(--laiton-sombre)"/><circle cx="104" cy="61" r="1.4" fill="var(--laiton-sombre)"/></g>`;
}

/* Les ciels de l'objet du temps, un par moment du jour (`DayPhaseId`, `src/engine/clock.ts`) : le soleil se lève à
   gauche, culmine à midi, se couche à droite ; le soir, la lune monte parmi les étoiles, haute la nuit. */
export const couches: FamilleDeCouches = [
  {
    id: 'arche-aube', label: 'Arche du ciel d’aube', svg: arche('aube', 'aube', { course: 0.08 }, 0) },
  {
    id: 'arche-matin', label: 'Arche du ciel du matin', svg: arche('matin', 'jour', { course: 0.28 }, 0) },
  {
    id: 'arche-midi', label: 'Arche du ciel de midi', svg: arche('midi', 'jour', { course: 0.5 }, 0) },
  {
    id: 'arche-apresmidi', label: 'Arche du ciel d’après-midi', svg: arche('apresmidi', 'jour', { course: 0.72 }, 0) },
  {
    id: 'arche-crepuscule', label: 'Arche du ciel du crépuscule', svg: arche('crepuscule', 'soir', { course: 0.92 }, 3) },
  {
    id: 'arche-soir', label: 'Arche du ciel du soir', svg: arche('soir', 'nuit', { course: 0.2, lune: true }, 7) },
  {
    id: 'arche-nuit', label: 'Arche du ciel de nuit', svg: arche('nuit', 'nuit', { course: 0.5, lune: true }, 10) },
];
