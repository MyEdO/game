/**
 * GARDE DE LA TRAVERSÉE DES COUCHES (#2972, #3319, #3842) : une couche ne passe pas devant celle qui la couvre. Le
 * corps est sous toute couche ; un mesh skinné d'élément est sous ceux des éléments qui couvrent le sien
 * (`ordreDesCouches`, `pile.ts`). Les meshes masqués au montage (`sansLesZonesMasquees`) ne sont ni sujets ni
 * couvertures.
 *
 * Un triangle de l'endroit de la couverture (`endroitDe`, `pile.ts`) couvre un sommet d'un sujet selon
 * `visiterLaCouverture`, qui donne son écart signé e, positif derrière : la doublure d'une double nappe ne couvre rien,
 * et un sommet de doublure se lit de son dehors (`dehorsDesSommets`).
 *
 * Au repos, chaque sommet se lie au triangle couvrant le plus proche dont il est derrière : le point lié p, aux
 * coordonnées barycentriques de la projection, suit la couverture. À chaque échantillon, l'écart signé e(v) = (p − v)·n,
 * n la normale de la couverture posée au point lié : `couche-traversee` si un sommet a e(v) < −`ECART_DE_SUIVI_M`, un
 * écart par (sujet, couverture, clip), à son pire instant. Cette normale est celle de la surface, les normales de
 * sommet de l'endroit fondues aux barycentres (`normaleFondue`), là où au repos elle regarde du côté du triangle lié
 * (`SURFACE_LISSE`) : un triangle qui se couche ou se retourne seul en pose ne fait passer devant lui rien de ce qu'il
 * couvre. Sur une arête vive, c'est la normale du triangle.
 *
 * Au repos neutre, une arête du sujet qui traverse l'endroit de sa couverture un nombre impair de fois en sort par un
 * bout (`croiserLaCouverture`). Ce bout est percé s'il est à plus de `ECART_DE_SUIVI_M` devant son triangle couvrant
 * le plus proche : `couche-percee-au-repos`, un écart par (sujet, couverture), avec le compte et le pire écart. Une
 * couche qui longe sa couverture sans la traverser, comme un col sous une écharpe, ne la perce pas.
 */
import { Triangle, Vector3, type Mesh, type SkinnedMesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { RANG_DU_CORPS } from '../../element.ts';
import { couvertureDe, croiserLaCouverture, dehorsDesSommets, normalesDesSommets, visiterLaCouverture, type Couverture } from '../../pile.ts';

const GARDE = 'traversee';
/** L'écart, en part d'une arête, sous lequel deux triangles voisins de la couverture sont traversés au même point. */
const MEME_TRAVERSEE = 1e-6;

/** Les sommets d'un sujet liés sous une couverture : pour chaque sommet lié, son indice, les trois sommets du triangle
 *  de la couverture et les coordonnées barycentriques du point lié. */
export interface LiaisonDeCouches {
  readonly sujet: Mesh;
  readonly couverture: SkinnedMesh;
  readonly sommets: Uint32Array;
  readonly triangles: Uint32Array;
  readonly barycentres: Float32Array;
  /** Par sommet lié, 1 si la couverture est lisse à son point lié (`SURFACE_LISSE`), 0 sinon. */
  readonly lisses: Uint8Array;
  /** Les triangles de l'endroit de la couverture, par trois indices. */
  readonly endroit: ArrayLike<number>;
}

/** Les sommets d'un sujet percés au repos par sa couverture : leur nombre et l'écart signé le plus négatif. */
export interface PercementAuRepos {
  readonly sujet: Mesh;
  readonly couverture: SkinnedMesh;
  readonly sommets: number;
  readonly pire: number;
}

/** Ce que la couverture fait des sommets d'un sujet au repos : la liaison et le percement. */
interface ReleveSous {
  readonly liaison: LiaisonDeCouches | null;
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

const forme = new Triangle(), normale = new Vector3(), v = new Vector3(), projection = new Vector3(), fondue = new Vector3(), sommet = new Vector3();

function poserTriangle(p: Float32Array, a: number, b: number, c: number): boolean {
  forme.a.set(p[a * 3], p[a * 3 + 1], p[a * 3 + 2]);
  forme.b.set(p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
  forme.c.set(p[c * 3], p[c * 3 + 1], p[c * 3 + 2]);
  if (forme.getArea() <= 0) return false;
  forme.getNormal(normale);
  return true;
}

/** Les normales de sommet de `m` aux positions `p` (`normalesDesSommets`). */
export const normalesDe = (m: Mesh, p: Float32Array): Float32Array => normalesDesSommets({ positions: p, indices: indicesDe(m, p.length / 3) });

/** La normale de la surface au point de barycentres (u, w, x) du triangle (a, b, c) : ses normales de sommet `ns`
 *  (`normalesDesSommets` de son endroit), unitaires et fondues. */
function normaleFondue(ns: Float32Array, a: number, b: number, c: number, u: number, w: number, x: number): Vector3 {
  fondue.set(0, 0, 0);
  for (const [s, part] of [[a, u], [b, w], [c, x]] as const) fondue.addScaledVector(sommet.set(ns[s * 3], ns[s * 3 + 1], ns[s * 3 + 2]).normalize(), part);
  return fondue.normalize();
}

/** Le cosinus, entre la normale d'un triangle au repos et celle de sa surface (`normaleFondue`), à partir duquel la
 *  surface est lisse à cet endroit. */
export const SURFACE_LISSE = 0.5;

/** Ce que `couverture`, d'endroit `surface`, fait des sommets de `sujet`, de dehors `ns`, dans la pose `repos`. */
function releverSous(sujet: Mesh, ns: Float32Array, couverture: SkinnedMesh, surface: Couverture, repos: Pick<Pose, 'positions'>): ReleveSous {
  const ps = positionsDe(repos, sujet), n = ps.length / 3;
  const pc = surface.positions, nc = normalesDesSommets(surface);
  const sommets: number[] = [], triangles: number[] = [], barycentres: number[] = [], lisses: number[] = [];
  const devant = new Float32Array(n).fill(-Infinity);
  for (let s = 0; s < n; s++) {
    let retenu = -1, auPlusPresDerriere = Infinity, bx = 0, by = 0, bz = 0;
    visiterLaCouverture(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2], ns[s * 3], ns[s * 3 + 1], ns[s * 3 + 2], surface, (e, t, a, b, c) => {
      if (e > 0 && e < auPlusPresDerriere) { retenu = t; auPlusPresDerriere = e; bx = a; by = b; bz = c; }
      if (e < 0 && e > devant[s]) devant[s] = e;
    });
    if (retenu < 0) continue;
    const [a, b, c] = [surface.indices[retenu], surface.indices[retenu + 1], surface.indices[retenu + 2]];
    sommets.push(s);
    triangles.push(a, b, c);
    barycentres.push(bx, by, bz);
    lisses.push(poserTriangle(pc, a, b, c) && normaleFondue(nc, a, b, c, bx, by, bz).dot(normale) >= SURFACE_LISSE ? 1 : 0);
  }
  const sortis = new Set<number>(), vues = new Set<number>();
  const ind = indicesDe(sujet, n);
  for (let t = 0; t + 2 < ind.length; t += 3) for (const [a, b] of [[ind[t], ind[t + 1]], [ind[t + 1], ind[t + 2]], [ind[t + 2], ind[t]]]) {
    const arete = Math.min(a, b) * n + Math.max(a, b);
    if (vues.has(arete)) continue;
    vues.add(arete);
    const traversees: number[] = [];
    let aSorti = false;
    croiserLaCouverture(ps[a * 3], ps[a * 3 + 1], ps[a * 3 + 2], ps[b * 3], ps[b * 3 + 1], ps[b * 3 + 2], surface, (part, ea) => {
      if (traversees.some((autre) => Math.abs(autre - part) < MEME_TRAVERSEE)) return;
      if (traversees.every((autre) => part < autre)) aSorti = ea < 0;
      traversees.push(part);
    });
    if (traversees.length % 2) sortis.add(aSorti ? a : b);
  }
  let perces = 0, pire = 0;
  for (const s of sortis) if (devant[s] < -ECART_DE_SUIVI_M && devant[s] > -Infinity) { perces++; pire = Math.min(pire, devant[s]); }
  return {
    liaison: sommets.length ? { sujet, couverture, sommets: Uint32Array.from(sommets), triangles: Uint32Array.from(triangles), barycentres: Float32Array.from(barycentres), lisses: Uint8Array.from(lisses), endroit: surface.indices } : null,
    percement: perces ? { sujet, couverture, sommets: perces, pire } : null,
  };
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

/** Les couches liées au repos : les liaisons du corps sous chaque élément, et de chaque élément sous ceux qui le
 *  couvrent ; les percements des mêmes paires. */
export interface CouchesAuRepos {
  readonly liaisons: readonly LiaisonDeCouches[];
  readonly percements: readonly PercementAuRepos[];
}

/** Les relevés de la pose `pose`, chacun fait une fois ; `endroit` : celui d'un mesh d'élément (`endroitDe`), le corps
 *  `corps` étant tout entier à l'endroit. */
function releverDans(pose: Pick<Pose, 'positions'>, corps: ReadonlySet<Mesh>, endroit: (m: Mesh) => ArrayLike<number>): (sujet: Mesh, couverture: SkinnedMesh) => ReleveSous {
  const releves = new Map<Mesh, Map<Mesh, ReleveSous>>(), dehors = new Map<Mesh, Float32Array>(), surfaces = new Map<Mesh, Couverture>();
  const dehorsDe = (m: Mesh): Float32Array => {
    const p = positionsDe(pose, m);
    const connu = dehors.get(m) ?? (corps.has(m) ? normalesDe(m, p) : dehorsDesSommets({ positions: p, indices: indicesDe(m, p.length / 3) }, endroit(m)));
    dehors.set(m, connu);
    return connu;
  };
  const surfaceDe = (m: Mesh): Couverture => {
    const connue = surfaces.get(m) ?? couvertureDe(positionsDe(pose, m), endroit(m));
    surfaces.set(m, connue);
    return connue;
  };
  return (sujet, couverture) => {
    const parCouverture = releves.get(sujet) ?? new Map<Mesh, ReleveSous>();
    releves.set(sujet, parCouverture);
    const connu = parCouverture.get(couverture);
    if (connu) return connu;
    const releve = releverSous(sujet, dehorsDe(sujet), couverture, surfaceDe(couverture), pose);
    parCouverture.set(couverture, releve);
    return releve;
  };
}

/** Les couches de `corps` et des meshes skinnés de chacun des `elements` liées dans la pose `repos` ; `couvre(e, f)` dit
 *  si l'élément `e` couvre `f` (`ordreDesCouches`, `pile.ts`), `endroit` rend celui d'un mesh d'élément (`endroitDe`). */
export function lierLesCouches<E extends { readonly meshes: readonly SkinnedMesh[] }>(
  corps: readonly Mesh[], elements: readonly E[], repos: Pick<Pose, 'positions'>, couvre: (e: E, f: E) => boolean, endroit: (m: Mesh) => ArrayLike<number>,
): CouchesAuRepos {
  const relever = releverDans(repos, new Set(corps), endroit);
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
  const normales = new Map<Mesh, Float32Array>();
  return liaisons.flatMap((liaison) => {
    const ps = positionsDe(e, liaison.sujet), pc = positionsDe(e, liaison.couverture);
    const nc = normales.get(liaison.couverture) ?? normalesDesSommets({ positions: pc, indices: liaison.endroit });
    normales.set(liaison.couverture, nc);
    let sommets = 0, pire = 0;
    liaison.sommets.forEach((s, i) => {
      const [a, b, c] = [liaison.triangles[i * 3], liaison.triangles[i * 3 + 1], liaison.triangles[i * 3 + 2]];
      if (!poserTriangle(pc, a, b, c)) return;
      const [u, w, x] = [liaison.barycentres[i * 3], liaison.barycentres[i * 3 + 1], liaison.barycentres[i * 3 + 2]];
      projection.set(0, 0, 0).addScaledVector(forme.a, u).addScaledVector(forme.b, w).addScaledVector(forme.c, x);
      if (liaison.lisses[i]) normale.copy(normaleFondue(nc, a, b, c, u, w, x));
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
