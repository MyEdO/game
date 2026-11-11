/**
 * GARDE DE LA TRAVERSÉE DES COUCHES (#2972, #3319, #3842) : une couche ne passe pas devant celle qui la couvre. Le
 * corps est sous toute couche ; un mesh skinné d'élément est sous ceux des éléments de couche plus extérieure (`COUCHES`,
 * `element.ts`) et sous ceux de l'élément de même couche qui le couvre (`ordreDesCouches`). Les meshes masqués au montage
 * (`sansLesZonesMasquees`) ne sont ni sujets ni couvertures.
 *
 * Un triangle de la couverture couvre un sommet d'un sujet selon `visiterLaCouverture` (`pile.ts`), qui donne son écart
 * signé e, positif derrière. Une doublure tournée vers le corps ne couvre rien.
 *
 * Au repos, chaque sommet se lie au triangle couvrant le plus proche dont il est derrière : le point lié p, aux
 * coordonnées barycentriques de la projection, suit la couverture. À chaque échantillon, l'écart signé e(v) = (p − v)·n,
 * n la normale du triangle posé : `couche-traversee` si un sommet a e(v) < −`ECART_DE_SUIVI_M`, un écart par (sujet,
 * couverture, clip), à son pire instant.
 *
 * Au repos neutre, un sommet est percé si un triangle couvrant le met devant lui de plus de `ECART_DE_SUIVI_M` :
 * `couche-percee-au-repos`, un écart par (sujet, couverture), avec le compte et le pire écart.
 */
import { Triangle, Vector3, type Mesh, type SkinnedMesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { RANG_DU_CORPS } from '../../element.ts';
import { couvertureDe, visiterLaCouverture } from '../../pile.ts';

const GARDE = 'traversee';

/** Les sommets d'un sujet liés sous une couverture : pour chaque sommet lié, son indice, les trois sommets du triangle
 *  de la couverture et les coordonnées barycentriques du point lié. */
export interface LiaisonDeCouches {
  readonly sujet: Mesh;
  readonly couverture: SkinnedMesh;
  readonly sommets: Uint32Array;
  readonly triangles: Uint32Array;
  readonly barycentres: Float32Array;
}

/** Les sommets d'un sujet percés au repos par sa couverture : leur nombre et l'écart signé le plus négatif. */
export interface PercementAuRepos {
  readonly sujet: Mesh;
  readonly couverture: SkinnedMesh;
  readonly sommets: number;
  readonly pire: number;
}

/** Ce que la couverture fait des sommets d'un sujet au repos : la liaison, les sommets devant (`devant`) ou derrière
 *  (`derriere`) leur triangle couvrant le plus proche, et le percement. */
interface ReleveSous {
  readonly liaison: LiaisonDeCouches | null;
  readonly devant: number;
  readonly derriere: number;
  readonly percement: PercementAuRepos | null;
}

export interface TraverseeDUnEchantillon {
  readonly liaison: LiaisonDeCouches;
  readonly clip: string;
  readonly t: number;
  /** Le nombre de sommets au-delà de la tolérance, et l'écart signé le plus négatif. */
  readonly sommets: number;
  readonly pire: number;
}

export const positionsDe = (pose: Pick<Pose, 'positions'>, m: Mesh): Float32Array => {
  const p = pose.positions.get(m);
  if (!p) throw new Error(`${GARDE} : mesh absent ${m.name}`);
  return p;
};

export function indicesDe(m: Mesh, n: number): ArrayLike<number> {
  const { index } = m.geometry;
  return index ? index.array : Uint32Array.from({ length: n }, (_, i) => i);
}

const forme = new Triangle(), normale = new Vector3(), v = new Vector3(), projection = new Vector3();

function poserTriangle(p: Float32Array, a: number, b: number, c: number): boolean {
  forme.a.set(p[a * 3], p[a * 3 + 1], p[a * 3 + 2]);
  forme.b.set(p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
  forme.c.set(p[c * 3], p[c * 3 + 1], p[c * 3 + 2]);
  if (forme.getArea() <= 0) return false;
  forme.getNormal(normale);
  return true;
}

/** Les normales de sommet de `m` aux positions `p`, somme des normales de ses triangles pondérées par leur aire. */
export function normalesDe(m: Mesh, p: Float32Array): Float32Array {
  const indices = indicesDe(m, p.length / 3);
  const normales = new Float32Array(p.length);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const sommets = [indices[t], indices[t + 1], indices[t + 2]];
    forme.a.set(p[sommets[0] * 3], p[sommets[0] * 3 + 1], p[sommets[0] * 3 + 2]);
    forme.b.set(p[sommets[1] * 3], p[sommets[1] * 3 + 1], p[sommets[1] * 3 + 2]);
    forme.c.set(p[sommets[2] * 3], p[sommets[2] * 3 + 1], p[sommets[2] * 3 + 2]);
    normale.subVectors(forme.c, forme.b).cross(projection.subVectors(forme.a, forme.b));
    for (const s of sommets) { normales[s * 3] += normale.x; normales[s * 3 + 1] += normale.y; normales[s * 3 + 2] += normale.z; }
  }
  return normales;
}

/** Ce que `couverture` fait des sommets de `sujet` dans la pose `repos`. */
function releverSous(sujet: Mesh, couverture: SkinnedMesh, repos: Pick<Pose, 'positions'>): ReleveSous {
  const ps = positionsDe(repos, sujet);
  const ns = normalesDe(sujet, ps);
  const pc = positionsDe(repos, couverture);
  const surface = couvertureDe(pc, indicesDe(couverture, pc.length / 3));
  const sommets: number[] = [], triangles: number[] = [], barycentres: number[] = [];
  let devant = 0, derriere = 0, perces = 0, pire = 0;
  for (let s = 0; s < ps.length / 3; s++) {
    let retenu = -1, auPlusPresDerriere = Infinity, plusProcheDevant = -Infinity, plusLoinDevant = 0, bx = 0, by = 0, bz = 0;
    visiterLaCouverture(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2], ns[s * 3], ns[s * 3 + 1], ns[s * 3 + 2], surface, (e, t, a, b, c) => {
      if (e > 0 && e < auPlusPresDerriere) { retenu = t; auPlusPresDerriere = e; bx = a; by = b; bz = c; }
      if (e < 0) { plusProcheDevant = Math.max(plusProcheDevant, e); plusLoinDevant = Math.min(plusLoinDevant, e); }
    });
    if (retenu >= 0 && auPlusPresDerriere <= -plusProcheDevant) derriere++;
    else if (plusProcheDevant > -Infinity) devant++;
    if (plusLoinDevant < -ECART_DE_SUIVI_M) { perces++; pire = Math.min(pire, plusLoinDevant); }
    if (retenu < 0) continue;
    sommets.push(s);
    triangles.push(surface.indices[retenu], surface.indices[retenu + 1], surface.indices[retenu + 2]);
    barycentres.push(bx, by, bz);
  }
  return {
    liaison: sommets.length ? { sujet, couverture, sommets: Uint32Array.from(sommets), triangles: Uint32Array.from(triangles), barycentres: Float32Array.from(barycentres) } : null,
    devant, derriere,
    percement: perces ? { sujet, couverture, sommets: perces, pire } : null,
  };
}

type Relever = (sujet: SkinnedMesh, couverture: SkinnedMesh) => ReleveSous;

/** Lequel de deux éléments de même couche, de meshes `a` et `b`, couvre l'autre. Chaque sommet de l'un qu'un triangle de
 *  l'autre couvre vote : pour son mesh s'il est devant son triangle couvrant le plus proche, pour l'autre s'il est
 *  derrière (à distance égale, derrière). `'a'` ou `'b'` à la majorité des voix ; `null` si aucun sommet de l'un n'est
 *  couvert par l'autre, ou à égalité. */
function ordreDesReleves(a: readonly SkinnedMesh[], b: readonly SkinnedMesh[], relever: Relever): 'a' | 'b' | null {
  let pourA = 0, pourB = 0;
  for (const ma of a) for (const mb of b) {
    const aSousB = relever(ma, mb), bSousA = relever(mb, ma);
    pourA += aSousB.devant + bSousA.derriere;
    pourB += aSousB.derriere + bSousA.devant;
  }
  return pourA > pourB ? 'a' : pourB > pourA ? 'b' : null;
}

/** Par zone, le rang le plus extérieur des éléments de `elements` qui la couvrent ; rend les meshes d'un rang donné
 *  que ne masque aucun élément de couche plus extérieure couvrant leur zone (`zoneDe`). */
export function sansLesZonesMasquees(elements: readonly { readonly rang: number; readonly couvre: readonly string[] }[], zoneDe: (m: Mesh) => string | undefined) {
  const couvrant = new Map<string, number>();
  for (const { rang, couvre } of elements) for (const z of couvre) couvrant.set(z, Math.max(couvrant.get(z) ?? RANG_DU_CORPS, rang));
  return <M extends Mesh>(meshes: readonly M[], rang: number): M[] => meshes.filter((m) => {
    const zone = zoneDe(m);
    return zone === undefined || (couvrant.get(zone) ?? RANG_DU_CORPS) <= rang;
  });
}

/** Les meshes skinnés d'un élément et le rang de sa couche dans `COUCHES`. */
export interface CoucheDElement {
  readonly rang: number;
  readonly meshes: readonly SkinnedMesh[];
  /** Vrai pour un accessoire : à couche égale, il se porte par-dessus un vêtement ou une armure. */
  readonly accessoire?: boolean;
}

/** Dit, pour deux éléments d'une tenue, si `e` couvre `f` : couche plus extérieure ; à couche égale, un accessoire
 *  couvre ce qui n'en est pas un ; sinon l'ordre mesuré au repos `neutre` (`ordreDesReleves`), chaque paire relevée une
 *  fois. */
export function ordreDesCouches<E extends CoucheDElement>(neutre: Pick<Pose, 'positions'>): (e: E, f: E) => boolean {
  const relever = releverDans(neutre);
  const votes = new Map<E, Map<E, boolean>>();
  return (e, f) => {
    if (e === f || f.rang > e.rang) return false;
    if (f.rang < e.rang) return true;
    if (Boolean(e.accessoire) !== Boolean(f.accessoire)) return Boolean(e.accessoire);
    const deE = votes.get(e) ?? new Map<E, boolean>();
    votes.set(e, deE);
    if (!deE.has(f)) deE.set(f, ordreDesReleves(f.meshes, e.meshes, relever) === 'b');
    return deE.get(f) as boolean;
  };
}

/** Les couches liées au repos : les liaisons du corps sous chaque élément, et de chaque élément sous ceux qui le
 *  couvrent ; les percements des mêmes paires. */
export interface CouchesAuRepos {
  readonly liaisons: readonly LiaisonDeCouches[];
  readonly percements: readonly PercementAuRepos[];
}

/** Les relevés de la pose `pose`, chacun fait une fois. */
function releverDans(pose: Pick<Pose, 'positions'>): (sujet: Mesh, couverture: SkinnedMesh) => ReleveSous {
  const releves = new Map<Mesh, Map<Mesh, ReleveSous>>();
  return (sujet, couverture) => {
    const parCouverture = releves.get(sujet) ?? new Map<Mesh, ReleveSous>();
    releves.set(sujet, parCouverture);
    const connu = parCouverture.get(couverture);
    if (connu) return connu;
    const releve = releverSous(sujet, couverture, pose);
    parCouverture.set(couverture, releve);
    return releve;
  };
}

/** Les couches de `corps` et `elements` liées dans la pose `repos` ; `couvre(e, f)` dit si l'élément `e` couvre `f`
 *  (`ordreDesCouches`). */
export function lierLesCouches<E extends CoucheDElement>(corps: readonly Mesh[], elements: readonly E[], repos: Pick<Pose, 'positions'>, couvre: (e: E, f: E) => boolean): CouchesAuRepos {
  const relever = releverDans(repos);
  const parPaire = elements.flatMap((e) => {
    const sujets = [...corps, ...elements.filter((f) => couvre(e, f)).flatMap((f) => f.meshes)];
    return e.meshes.flatMap((couverture) => sujets.map((sujet) => relever(sujet, couverture)));
  });
  return {
    liaisons: parPaire.flatMap((r) => r.liaison ?? []),
    percements: parPaire.flatMap((r) => r.percement ?? []),
  };
}

/** La traversée de chaque liaison dans l'échantillon `e` ; une liaison sans sommet au-delà de la tolérance n'y figure pas. */
export function mesurerTraversee(liaisons: readonly LiaisonDeCouches[], e: Echantillon): TraverseeDUnEchantillon[] {
  return liaisons.flatMap((liaison) => {
    const ps = positionsDe(e, liaison.sujet), pc = positionsDe(e, liaison.couverture);
    let sommets = 0, pire = 0;
    liaison.sommets.forEach((s, i) => {
      const [a, b, c] = [liaison.triangles[i * 3], liaison.triangles[i * 3 + 1], liaison.triangles[i * 3 + 2]];
      if (!poserTriangle(pc, a, b, c)) return;
      const [u, w, x] = [liaison.barycentres[i * 3], liaison.barycentres[i * 3 + 1], liaison.barycentres[i * 3 + 2]];
      projection.set(0, 0, 0).addScaledVector(forme.a, u).addScaledVector(forme.b, w).addScaledVector(forme.c, x);
      const ecart = projection.sub(v.set(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2])).dot(normale);
      if (ecart >= -ECART_DE_SUIVI_M) return;
      sommets++;
      pire = Math.min(pire, ecart);
    });
    return sommets ? [{ liaison, clip: e.clip, t: e.t, sommets, pire }] : [];
  });
}

/** Un écart par (sujet, couverture, clip), à l'instant de son écart signé le plus négatif. */
export function gardeTraversee(mesures: readonly TraverseeDUnEchantillon[], libelle: LibelleDeMesh): Ecart[] {
  const pires = new Map<string, TraverseeDUnEchantillon>();
  for (const m of mesures) {
    const k = `${libelle(m.liaison.sujet)}|${libelle(m.liaison.couverture)}|${m.clip}`;
    const avant = pires.get(k);
    if (!avant || m.pire < avant.pire) pires.set(k, m);
  }
  return [...pires.values()].map((m): Ecart => ({
    garde: GARDE, code: 'couche-traversee', mesh: libelle(m.liaison.couverture), clip: m.clip, t: m.t, valeur: m.pire, seuil: -ECART_DE_SUIVI_M,
    detail: `${m.sommets} sommet(s) de ${libelle(m.liaison.sujet)}, sur ${m.liaison.sommets.length} couverts, passent devant la couverture : écart signé le plus négatif, en m`,
  }));
}

/** Un écart par percement au repos neutre. */
export const gardePercementAuRepos = (percements: readonly PercementAuRepos[], libelle: LibelleDeMesh): Ecart[] => percements.map((p): Ecart => ({
  garde: GARDE, code: 'couche-percee-au-repos', mesh: libelle(p.couverture), valeur: p.pire, seuil: -ECART_DE_SUIVI_M,
  detail: `${p.sommets} sommet(s) de ${libelle(p.sujet)} devant la couverture au repos neutre : écart signé le plus négatif, en m`,
}));
