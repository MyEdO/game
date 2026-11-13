import type { FamilleDeCouches } from '../types';
import { alea, auCadreDeLEau, crete, feuillu, hauteurEn, massif, n, ROUTE, sapin, type Lumiere } from '../formes';

/** Un sapin en silhouette du cadre d'avant, son pied en `(x, y)`, haut de `h`. */
const sapinDAvant = (x: number, y: number, h: number) => `<path d="M${x} ${y - h} L${x + h * 0.36} ${y} L${x - h * 0.36} ${y} Z" fill="var(--sapin)"/>`;

/** La crête lointaine et ses sapins, du cadre d'avant, sous le fleuve. */
const LOINTAIN = `
    <path d="M0 204 C150 186 300 176 470 170 S 800 150 960 138 L960 420 L0 420 Z" fill="var(--colline-loin)"/>
    ${[[70, 198, 26], [92, 197, 18], [640, 161, 30], [668, 159, 22], [698, 157, 28], [724, 155, 20]].map(([x, y, h]) => sapinDAvant(x, y, h)).join('')}`;

/** Les jetons de chaque plan de terre à la lumière `l` : au jour leurs couleurs, à l'ombre leurs silhouettes. */
const JETONS = {
  jour: { montagne: 'montagne-jour', cimes: 0.8, loin: 0.72, pres: 0.88, colline: 'colline-jour', sapinColline: 'sapin', feuillu: 'feuillu', lisiere: 'colline', sapinLisiere: 'sapin', talus: 'herbe', sol: 'sapin', chaussee: 0.9, reflet: 'ciel-jour-bas', borne: 'fer-clair', ecriteau: 'chene' },
  ombre: { montagne: 'montagne', cimes: 0.3, loin: 0.5, pres: 0.62, colline: 'crete', sapinColline: 'crete', feuillu: 'crete', lisiere: 'lisiere', sapinLisiere: 'lisiere', talus: 'talus', sol: 'bg', chaussee: 0.22, reflet: 'astre-halo', borne: 'bg', ecriteau: 'crete' },
} as const satisfies Record<Lumiere, unknown>;

/** Les montagnes du lointain à la lumière `l`, mêlées au ciel par leur opacité ; la neige sur leurs cimes. */
function montagnes(l: Lumiere): string {
  const j = JETONS[l];
  const loin = crete(27, 540, 300, 520, true);
  const pres = crete(22, 552, 150, 330, true);
  const cimes = loin.filter(([, y], i) => i > 0 && i < loin.length - 1 && y < loin[i - 1][1] && y < loin[i + 1][1] && y < 350)
    .map(([x, y]) => `M${n(x - 16)} ${n(y + 22)}L${n(x - 3)} ${n(y + 1)}L${n(x + 2)} ${n(y + 9)}L${n(x + 7)} ${n(y + 3)}L${n(x + 20)} ${n(y + 26)}L${n(x + 9)} ${n(y + 19)}L${n(x + 2)} ${n(y + 27)}L${n(x - 6)} ${n(y + 17)}Z`).join('');
  return `<path d="${massif(loin)}" fill="var(--${j.montagne})" opacity="${j.loin}"/><path d="${cimes}" fill="var(--lune)" opacity="${j.cimes}"/><path d="${massif(pres)}" fill="var(--${j.montagne})" opacity="${j.pres}"/>`;
}

/** Une crête boisée : son massif du jeton `massifJeton`, et `arbres` sapins (jeton `sapinJeton`) et feuillus si `feuillus`
 *  (jeton `feuillu` de la lumière `l`) de `h` à `h + dh` posés sur sa ligne, hors de `[trouee]`. */
function boisee(l: Lumiere, graine: number, base: number, amplitude: number, echelle: number, arbres: number, h: number, dh: number, feuillus: boolean, massifJeton: string, sapinJeton: string, trouee?: [number, number]): string {
  const ligne = crete(graine, base, amplitude, echelle);
  const r = alea(graine + 1);
  const [sapins, ronds] = [[] as string[], [] as string[]];
  for (let i = 0; i < arbres; i++) {
    const x = r() * 1600;
    if (trouee && x > trouee[0] && x < trouee[1] && r() < 0.8) continue;
    const y = hauteurEn(ligne, x) + 3;
    if (feuillus && r() > 0.75) ronds.push(feuillu(x, y, h + r() * dh, r));
    else sapins.push(sapin(x, y, h + r() * dh, r));
  }
  return `<path d="${massif(ligne)}" fill="var(--${massifJeton})"/><path d="${sapins.join('')}" fill="var(--${sapinJeton})"/>`
    + (ronds.length ? `<path d="${ronds.join('')}" fill="var(--${JETONS[l].feuillu})"/>` : '');
}

/** Les collines boisées à la lumière `l`. */
const collines = (l: Lumiere) => boisee(l, 33, 572, 62, 460, 240, 14, 20, true, JETONS[l].colline, JETONS[l].sapinColline);
/** La lisière de sapins à la lumière `l`, trouée derrière l'équipage. */
const lisiere = (l: Lumiere) => boisee(l, 41, 604, 22, 300, 130, 40, 74, false, JETONS[l].lisiere, JETONS[l].sapinLisiere, [470, 1180]);

/** La route de terre à la lumière `l` et son talus, la chaussée qui reflète le ciel, et la borne au bord. */
function route(l: Lumiere): string {
  const j = JETONS[l];
  const id = `relief-route-${l}-sol`;
  const r = alea(51);
  const flaques = Array.from({ length: 40 }, () => `<ellipse cx="${n(r() * 1600)}" cy="${n(ROUTE - 4 + r() * 22)}" rx="${n(10 + r() * 45)}" ry="${n(1.2 + r() * 1.8)}" fill="var(--${j.reflet})" opacity="${n(0.08 + r() * 0.22)}"/>`).join('');
  return `
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--${j.talus})"/><stop offset="0.3" stop-color="var(--${j.sol})"/></linearGradient></defs>
    <path d="M-10 ${ROUTE - 18} C400 ${ROUTE - 26} 1100 ${ROUTE - 22} 1610 ${ROUTE - 30} L1610 900 L-10 900 Z" fill="url(#${id})"/>
    <path d="M-10 ${ROUTE - 12} C400 ${ROUTE - 18} 1100 ${ROUTE - 14} 1610 ${ROUTE - 20} L1610 ${ROUTE + 16} C1100 ${ROUTE + 22} 400 ${ROUTE + 18} -10 ${ROUTE + 26} Z" fill="var(--route)" opacity="${j.chaussee}"/>
    <path d="M-10 ${ROUTE - 12} C400 ${ROUTE - 18} 1100 ${ROUTE - 14} 1610 ${ROUTE - 20}" fill="none" stroke="var(--${j.reflet})" stroke-width="1.5" opacity="0.3"/>${flaques}
    <path d="M1364 ${ROUTE + 6}v-44q0 -10 10 -10h6q10 0 10 10v44z" fill="var(--${j.borne})"/>
    <path d="M1370 ${ROUTE - 32}h14v6h-4.5v16h-5v-16h-4.5z" fill="var(--${j.ecriteau})"/>`;
}

/* Les reliefs du voyage. La voie terrestre en plans, du plus lointain au plus proche, à ses deux lumières : les
   montagnes, les collines boisées, la lisière, la route ; le fleuve et la mer, du cadre d'avant, posés au cadre de
   l'écran. */
export const couches: FamilleDeCouches = [
  {
    id: 'relief-montagnes-jour', label: 'Montagnes du lointain au jour', svg: montagnes('jour') },
  {
    id: 'relief-collines-jour', label: 'Collines boisées au jour', svg: collines('jour') },
  {
    id: 'relief-lisiere-jour', label: 'Lisière de sapins au jour', svg: lisiere('jour') },
  {
    id: 'relief-route-jour', label: 'Route de terre au jour', svg: route('jour') },
  {
    id: 'relief-montagnes-ombre', label: 'Montagnes du lointain à contre-jour', svg: montagnes('ombre') },
  {
    id: 'relief-collines-ombre', label: 'Collines boisées à contre-jour', svg: collines('ombre') },
  {
    id: 'relief-lisiere-ombre', label: 'Lisière de sapins à contre-jour', svg: lisiere('ombre') },
  {
    id: 'relief-route-ombre', label: 'Route de terre à contre-jour', svg: route('ombre') },
  {
    id: 'relief-fleuve',
    label: 'Fleuve entre ses rives',
    svg: auCadreDeLEau(`<g transform="translate(0 -40)">${LOINTAIN}
    <path d="M0 236 C220 218 430 226 640 212 S 880 202 960 206 L960 420 L0 420 Z" fill="var(--colline)"/>
    <path d="M0 262 C240 248 620 250 960 236 L960 420 L0 420 Z" fill="var(--eau)"/>
    ${[[60, 282, 120], [300, 300, 160], [520, 276, 110], [700, 304, 150], [820, 268, 90], [140, 322, 130], [460, 328, 170]].map(([x, y, l]) => `<path d="M${x} ${y} h${l}" stroke="var(--parchment)" stroke-width="1.2" stroke-linecap="round" opacity="0.1"/>`).join('')}
    <path d="M0 340 C200 328 420 338 640 332 S 860 340 960 334 L960 420 L0 420 Z" fill="var(--ink)"/>
    ${[[40, 340], [52, 338], [64, 341], [610, 333], [622, 331], [880, 337], [892, 335]].map(([x, y]) => `<path d="M${x} ${y} l2 -16" stroke="var(--sapin)" stroke-width="1.6" stroke-linecap="round"/>`).join('')}</g>`) },
  {
    id: 'relief-mer',
    label: 'Pleine mer',
    svg: auCadreDeLEau(`<g transform="translate(0 -40)">
    <path d="M620 196 C700 184 800 180 960 188 L960 204 L600 204 Z" fill="var(--colline-loin)"/>
    <rect x="0" y="200" width="960" height="220" fill="var(--eau)"/>
    <rect x="0" y="200" width="960" height="2" fill="var(--parchment)" opacity="0.12"/>
    ${[[80, 222, 90], [360, 216, 70], [640, 226, 110], [820, 214, 60], [180, 250, 140], [520, 258, 160], [760, 262, 120], [40, 290, 170], [330, 300, 200], [680, 306, 190], [120, 334, 220], [520, 340, 240]].map(([x, y, l]) => `<path d="M${x} ${y} q${l / 4} -5 ${l / 2} 0 t${l / 2} 0" fill="none" stroke="var(--parchment)" stroke-width="1.3" stroke-linecap="round" opacity="0.12"/>`).join('')}</g>`) },
];
