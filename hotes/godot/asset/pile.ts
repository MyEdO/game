/**
 * LA PILE DES COUCHES RÉSOLUE AU MONTAGE (#3842) : dans une tenue montée, la couche du dessous cède à celle qui la
 * couvre. Les pièces se résolvent de la plus extérieure à la plus intérieure, sur la tenue posée au repos, sans rien
 * lire d'une pièce que sa géométrie et ses poids.
 *
 * Un point est couvert par le triangle le plus proche d'une pièce qui couvre la sienne, tourné du même côté, à
 * `PORTEE_DE_COUVERTURE_M` derrière lui au plus, ou `PERCEE_M` devant. Sa couverture le retient : il reprend, au point couvrant, les
 * poids de peau qu'elle a une fois résolue, tout entier jusqu'à `SERRAGE_M` d'elle, de moins en moins jusqu'à
 * `PORTEE_DE_COUVERTURE_M`. Elle ne le retient pas si elle flotte sur une chaîne plus que lui (`FLOTTEMENT`), ni si elle tient à
 * une autre partie du corps que lui (`PARENTE`). Les points de sa pièce à moins de `HALO_M` d'un point retenu le
 * suivent, en fondu avec la distance, et des points que leur auteur a liés aux mêmes poids restent liés pareil.
 *
 * Un point retenu devant sa couverture, ou à moins de `JEU_M` derrière elle, recule à `JEU_M`, et ses voisins d'arête
 * reculent avec lui sans qu'aucun triangle se retourne (`ENTRAINEMENT`). Un triangle dont les trois points sont retenus
 * tout entiers ne se dessine plus.
 */

/** La distance, en mètres, au-delà de laquelle une couche n'en couvre plus une autre : l'épaisseur d'une manche
 *  bouffante. */
export const PORTEE_DE_COUVERTURE_M = 0.03;
/** La profondeur, en mètres, jusqu'à laquelle un point devant une couverture est percé ; au-delà, il est dehors. */
export const PERCEE_M = 0.01;
/** La distance, en mètres, jusqu'à laquelle une couverture retient tout entier le point qu'elle couvre ; au-delà, elle
 *  le retient de moins en moins, jusqu'à `PORTEE_DE_COUVERTURE_M`. */
export const SERRAGE_M = 0.01;
/** Le jeu, en mètres, rendu à un point retenu trop proche de sa couverture, ou devant elle. */
export const JEU_M = 0.003;
/** La distance, en mètres, jusqu'à laquelle un point suit un point retenu de sa pièce. */
export const HALO_M = 0.03;
/** L'écart de poids de chaîne, couverture moins sujet, à partir duquel la couverture flotte et ne retient rien. */
export const FLOTTEMENT = 0.5;
/** La part des poids d'un point et de sa couverture portée par les mêmes os, un os et son parent comptant pour moitié,
 *  à partir de laquelle la couverture le retient tout entier. */
export const PARENTE = 0.5;
const PART_D_UN_PARENT = 0.5;
/** L'écart de recul admis entre les deux points d'une arête, en part de la plus petite hauteur de ses triangles. */
export const ENTRAINEMENT = 0.5;
const PASSES_D_APAISEMENT = 32;
/** Deux sommets d'une pièce plus proches que cet écart, en mètres, sont un seul point de la surface. */
export const SOUDURE_M = 1e-5;
const INFLUENCES = 4;

/** Un maillage skinné d'une pièce posée au repos, dans le repère du squelette. `resoudreLaPile` le modifie en place. */
export interface MaillageDePile {
  /** Les positions des sommets, à plat (x, y, z). */
  positions: Float32Array;
  /** Les triangles, par trois indices de sommet. */
  indices: Uint32Array;
  /** Par sommet, `INFLUENCES` rangs dans `noms`. */
  os: Uint16Array;
  /** Par sommet, `INFLUENCES` poids, de somme 1. */
  poids: Float32Array;
  /** Les noms des os que `os` désigne. */
  noms: string[];
}

/** Ce que la pile lit du squelette de la base. */
export interface SqueletteDePile {
  /** Le parent de chaque os qui en a un, par nom. */
  readonly parents: ReadonlyMap<string, string>;
  /** Les os des chaînes de la base. */
  readonly osDeChaine: ReadonlySet<string>;
}

export interface PieceDePile {
  readonly maillages: readonly MaillageDePile[];
}

export interface BilanDePile {
  /** Les points de surface retenus, ceux qui les suivent, ceux qui ont reculé, ceux qu'aucune de leurs couvertures ne
   *  retient. */
  readonly couverts: number;
  readonly suiveurs: number;
  readonly recules: number;
  readonly flottants: number;
  /** Les triangles qui ne se dessinent plus. */
  readonly masques: number;
}

/** Les poids de peau d'un maillage. */
type Poids = Pick<MaillageDePile, 'os' | 'poids' | 'noms'>;
type Vecteur = [number, number, number];
const NUL: Vecteur = [0, 0, 0];

const cellule = (x: number): number => Math.floor(x / PORTEE_DE_COUVERTURE_M);
/** La clé d'une cellule, exacte à moins de 2¹⁰ cellules de l'origine sur chaque axe ; au-delà, deux cellules qui
 *  partagent une clé ne font que proposer des triangles que `visiterLaCouverture` écarte. */
const cle = (i: number, j: number, k: number): number => (i + 1024) + (j + 1024) * 2048 + (k + 1024) * 4194304;

/** Une surface posée : ses positions à plat, ses triangles (indices par trois) et ceux-ci rangés par cellule de
 *  `PORTEE_DE_COUVERTURE_M` de côté qu'ils touchent. */
export interface Couverture {
  readonly positions: Float32Array;
  readonly indices: ArrayLike<number>;
  readonly grille: ReadonlyMap<number, readonly number[]>;
}

/** La couverture des triangles `indices` sur les positions `p`. */
export function couvertureDe(p: Float32Array, indices: ArrayLike<number>): Couverture {
  const grille = new Map<number, number[]>();
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const borne = (axe: number, f: (...v: number[]) => number) => cellule(f(p[a * 3 + axe], p[b * 3 + axe], p[c * 3 + axe]));
    const [x0, y0, z0, x1, y1, z1] = [borne(0, Math.min), borne(1, Math.min), borne(2, Math.min), borne(0, Math.max), borne(1, Math.max), borne(2, Math.max)];
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) {
      const liste = grille.get(cle(i, j, k));
      if (liste) liste.push(t);
      else grille.set(cle(i, j, k), [t]);
    }
  }
  return { positions: p, indices, grille };
}

/** Chaque triangle de `couverture` qui couvre le point (x, y, z) de normale (nx, ny, nz) : tourné du même côté que
 *  lui, à `PORTEE_DE_COUVERTURE_M` de lui au plus, la projection du point le long de la normale du triangle tombant
 *  dans le triangle. `visite` reçoit l'écart signé e du point au triangle, positif derrière, l'indice t de son premier
 *  sommet dans `couverture.indices`, les coordonnées barycentriques (a, b, c) de la projection et la normale unitaire
 *  (tx, ty, tz) du triangle. */
export function visiterLaCouverture(
  x: number, y: number, z: number, nx: number, ny: number, nz: number, couverture: Couverture,
  visite: (e: number, t: number, a: number, b: number, c: number, tx: number, ty: number, tz: number) => void,
): void {
  const { positions: p, indices, grille } = couverture;
  const [ci, cj, ck] = [cellule(x), cellule(y), cellule(z)];
  const vus = new Set<number>();
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
    for (const t of grille.get(cle(i, j, k)) ?? []) {
      if (vus.has(t)) continue;
      vus.add(t);
      const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
      const [ax, ay, az] = [p[a * 3], p[a * 3 + 1], p[a * 3 + 2]];
      const [ux, uy, uz] = [p[b * 3] - ax, p[b * 3 + 1] - ay, p[b * 3 + 2] - az];
      const [vx, vy, vz] = [p[c * 3] - ax, p[c * 3 + 1] - ay, p[c * 3 + 2] - az];
      let [tx, ty, tz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const aire2 = Math.hypot(tx, ty, tz);
      if (aire2 <= 0) continue;
      tx /= aire2; ty /= aire2; tz /= aire2;
      if (tx * nx + ty * ny + tz * nz <= 0) continue;
      const e = (ax - x) * tx + (ay - y) * ty + (az - z) * tz;
      if (Math.abs(e) > PORTEE_DE_COUVERTURE_M) continue;
      const [px, py, pz] = [x + e * tx - ax, y + e * ty - ay, z + e * tz - az];
      const [uu, uv, vv, pu, pv] = [ux * ux + uy * uy + uz * uz, ux * vx + uy * vy + uz * vz, vx * vx + vy * vy + vz * vz, px * ux + py * uy + pz * uz, px * vx + py * vy + pz * vz];
      const det = uu * vv - uv * uv;
      const bb = (vv * pu - uv * pv) / det, bc = (uu * pv - uv * pu) / det;
      if (bb < 0 || bc < 0 || bb + bc > 1) continue;
      visite(e, t, 1 - bb - bc, bb, bc, tx, ty, tz);
    }
  }
}

/** Une pièce résolue qui en couvre d'autres : la surface d'un de ses maillages, ses poids résolus et ceux de son auteur. */
interface Couvrant {
  readonly surface: Couverture;
  readonly resolus: Poids;
  readonly auteur: Poids;
}

/** Un point de la surface d'une pièce : ses sommets confondus, de tous ses maillages. */
interface Point {
  readonly membres: (readonly [MaillageDePile, number])[];
  readonly x: number;
  readonly y: number;
  readonly z: number;
  nx: number;
  ny: number;
  nz: number;
}

function souder(piece: PieceDePile): Point[] {
  const parCle = new Map<string, Point>();
  const pointDe = new Map<MaillageDePile, Point[]>();
  for (const m of piece.maillages) {
    const points: Point[] = [];
    const p = m.positions;
    for (let s = 0; s < p.length / 3; s++) {
      const k = `${Math.round(p[s * 3] / SOUDURE_M)}|${Math.round(p[s * 3 + 1] / SOUDURE_M)}|${Math.round(p[s * 3 + 2] / SOUDURE_M)}`;
      let point = parCle.get(k);
      if (!point) { point = { membres: [], x: p[s * 3], y: p[s * 3 + 1], z: p[s * 3 + 2], nx: 0, ny: 0, nz: 0 }; parCle.set(k, point); }
      point.membres.push([m, s]);
      points.push(point);
    }
    pointDe.set(m, points);
    const ind = m.indices;
    for (let t = 0; t + 2 < ind.length; t += 3) {
      const [a, b, c] = [ind[t], ind[t + 1], ind[t + 2]];
      const [ux, uy, uz] = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
      const [vx, vy, vz] = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
      const [nx, ny, nz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const s of [a, b, c]) { const q = points[s]; q.nx += nx; q.ny += ny; q.nz += nz; }
    }
  }
  return [...parCle.values()];
}

const fondu = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

interface Touche {
  readonly de: Couvrant;
  readonly coins: readonly (readonly [number, number])[];
  readonly e: number;
  readonly n: Vecteur;
}

/** Le triangle de `couvrants` qui couvre le point `q`, de normale (nx, ny, nz), au plus près, à `PERCEE_M` devant lui au
 *  plus ; `null` sans lui. */
function toucher(q: Point, nx: number, ny: number, nz: number, couvrants: readonly Couvrant[]): Touche | null {
  let touche: Touche | null = null;
  for (const de of couvrants) {
    const { indices } = de.surface;
    visiterLaCouverture(q.x, q.y, q.z, nx, ny, nz, de.surface, (e, t, a, b, c, tx, ty, tz) => {
      if (e < -PERCEE_M || (touche && Math.abs(e) >= Math.abs(touche.e))) return;
      touche = { de, coins: [[indices[t], a], [indices[t + 1], b], [indices[t + 2], c]], e, n: [tx, ty, tz] };
    });
  }
  return touche;
}

/** Les poids du sommet `s` de `m`, par nom d'os. */
function poidsParNom(m: Poids, s: number, part = 1, dans = new Map<string, number>()): Map<string, number> {
  for (let k = 0; k < INFLUENCES; k++) {
    const pk = m.poids[s * INFLUENCES + k] * part;
    if (pk > 0) { const nom = m.noms[m.os[s * INFLUENCES + k]]; dans.set(nom, (dans.get(nom) ?? 0) + pk); }
  }
  return dans;
}

/** La part des poids `a` et `b` portée par les mêmes os, plus `PART_D_UN_PARENT` fois celle portée par un os et son
 *  parent. */
function parente(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>, parents: ReadonlyMap<string, string>): number {
  const [ra, rb] = [new Map(a), new Map(b)];
  let memes = 0, voisins = 0;
  for (const [nom, pa] of a) {
    const commun = Math.min(pa, b.get(nom) ?? 0);
    memes += commun;
    ra.set(nom, pa - commun);
    rb.set(nom, (b.get(nom) ?? 0) - commun);
  }
  for (const [na, pa] of ra) for (const [nb, pb] of rb) {
    if (parents.get(na) !== nb && parents.get(nb) !== na) continue;
    const commun = Math.min(ra.get(na) ?? pa, pb);
    voisins += commun;
    ra.set(na, (ra.get(na) ?? pa) - commun);
    rb.set(nb, pb - commun);
  }
  return memes + PART_D_UN_PARENT * voisins;
}

/** Ce que la pièce `couvrants` fait du point `q`, de poids `propres` : `null` s'il n'est pas couvert, `'flotte'` si
 *  elle le couvre sans le retenir, ses poids d'origine portés par une chaîne plus que lui ou par d'autres os que les
 *  siens et leurs parents. */
function tenir(q: Point, propres: ReadonlyMap<string, number>, couvrants: readonly Couvrant[], squelette: SqueletteDePile): { touche: Touche; poids: Map<string, number>; part: number } | 'flotte' | null {
  const l = Math.hypot(q.nx, q.ny, q.nz);
  if (l <= 0) return null;
  const [qx, qy, qz] = [q.nx / l, q.ny / l, q.nz / l];
  const touche = toucher(q, qx, qy, qz, couvrants);
  if (!touche) return null;
  const poids = new Map<string, number>(), auteur = new Map<string, number>();
  for (const [s, coin] of touche.coins) { poidsParNom(touche.de.resolus, s, coin, poids); poidsParNom(touche.de.auteur, s, coin, auteur); }
  const deChaine = (p: ReadonlyMap<string, number>): number => { let c = 0; for (const [nom, pk] of p) if (squelette.osDeChaine.has(nom)) c += pk; return c; };
  const part = (1 - fondu((deChaine(auteur) - deChaine(propres)) / FLOTTEMENT)) * fondu(parente(propres, auteur, squelette.parents) / PARENTE)
    * (1 - fondu((touche.e - SERRAGE_M) / (PORTEE_DE_COUVERTURE_M - SERRAGE_M)));
  return part > 0 ? { touche, poids, part } : 'flotte';
}

/** Ce qu'un point reprend d'une couverture : des poids par nom d'os, de somme 1, pour la part `part` de ce qu'il lui
 *  reste. */
interface Reprise {
  readonly poids: ReadonlyMap<string, number>;
  readonly part: number;
}

const LIBRE: Reprise = { poids: new Map(), part: 0 };

/** Ce que chaque point de `points` reprend d'une couverture qui retient `tenues` : ce qu'elle en retient, ou, s'ils
 *  sont retenus plus que lui, les poids des points retenus à moins de `HALO_M` de lui, chacun pesé par sa proximité,
 *  pour une part qui s'éteint avec la distance au plus proche. */
function reprendre(points: readonly Point[], tenues: ReadonlyMap<Point, Reprise>): Map<Point, Reprise> {
  const cellule = (x: number): number => Math.floor(x / HALO_M);
  const grille = new Map<number, Point[]>();
  for (const q of tenues.keys()) {
    const k = cle(cellule(q.x), cellule(q.y), cellule(q.z));
    const liste = grille.get(k);
    if (liste) liste.push(q);
    else grille.set(k, [q]);
  }
  const reprises = new Map<Point, Reprise>(tenues);
  for (const q of points) {
    const [ci, cj, ck] = [cellule(q.x), cellule(q.y), cellule(q.z)];
    const poids = new Map<string, number>();
    let somme = 0, part = 0, proche = Infinity;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
      for (const c of grille.get(cle(i, j, k)) ?? []) {
        const d = Math.hypot(c.x - q.x, c.y - q.y, c.z - q.z);
        if (c === q || d >= HALO_M) continue;
        const tenue = tenues.get(c) as Reprise;
        const noyau = (1 - d / HALO_M) ** 2 / (d * d + SOUDURE_M * SOUDURE_M);
        for (const [nom, pk] of tenue.poids) poids.set(nom, (poids.get(nom) ?? 0) + noyau * pk);
        part += noyau * tenue.part;
        somme += noyau;
        proche = Math.min(proche, d);
      }
    }
    if (somme <= 0) continue;
    part = (part / somme) * (1 - fondu(proche / HALO_M));
    const propre = tenues.get(q) ?? LIBRE;
    if (propre.part >= part) continue;
    for (const [nom, pk] of poids) poids.set(nom, (pk / somme) * (part - propre.part) / part);
    for (const [nom, pk] of propre.poids) poids.set(nom, (poids.get(nom) ?? 0) + pk * propre.part / part);
    reprises.set(q, { poids, part });
  }
  return reprises;
}

/** Par point de `piece`, ses voisins d'arête et la raideur de chaque arête : la plus petite hauteur de ses triangles. */
function voisinsDe(piece: PieceDePile, pointDe: ReadonlyMap<MaillageDePile, Point[]>): Map<Point, Map<Point, number>> {
  const voisins = new Map<Point, Map<Point, number>>();
  const lier = (a: Point, b: Point, hauteur: number): void => {
    const de = voisins.get(a) ?? new Map<Point, number>();
    voisins.set(a, de);
    de.set(b, Math.min(de.get(b) ?? Infinity, hauteur));
  };
  for (const m of piece.maillages) {
    const de = pointDe.get(m) as Point[];
    for (let t = 0; t + 2 < m.indices.length; t += 3) {
      const [a, b, c] = [de[m.indices[t]], de[m.indices[t + 1]], de[m.indices[t + 2]]];
      const [ux, uy, uz, vx, vy, vz] = [b.x - a.x, b.y - a.y, b.z - a.z, c.x - a.x, c.y - a.y, c.z - a.z];
      const aire2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      const hauteur = aire2 / Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z), SOUDURE_M);
      for (const [p, q] of [[a, b], [b, c], [c, a]]) if (p !== q) { lier(p, q, hauteur); lier(q, p, hauteur); }
    }
  }
  return voisins;
}

/** Étend les reculs `reculs` de proche en proche, du plus grand au plus petit : le voisin d'un point ne recule pas d'un
 *  écart de plus de `ENTRAINEMENT` fois la raideur de leur arête, ce qui ne retourne aucun triangle. */
function entrainer(reculs: Map<Point, Vecteur>, voisins: ReadonlyMap<Point, ReadonlyMap<Point, number>>): void {
  const tas: [number, Point][] = [];
  const pousser = (q: Point, d: Vecteur): void => {
    let i = tas.push([Math.hypot(...d), q]) - 1;
    for (let p = (i - 1) >> 1; i > 0 && tas[p][0] < tas[i][0]; i = p, p = (i - 1) >> 1) [tas[p], tas[i]] = [tas[i], tas[p]];
  };
  const tirer = (): [number, Point] => {
    const tete = tas[0], queue = tas.pop() as [number, Point];
    if (tas.length) {
      tas[0] = queue;
      for (let i = 0; ;) {
        const [g, d] = [2 * i + 1, 2 * i + 2];
        const fort = d < tas.length && tas[d][0] > tas[g][0] ? d : g;
        if (fort >= tas.length || tas[fort][0] <= tas[i][0]) break;
        [tas[fort], tas[i]] = [tas[i], tas[fort]];
        i = fort;
      }
    }
    return tete;
  };
  for (const [q, d] of reculs) pousser(q, d);
  const faits = new Set<Point>();
  while (tas.length) {
    const [norme, meneur] = tirer();
    const dm = reculs.get(meneur) as Vecteur;
    if (faits.has(meneur) || norme !== Math.hypot(...dm)) continue;
    faits.add(meneur);
    for (const [suiveur, raideur] of voisins.get(meneur) ?? []) {
      if (faits.has(suiveur)) continue;
      const ds = reculs.get(suiveur) ?? NUL;
      const ecart = Math.hypot(dm[0] - ds[0], dm[1] - ds[1], dm[2] - ds[2]);
      if (ecart <= ENTRAINEMENT * raideur) continue;
      const garde = (ENTRAINEMENT * raideur) / ecart;
      const d: Vecteur = [dm[0] + (ds[0] - dm[0]) * garde, dm[1] + (ds[1] - dm[1]) * garde, dm[2] + (ds[2] - dm[2]) * garde];
      reculs.set(suiveur, d);
      pousser(suiveur, d);
    }
  }
}

/** Réduit les reculs `reculs` que leur extension laisse en conflit : sur une arête dont l'écart de recul dépasse encore
 *  `ENTRAINEMENT` fois sa raideur, le plus grand recul revient vers le plus petit. */
function apaiser(reculs: Map<Point, Vecteur>, voisins: ReadonlyMap<Point, ReadonlyMap<Point, number>>): void {
  for (let passe = 0, change = true; change && passe < PASSES_D_APAISEMENT; passe++) {
    change = false;
    for (const a of reculs.keys()) for (const [b, raideur] of voisins.get(a) ?? []) {
      const grand = reculs.get(a) as Vecteur, petit = reculs.get(b) ?? NUL;
      if (Math.hypot(...grand) < Math.hypot(...petit)) continue;
      const ecart = Math.hypot(grand[0] - petit[0], grand[1] - petit[1], grand[2] - petit[2]);
      if (ecart <= ENTRAINEMENT * raideur + SOUDURE_M) continue;
      const garde = (ENTRAINEMENT * raideur) / ecart;
      reculs.set(a, [petit[0] + (grand[0] - petit[0]) * garde, petit[1] + (grand[1] - petit[1]) * garde, petit[2] + (grand[2] - petit[2]) * garde]);
      change = true;
    }
  }
}

/** Les blocs rigides d'une pièce : ses points que des arêtes relient de proche en proche entre mêmes poids `propres`,
 *  par blocs de deux points au moins. */
function blocsRigides(voisins: ReadonlyMap<Point, ReadonlyMap<Point, number>>, propres: ReadonlyMap<Point, ReadonlyMap<string, number>>): Point[][] {
  const chef = new Map<Point, Point>();
  const chefDe = (q: Point): Point => {
    let c = q;
    for (let d = chef.get(c); d; d = chef.get(c)) c = d;
    if (c !== q) chef.set(q, c);
    return c;
  };
  for (const [a, de] of voisins) {
    const pa = propres.get(a) as ReadonlyMap<string, number>;
    for (const b of de.keys()) {
      const pb = propres.get(b) as ReadonlyMap<string, number>;
      const [ca, cb] = [chefDe(a), chefDe(b)];
      if (ca !== cb && pa.size === pb.size && [...pa].every(([nom, pk]) => pb.get(nom) === pk)) chef.set(ca, cb);
    }
  }
  const blocs = new Map<Point, Point[]>();
  for (const q of chef.keys()) {
    const c = chefDe(q);
    const bloc = blocs.get(c);
    if (bloc) bloc.push(q);
    else blocs.set(c, [c, q]);
  }
  return [...blocs.values()];
}

/** Pose sur chaque sommet de `q` les poids `repris` (par nom d'os, pour la part qu'ils disent) mêlés aux siens pour la
 *  part `reste`, réduits à `INFLUENCES` os et ramenés à 1, et le recul `recul`. */
function appliquer(q: Point, repris: ReadonlyMap<string, number>, reste: number, recul: Vecteur | undefined): void {
  for (const [m, s] of q.membres) {
    if (reste < 1) {
      const melange = poidsParNom(m, s, reste, new Map(repris));
      const forts = [...melange.entries()].sort((x, y) => y[1] - x[1]).slice(0, INFLUENCES);
      const somme = forts.reduce((t, [, pk]) => t + pk, 0);
      for (let k = 0; k < INFLUENCES; k++) {
        const fort = forts[k];
        let rang = 0;
        if (fort) { rang = m.noms.indexOf(fort[0]); if (rang < 0) rang = m.noms.push(fort[0]) - 1; }
        m.os[s * INFLUENCES + k] = rang;
        m.poids[s * INFLUENCES + k] = fort ? fort[1] / somme : 0;
      }
    }
    if (recul) for (let k = 0; k < 3; k++) m.positions[s * 3 + k] += recul[k];
  }
}

/** Résout la pile `pieces` en place : `couvre(e, f)` dit si la pièce `e` couvre la pièce `f`. */
export function resoudreLaPile(pieces: readonly PieceDePile[], couvre: (e: PieceDePile, f: PieceDePile) => boolean, squelette: SqueletteDePile): BilanDePile {
  const ordre: PieceDePile[] = [];
  for (const restantes = new Set(pieces); restantes.size;) {
    let libre: PieceDePile | null = null, moins = Infinity;
    for (const f of restantes) {
      const dessus = [...restantes].filter((e) => couvre(e, f)).length;
      if (dessus < moins) { moins = dessus; libre = f; }
    }
    ordre.push(libre as PieceDePile);
    restantes.delete(libre as PieceDePile);
  }
  const resolues: PieceDePile[] = [];
  const couvrantsDe = new Map<PieceDePile, Couvrant[]>();
  const origines = new Map(pieces.flatMap((p) => p.maillages).map((m) => [m, { os: Uint16Array.from(m.os), poids: Float32Array.from(m.poids), noms: m.noms }]));
  const retenir = (piece: PieceDePile): void => {
    couvrantsDe.set(piece, piece.maillages.map((m) => ({ surface: couvertureDe(m.positions, m.indices), resolus: m, auteur: origines.get(m) as Poids })));
  };
  let couverts = 0, suiveurs = 0, recules = 0, flottants = 0, masques = 0;
  for (const piece of ordre) {
    const couvertures = resolues.filter((e) => couvre(e, piece)).map((e) => couvrantsDe.get(e) as Couvrant[]);
    resolues.push(piece);
    if (!couvertures.length) { retenir(piece); continue; }
    const points = souder(piece);
    const propres = new Map(points.map((q) => [q, poidsParNom(...q.membres[0])]));
    const repris = new Map<Point, Map<string, number>>(), restes = new Map<Point, number>(), reculs = new Map<Point, Vecteur>();
    const tenus = new Set<Point>(), pleins = new Set<Point>(), laisses = new Set<Point>();
    for (const couvrants of couvertures) {
      const tenues = new Map<Point, Reprise>();
      for (const q of points) {
        const tenue = tenir(q, propres.get(q) as Map<string, number>, couvrants, squelette);
        if (tenue === 'flotte') laisses.add(q);
        if (!tenue || tenue === 'flotte') continue;
        const { touche: { e, n }, poids, part } = tenue;
        tenues.set(q, { poids, part });
        tenus.add(q);
        if (part >= 1) pleins.add(q);
        const pas = part * Math.min(0, e - JEU_M), deja = reculs.get(q);
        if (pas < 0 && (!deja || -pas > Math.hypot(...deja))) reculs.set(q, [pas * n[0], pas * n[1], pas * n[2]]);
      }
      for (const [q, { poids, part }] of reprendre(points, tenues)) {
        const reste = restes.get(q) ?? 1;
        const melange = repris.get(q) ?? new Map<string, number>();
        for (const [nom, pk] of poids) melange.set(nom, (melange.get(nom) ?? 0) + reste * part * pk);
        repris.set(q, melange);
        restes.set(q, reste * (1 - part));
      }
    }
    for (const q of laisses) if (!tenus.has(q)) flottants++;
    if (!repris.size) { retenir(piece); continue; }
    const pointDe = new Map<MaillageDePile, Point[]>(piece.maillages.map((m) => [m, new Array<Point>(m.positions.length / 3)]));
    for (const q of points) for (const [m, s] of q.membres) (pointDe.get(m) as Point[])[s] = q;
    const voisins = voisinsDe(piece, pointDe);
    entrainer(reculs, voisins);
    apaiser(reculs, voisins);
    for (const bloc of blocsRigides(voisins, propres)) {
      if (!bloc.some((q) => repris.has(q))) continue;
      const cede = Math.min(...bloc.map((q) => 1 - (restes.get(q) ?? 1)));
      const melange = new Map<string, number>();
      if (cede > 0) for (const q of bloc) {
        const part = (1 - (restes.get(q) as number)) * bloc.length / cede;
        for (const [nom, pk] of repris.get(q) as Map<string, number>) melange.set(nom, (melange.get(nom) ?? 0) + pk / part);
      }
      for (const q of bloc) {
        if (cede > 0) { repris.set(q, melange); restes.set(q, 1 - cede); }
        else { repris.delete(q); restes.delete(q); }
      }
    }
    for (const q of points) {
      if (repris.has(q) || reculs.has(q)) appliquer(q, repris.get(q) ?? new Map(), restes.get(q) ?? 1, reculs.get(q));
      if (tenus.has(q)) couverts++;
      else if (repris.has(q)) suiveurs++;
      if (reculs.has(q)) recules++;
    }
    retenir(piece);
    for (const m of piece.maillages) {
      const de = pointDe.get(m) as Point[];
      const gardes: number[] = [];
      for (let t = 0; t + 2 < m.indices.length; t += 3) {
        if (pleins.has(de[m.indices[t]]) && pleins.has(de[m.indices[t + 1]]) && pleins.has(de[m.indices[t + 2]])) masques++;
        else gardes.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
      }
      m.indices = Uint32Array.from(gardes);
    }
  }
  return { couverts, suiveurs, recules, flottants, masques };
}
