import type { FamilleDeCouches } from '../types';

/** Un sapin en silhouette, son pied en `(x, y)`, haut de `h`. */
const sapin = (x: number, y: number, h: number) => `<path d="M${x} ${y - h} L${x + h * 0.36} ${y} L${x - h * 0.36} ${y} Z" fill="var(--sapin)"/>`;

/** La crête lointaine et ses sapins, commune aux reliefs de terre et de fleuve. */
const LOINTAIN = `
    <path d="M0 204 C150 186 300 176 470 170 S 800 150 960 138 L960 420 L0 420 Z" fill="var(--colline-loin)"/>
    ${[[70, 198, 26], [92, 197, 18], [640, 161, 30], [668, 159, 22], [698, 157, 28], [724, 155, 20]].map(([x, y, h]) => sapin(x, y, h)).join('')}`;

/* Les reliefs du voyage, un par voie : la terre et sa route, le fleuve, la mer. */
export const couches: FamilleDeCouches = [
  {
    id: 'relief-terre',
    label: 'Collines et route',
    svg: `<g transform="translate(0 -40)">${LOINTAIN}
    <path d="M0 248 C200 226 420 232 620 214 S 880 198 960 204 L960 420 L0 420 Z" fill="var(--colline)"/>
    ${[[118, 240, 22], [140, 238, 30], [166, 238, 20], [536, 222, 26], [562, 220, 34], [588, 218, 22], [842, 205, 28], [868, 204, 20]].map(([x, y, h]) => sapin(x, y, h)).join('')}
    <path d="M0 300 C240 272 520 280 960 238 L960 420 L0 420 Z" fill="var(--pre)"/>
    <path d="M0 318 C260 298 560 284 960 234 L960 262 C560 312 260 326 0 350 Z" fill="var(--route)" opacity="0.8"/>
    <path d="M0 322 C260 302 560 288 960 238" fill="none" stroke="var(--parchment)" stroke-width="1" opacity="0.08"/>
    <path d="M0 350 C260 326 560 312 960 262 L960 420 L0 420 Z" fill="var(--ink)"/></g>` },
  {
    id: 'relief-fleuve',
    label: 'Fleuve entre ses rives',
    svg: `<g transform="translate(0 -40)">${LOINTAIN}
    <path d="M0 236 C220 218 430 226 640 212 S 880 202 960 206 L960 420 L0 420 Z" fill="var(--colline)"/>
    <path d="M0 262 C240 248 620 250 960 236 L960 420 L0 420 Z" fill="var(--eau)"/>
    ${[[60, 282, 120], [300, 300, 160], [520, 276, 110], [700, 304, 150], [820, 268, 90], [140, 322, 130], [460, 328, 170]].map(([x, y, l]) => `<path d="M${x} ${y} h${l}" stroke="var(--parchment)" stroke-width="1.2" stroke-linecap="round" opacity="0.1"/>`).join('')}
    <path d="M0 340 C200 328 420 338 640 332 S 860 340 960 334 L960 420 L0 420 Z" fill="var(--ink)"/>
    ${[[40, 340], [52, 338], [64, 341], [610, 333], [622, 331], [880, 337], [892, 335]].map(([x, y]) => `<path d="M${x} ${y} l2 -16" stroke="var(--sapin)" stroke-width="1.6" stroke-linecap="round"/>`).join('')}</g>` },
  {
    id: 'relief-mer',
    label: 'Pleine mer',
    svg: `<g transform="translate(0 -40)">
    <path d="M620 196 C700 184 800 180 960 188 L960 204 L600 204 Z" fill="var(--colline-loin)"/>
    <rect x="0" y="200" width="960" height="220" fill="var(--eau)"/>
    <rect x="0" y="200" width="960" height="2" fill="var(--parchment)" opacity="0.12"/>
    ${[[80, 222, 90], [360, 216, 70], [640, 226, 110], [820, 214, 60], [180, 250, 140], [520, 258, 160], [760, 262, 120], [40, 290, 170], [330, 300, 200], [680, 306, 190], [120, 334, 220], [520, 340, 240]].map(([x, y, l]) => `<path d="M${x} ${y} q${l / 4} -5 ${l / 2} 0 t${l / 2} 0" fill="none" stroke="var(--parchment)" stroke-width="1.3" stroke-linecap="round" opacity="0.12"/>`).join('')}</g>` },
];
