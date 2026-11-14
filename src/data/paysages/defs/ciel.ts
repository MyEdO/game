import type { FamilleDeCouches } from '../types';

/** Un ciel : du zénith à l'horizon, plein cadre. */
const ciel = (nom: string, haut: string, bas: string) => `
    <defs><linearGradient id="${nom}-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--${haut})"/><stop offset="0.72" stop-color="var(--${bas})"/></linearGradient></defs>
    <rect x="0" y="0" width="960" height="360" fill="url(#${nom}-fond)"/>`;

/** Les étoiles d'une nuit claire, en haut du ciel. */
const ETOILES = [[62, 38], [148, 82], [231, 24], [318, 61], [402, 30], [489, 92], [545, 44], [655, 20], [722, 70], [806, 36], [884, 86], [930, 28], [36, 118], [270, 126], [610, 122], [760, 136]]
  .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.3 : 0.9}" fill="var(--parchment)" opacity="${i % 2 ? 0.55 : 0.8}"/>`).join('');

/* Les ciels du voyage, un par moment du jour (`DayPhaseId`, `src/engine/clock.ts`). */
export const couches: FamilleDeCouches = [
  {
    id: 'ciel-aube',
    label: 'Ciel d’aube',
    svg: `${ciel('ciel-aube', 'ciel-aube-haut', 'ciel-aube-bas')}
    <ellipse cx="700" cy="232" rx="210" ry="46" fill="var(--gold2)" opacity="0.14"/>` },
  {
    id: 'ciel-jour',
    label: 'Ciel de jour',
    svg: `${ciel('ciel-jour', 'ciel-jour-haut', 'ciel-jour-bas')}
    <path d="M90 74 C130 58 190 60 226 72 C262 62 320 68 344 84 L96 86 Z" fill="var(--parchment)" opacity="0.07"/>
    <path d="M560 46 C610 30 680 34 716 48 C760 40 812 48 836 62 L566 62 Z" fill="var(--parchment)" opacity="0.06"/>` },
  {
    id: 'ciel-soir',
    label: 'Ciel du soir',
    svg: `${ciel('ciel-soir', 'ciel-soir-haut', 'ciel-soir-bas')}
    <ellipse cx="250" cy="236" rx="240" ry="40" fill="var(--accent)" opacity="0.12"/>` },
  {
    id: 'ciel-nuit',
    label: 'Ciel de nuit',
    svg: `${ciel('ciel-nuit', 'ciel-nuit-haut', 'ciel-nuit-bas')}
    ${ETOILES}
    <circle cx="566" cy="58" r="15" fill="var(--parchment)" opacity="0.85"/>
    <circle cx="560" cy="54" r="13" fill="var(--ciel-nuit-haut)"/>` },
];
