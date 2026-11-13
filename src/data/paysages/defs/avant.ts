import type { FamilleDeCouches } from '../types';
import { alea, n, type Lumiere } from '../formes';

/** Un rameau de sapin dentelé qui part de `(x, y)`, long de `l` (vers la gauche si négatif), qui ploie de `pente`,
 *  épais de `ep`. */
function rameau(x: number, y: number, l: number, pente: number, ep: number, r: () => number): string {
  const pas = Math.round(Math.abs(l) / 9);
  const [haut, bas] = [[] as string[], [] as string[]];
  for (let k = 0; k <= pas; k++) {
    const t = k / pas;
    const [px, py, e] = [x + l * t, y + pente * Math.abs(l) * t * t + Math.sin(t * 4) * 5, ep * (1 - t * 0.82)];
    haut.push(`${n(px)} ${n(py - e * 0.22 - (k % 2 ? 2 : 0))}`);
    bas.push(`${n(px - Math.sign(l) * 4)} ${n(py + (k % 2 ? 1 : 0.35) * e * (0.8 + r() * 0.7) + (k % 3 ? 0 : e * 0.5))}`);
  }
  return `M${haut.join('L')}L${bas.reverse().join('L')}Z`;
}

/** Le jeton du premier plan à la lumière `l` : vert sombre au jour, presque noir à contre-jour. */
const JETON = { jour: 'sous-bois', ombre: 'bg' } as const satisfies Record<Lumiere, string>;

/** Les silhouettes du premier plan à la lumière `l` : le tronc et les rameaux à gauche, le tronc, le talus et ses herbes
 *  à droite, les herbes du bas ; jamais sur le centre. */
function foret(l: Lumiere): string {
  const r = alea(61);
  let gauche = 'M-30 900L-30 0L62 0';
  for (let y = 0; y <= 900; y += 30) gauche += `L${n(58 + Math.sin(y / 170) * 16 + (r() - 0.5) * 10 + y * 0.05)} ${y}`;
  const rameaux = [[30, 70, 300, 0.34, 46], [30, 170, 230, 0.5, 40], [30, 268, 170, 0.62, 34], [20, -10, 380, 0.16, 40], [30, 360, 110, 0.8, 26], [1570, 300, -150, 0.5, 30], [1570, 380, -110, 0.7, 24]]
    .map(([x, y, l, p, e]) => rameau(x, y, l, p, e, r)).join('');
  let droite = 'M1640 0L1548 0';
  for (let y = 0; y <= 560; y += 28) droite += `L${n(1546 + Math.sin(y / 120) * 12 + (r() - 0.5) * 9 - y * 0.01)} ${y}`;
  const herbe = (x: number, y: number, h: number, c: number) => `M${n(x)} ${n(y)}Q${n(x + c * 0.3)} ${n(y - 20)} ${n(x + c)} ${n(y - h)}`;
  const talus = Array.from({ length: 70 }, () => herbe(1270 + r() * 340, 720 + r() * 200, 30 + r() * 80, (r() - 0.5) * 70)).join('');
  const bas = Array.from({ length: 150 }, () => { const x = r() * 1600; return herbe(x, 780 + r() * 20, 14 + r() * 36 + (x > 520 && x < 1080 ? 0 : 20), (r() - 0.5) * 24); }).join('');
  return `<g fill="var(--${JETON[l]})"><path d="${gauche}L-30 900Z${rameaux}${droite}L1500 640L1430 700L1330 760L1240 900L1640 900Z"/></g>
    <path d="${talus}${bas}" fill="none" stroke="var(--${JETON[l]})" stroke-width="2.4" stroke-linecap="round"/>`;
}

/* Le premier plan, devant toute la scène et derrière la météo. */
export const couches: FamilleDeCouches = [
  {
    id: 'avant-foret-jour', label: 'Lisière du premier plan au jour', svg: foret('jour') },
  {
    id: 'avant-foret-ombre', label: 'Lisière du premier plan à contre-jour', svg: foret('ombre') },
];
