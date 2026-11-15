/** Les formes que les couches du paysage composent : un tirage à graine, une crête en bruit, un sapin, un feuillu. */

/** Une suite de nombres de 0 à 1, la même à chaque lecture pour une même `graine`. */
export function alea(graine: number): () => number {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un nombre écrit au dixième. */
export const n = (v: number) => String(Math.round(v * 10) / 10);

/** Une crête : sa ligne de -10 à 1610, à `base` sous ses pics les plus hauts de `amplitude`, un bruit lissé de
 *  graine `graine` sur `echelle` px ; `aigue` : des pics en arête. */
export function crete(graine: number, base: number, amplitude: number, echelle: number, aigue = false): [number, number][] {
  const r = alea(graine);
  const table = Array.from({ length: 512 }, () => r());
  const bruit = (x: number) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return table[i & 511] * (1 - u) + table[(i + 1) & 511] * u;
  };
  const points: [number, number][] = [];
  for (let x = -10; x <= 1610; x += 8) {
    let [v, a, fq, s] = [0, 1, 1 / echelle, 0];
    for (let o = 0; o < 5; o++) {
      let nv = bruit(x * fq + o * 37.3);
      if (aigue) nv = Math.pow(1 - Math.abs(2 * nv - 1), 1.5);
      v += nv * a; s += a; a *= 0.48; fq *= 2.07;
    }
    points.push([x, base - amplitude * (v / s)]);
  }
  return points;
}

/** La crête `points` fermée jusqu'au bas du cadre. */
export const massif = (points: [number, number][]) => `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}L1610 900L-10 900Z`;

/** La hauteur de la crête `points` en `x`. */
export function hauteurEn(points: [number, number][], x: number): number {
  const i = Math.max(0, Math.min(points.length - 2, Math.floor((x + 10) / 8)));
  const [[x0, y0], [x1, y1]] = [points[i], points[i + 1]];
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

/** Un sapin dentelé, son pied en `(x, y)`, haut de `h`, la largeur de ses étages tirée par `r`. */
export function sapin(x: number, y: number, h: number, r: () => number): string {
  const w = h * (0.3 + r() * 0.1);
  const etages = [1, 2, 3, 4, 5].map((i) => [y - h + (h * 0.94 * i) / 5, (w * i) / 5]);
  const droite = etages.map(([yy, ww]) => `L${n(x + ww * 0.55)} ${n(yy - h * 0.035)}L${n(x + ww)} ${n(yy)}L${n(x + ww * 0.35)} ${n(yy - h * 0.02)}`).join('');
  const gauche = etages.reverse().map(([yy, ww]) => `L${n(x - ww * 0.35)} ${n(yy - h * 0.02)}L${n(x - ww)} ${n(yy)}L${n(x - ww * 0.55)} ${n(yy - h * 0.035)}`).join('');
  return `M${n(x)} ${n(y - h)}${droite}L${n(x + w * 0.08)} ${n(y)}L${n(x - w * 0.08)} ${n(y)}${gauche}Z`;
}

/** Un feuillu, son pied en `(x, y)`, haut de `h`, sa ramure tirée par `r`. */
export function feuillu(x: number, y: number, h: number, r: () => number): string {
  const rond = (cx: number, cy: number, rr: number) => `M${n(cx - rr)} ${n(cy)}a${n(rr)} ${n(rr)} 0 1 0 ${n(2 * rr)} 0a${n(rr)} ${n(rr)} 0 1 0 ${n(-2 * rr)} 0Z`;
  const ramure = Array.from({ length: 6 }, () => rond(x + (r() - 0.5) * h * 0.5, y - h * 0.52 - r() * h * 0.42, h * (0.16 + r() * 0.12))).join('');
  return `M${n(x - h * 0.03)} ${n(y)}v${n(-h * 0.5)}h${n(h * 0.06)}v${n(h * 0.5)}Z${ramure}`;
}

/** La lumière d'un plan de terre : ses couleurs au jour, sa silhouette sous la brume de l'aube, du soir et de la nuit. */
export type Lumiere = 'jour' | 'ombre';

/** L'ordonnée de la route de `relief-route-…`, où pose l'équipage à terre. */
export const ROUTE = 630;

/** Un dessin du cadre 960×360 d'avant posé au cadre de l'écran, à l'échelle de sa largeur, son haut descendu en `y`. */
const auCadre = (y: number) => (dessin: string) => `<g transform="translate(0 ${y}) scale(${1600 / 960})">${dessin}</g>`;
/** Le fleuve, la mer et leurs bateaux : leur bas au bas du cadre. */
export const auCadreDeLEau = auCadre(267);
/** La halte au bord de la route : son sol d'avant (`y = 258`) sur `ROUTE`. */
export const auCadreDeLaHalte = auCadre(ROUTE - 430);
