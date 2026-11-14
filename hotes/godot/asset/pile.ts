/**
 * LA PILE DES COUCHES RÉSOLUE AU MONTAGE (#3842) : dans une tenue montée, la couche du dessous cède à celle qui la
 * couvre. Les pièces se résolvent de la plus extérieure à la plus intérieure, sur la tenue posée au repos, sans rien
 * lire d'une pièce que sa géométrie et ses poids.
 *
 * Un point est couvert par le triangle le plus proche de l'endroit d'une pièce qui couvre la sienne (`endroitDe` : la
 * doublure d'une double nappe ne couvre rien), tourné du même côté que son dehors (`dehorsDesSommets`), à
 * `PORTEE_DE_COUVERTURE_M` derrière lui au plus, ou `PERCEE_M` devant. Sa couverture le retient : il reprend, au point couvrant, les
 * poids de peau qu'elle a une fois résolue, tout entier jusqu'à `SERRAGE_M` d'elle, de moins en moins jusqu'à
 * `PORTEE_DE_COUVERTURE_M`. Elle ne le retient pas si elle flotte sur une chaîne plus que lui (`FLOTTEMENT`, à
 * `EGALITE_DE_CHAINE` près), ni si elle tient à
 * une autre partie du corps que lui (`PARENTE`). Les points de sa pièce à moins de `HALO_M` d'un point plus retenu
 * qu'eux le suivent, en fondu avec la distance, ses voisins d'arête aussi quelle que soit la longueur de l'arête, à
 * `SAUT_D_ARETE` de poids déplacés près, et des points que leur auteur a liés aux mêmes poids restent liés pareil.
 *
 * Un point retenu devant sa couverture, ou à moins de `JEU_M` derrière elle, recule à `JEU_M`, et ses voisins d'arête
 * reculent avec lui sans qu'aucun triangle se retourne (`ENTRAINEMENT`). Un triangle dont les trois points sont retenus
 * tout entiers ne se dessine plus.
 *
 * Qui couvre qui se lit aux couches déclarées, et se mesure entre deux pièces de même couche (`ordreDesCouches`).
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
/** La part de poids que sa couverture déplace à un point sans que ses voisins d'arête le suivent. */
export const SAUT_D_ARETE = 1 / 3;
/** L'écart de poids de chaîne, couverture moins sujet, à partir duquel la couverture flotte et ne retient rien. */
export const FLOTTEMENT = 0.5;
/** L'écart de poids de chaîne, couverture moins sujet, sous lequel elle ne flotte pas plus que lui : une pièce qui
 *  emprunte les poids de celle qu'elle couvre (la feuille du sceau de cire sur la bure, #3867) en porte la même part au
 *  bruit près (3,8e-8 relevé), que Godot quantifie sur 16 bits (jusqu'à 4 × 7,6e-6 par point) ; départagés à zéro, ces
 *  points retenus tout entiers ou non différaient entre l'évaluateur et la fusion (masques 156 contre 152). */
export const EGALITE_DE_CHAINE = 1e-4;
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
  /** Par sommet, `INFLUENCES` poids, que `resoudreLaPile` ramène à une somme de 1. */
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

/** Les coordonnées barycentriques, sur les côtés u et v d'un triangle, du point p de son plan donné depuis son premier
 *  sommet ; `null` pour un point à plus de `SOUDURE_M` des bords du triangle, hors de lui (#3842). */
function coinsDe(px: number, py: number, pz: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number): readonly [number, number] | null {
  const [uu, uv, vv, pu, pv] = [ux * ux + uy * uy + uz * uz, ux * vx + uy * vy + uz * vz, vx * vx + vy * vy + vz * vz, px * ux + py * uy + pz * uz, px * vx + py * vy + pz * vz];
  const det = uu * vv - uv * uv;
  const bb = (vv * pu - uv * pv) / det, bc = (uu * pv - uv * pu) / det;
  const [bu, bv] = [SOUDURE_M / Math.sqrt(uu), SOUDURE_M / Math.sqrt(vv)];
  return bb < -bu || bc < -bv || bb + bc > 1 + Math.max(bu, bv) ? null : [bb, bc];
}

/** Chaque triangle de `couverture` qui couvre le point (x, y, z) de normale (nx, ny, nz) : tourné du même côté que
 *  lui, à `PORTEE_DE_COUVERTURE_M` de lui au plus, la projection du point le long de la normale du triangle tombant
 *  dans le triangle ou à `SOUDURE_M` au plus de ses bords (#3842). `visite` reçoit l'écart signé e du point au
 *  triangle, positif derrière, l'indice t de son premier sommet dans `couverture.indices`, les coordonnées
 *  barycentriques (a, b, c) de la projection et la normale unitaire (tx, ty, tz) du triangle. */
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
      const coins = coinsDe(x + e * tx - ax, y + e * ty - ay, z + e * tz - az, ux, uy, uz, vx, vy, vz);
      if (coins) visite(e, t, 1 - coins[0] - coins[1], coins[0], coins[1], tx, ty, tz);
    }
  }
}

/** Chaque triangle de `couverture` que traverse le segment de (ax, ay, az) à (bx, by, bz) : `visite` reçoit la part du
 *  segment faite à la traversée, de 0 en a à 1 en b, et l'écart signé de a au triangle, positif derrière. */
export function croiserLaCouverture(
  ax: number, ay: number, az: number, bx: number, by: number, bz: number, couverture: Couverture,
  visite: (part: number, ea: number) => void,
): void {
  const { positions: p, indices, grille } = couverture;
  const vus = new Set<number>();
  for (let i = cellule(Math.min(ax, bx)); i <= cellule(Math.max(ax, bx)); i++) for (let j = cellule(Math.min(ay, by)); j <= cellule(Math.max(ay, by)); j++) for (let k = cellule(Math.min(az, bz)); k <= cellule(Math.max(az, bz)); k++) {
    for (const t of grille.get(cle(i, j, k)) ?? []) {
      if (vus.has(t)) continue;
      vus.add(t);
      const o = indices[t] * 3, [ox, oy, oz] = [p[o], p[o + 1], p[o + 2]];
      const [ux, uy, uz] = [p[indices[t + 1] * 3] - ox, p[indices[t + 1] * 3 + 1] - oy, p[indices[t + 1] * 3 + 2] - oz];
      const [vx, vy, vz] = [p[indices[t + 2] * 3] - ox, p[indices[t + 2] * 3 + 1] - oy, p[indices[t + 2] * 3 + 2] - oz];
      let [tx, ty, tz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const aire2 = Math.hypot(tx, ty, tz);
      if (aire2 <= 0) continue;
      tx /= aire2; ty /= aire2; tz /= aire2;
      const ea = (ox - ax) * tx + (oy - ay) * ty + (oz - az) * tz, eb = (ox - bx) * tx + (oy - by) * ty + (oz - bz) * tz;
      if (ea * eb >= 0) continue;
      const part = ea / (ea - eb);
      if (coinsDe(ax + part * (bx - ax) - ox, ay + part * (by - ay) - oy, az + part * (bz - az) - oz, ux, uy, uz, vx, vy, vz)) visite(part, ea);
    }
  }
}

/** Une surface posée : ses positions à plat et ses triangles, par trois indices de sommet. */
export interface SurfaceDePile {
  readonly positions: Float32Array;
  readonly indices: ArrayLike<number>;
}

/** Les normales de sommet de `surface`, somme des normales de ses triangles pondérées par leur aire. */
export function normalesDesSommets({ positions: p, indices }: SurfaceDePile): Float32Array {
  const normales = new Float32Array(p.length);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const [ux, uy, uz] = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const [vx, vy, vz] = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    const [nx, ny, nz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    for (const s of [a, b, c]) { normales[s * 3] += nx; normales[s * 3 + 1] += ny; normales[s * 3 + 2] += nz; }
  }
  return normales;
}

/** L'endroit de `surface` : ses triangles, par trois indices, tournés à l'opposé du point de `peaux` (des positions à
 *  plat) le plus proche de leur centre, ou dont ce point est dans leur plan à `SOUDURE_M` près (#3842) ; tous, sans
 *  peau. La doublure d'une double nappe, tournée vers le corps, n'en est pas. */
export function endroitDe({ positions: p, indices }: SurfaceDePile, peaux: readonly Float32Array[]): Uint32Array {
  const endroit: number[] = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const [cx, cy, cz] = [(p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3];
    let proche = Infinity, [dx, dy, dz] = [0, 0, 0];
    for (const q of peaux) for (let s = 0; s < q.length; s += 3) {
      const d = (cx - q[s]) ** 2 + (cy - q[s + 1]) ** 2 + (cz - q[s + 2]) ** 2;
      if (d < proche) [proche, dx, dy, dz] = [d, cx - q[s], cy - q[s + 1], cz - q[s + 2]];
    }
    const [ux, uy, uz, vx, vy, vz] = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2], p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const [nx, ny, nz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (nx * dx + ny * dy + nz * dz >= -SOUDURE_M * Math.hypot(nx, ny, nz)) endroit.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return Uint32Array.from(endroit);
}

/** Le dehors de chaque sommet de `surface` : la somme des normales, pondérées par leur aire, de ses triangles de
 *  l'`endroit` (`endroitDe`), moins celle de ses autres triangles. */
export function dehorsDesSommets(surface: SurfaceDePile, endroit: ArrayLike<number>): Float32Array {
  const dehors = normalesDesSommets({ positions: surface.positions, indices: endroit }), toutes = normalesDesSommets(surface);
  for (let i = 0; i < dehors.length; i++) dehors[i] = 2 * dehors[i] - toutes[i];
  return dehors;
}

/** Ce que l'ordre des couches lit d'une pièce d'une tenue. */
export interface CoucheDePile {
  /** Le rang de sa couche dans `COUCHES` (`element.ts`), `RANG_DU_CORPS` pour le corps. */
  readonly rang: number;
  /** Vrai pour un accessoire : à couche égale, il se porte par-dessus ce qui n'en est pas un. */
  readonly accessoire: boolean;
  /** Ses surfaces au repos neutre, sans forme ni gabarit. */
  readonly neutres: readonly SurfaceDePile[];
}

/** Les voix des sommets de `sujet`, de dehors `n` (`dehorsDesSommets`), que `couverture` couvre : pour `sujet` s'ils
 *  sont devant leur triangle couvrant le plus proche, contre lui s'ils sont derrière (à distance égale, derrière). */
function voter(sujet: SurfaceDePile, n: Float32Array, couverture: Couverture): { pour: number; contre: number } {
  const p = sujet.positions;
  let pour = 0, contre = 0;
  for (let s = 0; s < p.length / 3; s++) {
    let derriere = Infinity, devant = Infinity;
    visiterLaCouverture(p[s * 3], p[s * 3 + 1], p[s * 3 + 2], n[s * 3], n[s * 3 + 1], n[s * 3 + 2], couverture, (e) => {
      if (e > 0) derriere = Math.min(derriere, e);
      if (e < 0) devant = Math.min(devant, -e);
    });
    if (derriere < Infinity && derriere <= devant) contre++;
    else if (devant < Infinity) pour++;
  }
  return { pour, contre };
}

/** Dit, pour deux pièces d'une tenue, si `e` couvre `f` : couche plus extérieure ; à couche égale, un accessoire couvre
 *  ce qui n'en est pas un ; sinon celle dont les sommets sont devant l'endroit de l'autre au repos neutre, à la majorité
 *  des voix (`voter`), chaque paire votée une fois. Sans sommet de l'une couvert par l'autre, ou à égalité, aucune ne
 *  couvre l'autre. `peaux` : les positions au repos de la peau de la tenue (`peauDeLaTenue`, `evaluateur/corps.ts`), d'où
 *  se lit l'endroit (`endroitDe`). */
export function ordreDesCouches<E extends CoucheDePile>(peaux: readonly Float32Array[]): (e: E, f: E) => boolean {
  const votantes = new Map<SurfaceDePile, { dehors: Float32Array; couverture: Couverture }>();
  const votante = (s: SurfaceDePile) => {
    let connue = votantes.get(s);
    if (!connue) {
      const endroit = endroitDe(s, peaux);
      connue = { dehors: dehorsDesSommets(s, endroit), couverture: couvertureDe(s.positions, endroit) };
      votantes.set(s, connue);
    }
    return connue;
  };
  const avances = new Map<E, Map<E, number>>();
  /** Les voix pour `e` moins les voix pour `f`. */
  const avance = (e: E, f: E): number => {
    const deE = avances.get(e) ?? new Map<E, number>();
    avances.set(e, deE);
    let voix = deE.get(f);
    if (voix === undefined) {
      voix = 0;
      for (const se of e.neutres) for (const sf of f.neutres) {
        const [ve, vf] = [votante(se), votante(sf)];
        const [deSe, deSf] = [voter(se, ve.dehors, vf.couverture), voter(sf, vf.dehors, ve.couverture)];
        voix += deSe.pour + deSf.contre - deSe.contre - deSf.pour;
      }
      deE.set(f, voix);
    }
    return voix;
  };
  return (e, f) => {
    if (e === f || f.rang > e.rang) return false;
    if (f.rang < e.rang) return true;
    if (e.accessoire !== f.accessoire) return e.accessoire;
    return (avances.get(f)?.has(e) ? -avance(f, e) : avance(e, f)) > 0;
  };
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

function souder(piece: PieceDePile, endroits: ReadonlyMap<MaillageDePile, Uint32Array>): Point[] {
  const parCle = new Map<string, Point>();
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
    const dehors = dehorsDesSommets(m, endroits.get(m) as Uint32Array);
    points.forEach((q, s) => { q.nx += dehors[s * 3]; q.ny += dehors[s * 3 + 1]; q.nz += dehors[s * 3 + 2]; });
  }
  return [...parCle.values()];
}

const fondu = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

interface Touche {
  readonly de: Couvrant;
  readonly coins: readonly (readonly [number, number])[];
  readonly e: number;
  /** La normale unitaire du triangle, ou la somme normée de celles des triangles couvrants dont l'écart égale le sien à
   *  `SOUDURE_M` près (#3842). */
  readonly n: Vecteur;
}

/** Le triangle de `couvrants` qui couvre le point `q`, de normale (nx, ny, nz), au plus près, à `PERCEE_M` devant lui au
 *  plus ; `null` sans lui. Un triangle couvrant dont l'écart égale celui du retenu à `SOUDURE_M` près ne le remplace pas
 *  et ajoute sa normale à la sienne ; un triangle plus près de plus de `SOUDURE_M` le remplace (#3842). */
function toucher(q: Point, nx: number, ny: number, nz: number, couvrants: readonly Couvrant[]): Touche | null {
  let touche = null as Omit<Touche, 'n'> | null, normales = 0;
  const somme: Vecteur = [0, 0, 0];
  for (const de of couvrants) {
    const { indices } = de.surface;
    visiterLaCouverture(q.x, q.y, q.z, nx, ny, nz, de.surface, (e, t, a, b, c, tx, ty, tz) => {
      if (e < -PERCEE_M) return;
      const ecart = touche ? Math.abs(e) - Math.abs(touche.e) : -Infinity;
      if (ecart > SOUDURE_M) return;
      if (ecart >= -SOUDURE_M) { somme[0] += tx; somme[1] += ty; somme[2] += tz; normales++; return; }
      touche = { de, coins: [[indices[t], a], [indices[t + 1], b], [indices[t + 2], c]], e };
      [somme[0], somme[1], somme[2], normales] = [tx, ty, tz, 1];
    });
  }
  if (!touche) return null;
  const l = normales > 1 ? Math.hypot(...somme) : 1;
  return { ...touche, n: [somme[0] / l, somme[1] / l, somme[2] / l] };
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
  const part = (1 - fondu((deChaine(auteur) - deChaine(propres) - EGALITE_DE_CHAINE) / FLOTTEMENT)) * fondu(parente(propres, auteur, squelette.parents) / PARENTE)
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
 *  pour la plus grande part que l'un d'eux lui laisse, la sienne éteinte avec leur distance. Une arête plus longue que
 *  ce fondu ne porte pas tout l'écart : les voisins d'arête (`voisins`) d'un point en reprennent les poids pour sa
 *  part, moins ce qu'il faut pour que la part de ses poids `propres` déplacée sans eux tienne en `SAUT_D_ARETE`. */
function reprendre(
  points: readonly Point[], tenues: ReadonlyMap<Point, Reprise>, voisins: ReadonlyMap<Point, ReadonlyMap<Point, number>>,
  propres: ReadonlyMap<Point, ReadonlyMap<string, number>>,
): Map<Point, Reprise> {
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
    let somme = 0, part = 0;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
      for (const c of grille.get(cle(i, j, k)) ?? []) {
        const d = Math.hypot(c.x - q.x, c.y - q.y, c.z - q.z);
        if (c === q || d >= HALO_M) continue;
        const tenue = tenues.get(c) as Reprise;
        const noyau = (1 - d / HALO_M) ** 2 / (d * d + SOUDURE_M * SOUDURE_M);
        for (const [nom, pk] of tenue.poids) poids.set(nom, (poids.get(nom) ?? 0) + noyau * pk);
        part = Math.max(part, tenue.part * (1 - fondu(d / HALO_M)));
        somme += noyau;
      }
    }
    if (somme <= 0) continue;
    const propre = tenues.get(q) ?? LIBRE;
    if (propre.part >= part) continue;
    for (const [nom, pk] of poids) poids.set(nom, (pk / somme) * (part - propre.part) / part);
    for (const [nom, pk] of propre.poids) poids.set(nom, (poids.get(nom) ?? 0) + pk * propre.part / part);
    reprises.set(q, { poids, part });
  }
  for (const [q, { poids, part }] of [...reprises].sort(([, a], [, b]) => b.part - a.part)) {
    let memes = 0;
    for (const [nom, pk] of propres.get(q) as ReadonlyMap<string, number>) memes += Math.min(pk, poids.get(nom) ?? 0);
    if (part * (1 - memes) <= SAUT_D_ARETE) continue;
    const due = part - SAUT_D_ARETE / (1 - memes);
    for (const v of voisins.get(q)?.keys() ?? []) {
      const propre = reprises.get(v) ?? LIBRE;
      if (propre.part >= due) continue;
      const melange = new Map<string, number>();
      for (const [nom, pk] of propre.poids) melange.set(nom, pk * propre.part / due);
      for (const [nom, pk] of poids) melange.set(nom, (melange.get(nom) ?? 0) + pk * (due - propre.part) / due);
      reprises.set(v, { poids: melange, part: due });
    }
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
 *  part `reste`, réduits à `INFLUENCES` os et ramenés à 1, et le recul `recul`. Chaque os gardé perd le poids du plus
 *  fort os écarté : un os s'éteint avant de sortir, et deux points voisins qui n'écartent pas le même os gardent des
 *  poids voisins. */
function appliquer(q: Point, repris: ReadonlyMap<string, number>, reste: number, recul: Vecteur | undefined): void {
  for (const [m, s] of q.membres) {
    if (reste < 1) {
      const melange = poidsParNom(m, s, reste, new Map(repris));
      const tries = [...melange.entries()].sort((x, y) => y[1] - x[1]);
      const forts = tries.slice(0, INFLUENCES);
      let ecarte = tries[INFLUENCES]?.[1] ?? 0;
      if (forts[0][1] <= ecarte) ecarte = 0;
      const somme = forts.reduce((t, [, pk]) => t + pk - ecarte, 0);
      for (let k = 0; k < INFLUENCES; k++) {
        const fort = forts[k];
        let rang = 0;
        if (fort && fort[1] > ecarte) { rang = m.noms.indexOf(fort[0]); if (rang < 0) rang = m.noms.push(fort[0]) - 1; }
        m.os[s * INFLUENCES + k] = rang;
        m.poids[s * INFLUENCES + k] = fort ? (fort[1] - ecarte) / somme : 0;
      }
    }
    if (recul) for (let k = 0; k < 3; k++) m.positions[s * 3 + k] += recul[k];
  }
}

/** Résout la pile `pieces` en place : `couvre(e, f)` dit si la pièce `e` couvre la pièce `f`. `peaux` : les positions
 *  au repos de la peau de la tenue (`peauDeLaTenue`, `evaluateur/corps.ts`), d'où se lit l'endroit de chaque pièce
 *  (`endroitDe`) ; une pièce qui n'en couvre aucune est tout entière à l'endroit. */
export function resoudreLaPile<P extends PieceDePile>(pieces: readonly P[], couvre: (e: P, f: P) => boolean, squelette: SqueletteDePile, peaux: readonly Float32Array[]): BilanDePile {
  for (const { poids } of pieces.flatMap((p) => p.maillages)) for (let s = 0; s < poids.length; s += INFLUENCES) {
    const somme = poids[s] + poids[s + 1] + poids[s + 2] + poids[s + 3];
    if (somme > 0) for (let k = 0; k < INFLUENCES; k++) poids[s + k] /= somme;
  }
  const ordre: P[] = [];
  for (const restantes = new Set(pieces); restantes.size;) {
    let libre: P | null = null, moins = Infinity;
    for (const f of restantes) {
      const dessus = [...restantes].filter((e) => couvre(e, f)).length;
      if (dessus < moins) { moins = dessus; libre = f; }
    }
    ordre.push(libre as P);
    restantes.delete(libre as P);
  }
  const resolues: P[] = [];
  const couvrantsDe = new Map<PieceDePile, Couvrant[]>();
  const origines = new Map(pieces.flatMap((p) => p.maillages).map((m) => [m, { os: Uint16Array.from(m.os), poids: Float32Array.from(m.poids), noms: m.noms }]));
  const endroits = new Map(pieces.flatMap((piece) => {
    const nue = !pieces.some((f) => couvre(piece, f));
    return piece.maillages.map((m) => [m, nue ? m.indices : endroitDe(m, peaux)] as const);
  }));
  const retenir = (piece: PieceDePile): void => {
    couvrantsDe.set(piece, piece.maillages.map((m) => ({ surface: couvertureDe(m.positions, endroits.get(m) as Uint32Array), resolus: m, auteur: origines.get(m) as Poids })));
  };
  let couverts = 0, suiveurs = 0, recules = 0, flottants = 0, masques = 0;
  for (const piece of ordre) {
    const couvertures = resolues.filter((e) => couvre(e, piece)).map((e) => couvrantsDe.get(e) as Couvrant[]);
    resolues.push(piece);
    if (!couvertures.length) { retenir(piece); continue; }
    const points = souder(piece, endroits);
    const propres = new Map(points.map((q) => [q, poidsParNom(...q.membres[0])]));
    const repris = new Map<Point, Map<string, number>>(), restes = new Map<Point, number>(), reculs = new Map<Point, Vecteur>();
    const tenus = new Set<Point>(), pleins = new Set<Point>(), laisses = new Set<Point>();
    const pointDe = new Map<MaillageDePile, Point[]>(piece.maillages.map((m) => [m, new Array<Point>(m.positions.length / 3)]));
    for (const q of points) for (const [m, s] of q.membres) (pointDe.get(m) as Point[])[s] = q;
    const voisins = voisinsDe(piece, pointDe);
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
      for (const [q, { poids, part }] of reprendre(points, tenues, voisins, propres)) {
        const reste = restes.get(q) ?? 1;
        const melange = repris.get(q) ?? new Map<string, number>();
        for (const [nom, pk] of poids) melange.set(nom, (melange.get(nom) ?? 0) + reste * part * pk);
        repris.set(q, melange);
        restes.set(q, reste * (1 - part));
      }
    }
    for (const q of laisses) if (!tenus.has(q)) flottants++;
    if (!repris.size) { retenir(piece); continue; }
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
