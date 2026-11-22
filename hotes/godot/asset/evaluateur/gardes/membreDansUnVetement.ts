/**
 * GARDE DU MEMBRE DANS UN VÊTEMENT (#3842) : en clip, le corps d'une zone Z1 (`extras.zone`) ne passe pas à travers un
 * mesh d'élément de zone Z2, Z2 ni Z1 ni voisine de Z1. Deux zones sont voisines si des meshes du corps de l'une et de
 * l'autre ont, au repos, deux sommets à moins de `TOLERANCE_JUMEAUX_POSITION_M`. Le côté d'un sommet est celui de son
 * triangle couvrant le plus proche (`visiterLaCouverture`, `pile.ts`) : derrière si son écart signé e dépasse
 * `ECART_DE_SUIVI_M`, devant s'il est sous −`ECART_DE_SUIVI_M`. À un échantillon, la zone passe à travers le mesh si
 * elle a des sommets de chaque côté. Les meshes masqués au montage n'y entrent pas (`sansLesZonesMasquees`).
 * Tissu pincé : un sommet derrière le mesh n'est d'aucun côté si la peau d'une zone ni la sienne ni voisine le couvre
 * aussi, à `PORTEE_DE_COUVERTURE_M` au plus du mesh : le vêtement y repose sur le corps, le membre l'y presse.
 * Endroit : d'un vêtement, seuls comptent les triangles de son endroit (`endroitDe`, `pile.ts`).
 * `membre-dans-un-vetement` : un écart par (zone, mesh, clip), à son pire instant, de valeur le plus grand e derrière.
 * Plafond : une tenue admet par clip un nombre mesuré de ces écarts ; à ce compte le clip n'en rend aucun, au-delà il
 * les rend tous, en deçà il rend `plafond-a-baisser`.
 * Objet rangé (#4351) : un rigide que le jeu range (`../rangement.ts`) se mesure comme un membre de la zone de l'os de
 * son emplacement (`zoneDeLOs`, `../corps.ts`), aux mêmes voisines, au même tissu pincé et au même plafond du clip ; ses
 * paires portent son libellé (`objet`), et son écart est `objet-dans-un-vetement`.
 */
import type { Mesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { TOLERANCE_JUMEAUX_POSITION_M } from './poids.ts';
import { normalesDe, positionsDe } from './traversee.ts';
import { couvertureDe, PORTEE_DE_COUVERTURE_M, visiterLaCouverture, type Couverture } from '../../pile.ts';

const GARDE = 'membreDansUnVetement';

/** Un mesh du corps et un mesh, d'élément ou du corps, de zones ni égales ni voisines ; `triangles` : les indices des
 *  triangles du second contre lesquels le premier se mesure. */
export interface PaireHorsDeZone {
  readonly membre: Mesh;
  readonly zone: string;
  readonly vetement: Mesh;
  readonly triangles: ArrayLike<number>;
  /** Le libellé du rigide rangé qui tient lieu de membre ; absent pour un mesh du corps. */
  readonly objet?: string;
}

export interface MembreDUnEchantillon {
  readonly zone: string;
  /** Le libellé du rigide rangé mesuré (`PaireHorsDeZone.objet`) ; absent pour une zone du corps. */
  readonly objet?: string;
  readonly vetement: Mesh;
  readonly clip: string;
  readonly t: number;
  /** Le nombre de sommets de la zone derrière le mesh au-delà de la tolérance, et leur plus grand écart signé. */
  readonly sommets: number;
  readonly pire: number;
}

/** Les paires de zones voisines de `corps` dans la pose `repos`, chacune sous `z1|z2` et `z2|z1`. */
export function zonesVoisines(corps: readonly Mesh[], zoneDe: (m: Mesh) => string | undefined, repos: Pick<Pose, 'positions'>): ReadonlySet<string> {
  const cellule = (x: number) => Math.floor(x / TOLERANCE_JUMEAUX_POSITION_M);
  const grille = new Map<string, { zone: string; p: Float32Array; s: number }[]>();
  const voisines = new Set<string>();
  for (const m of corps) {
    const zone = zoneDe(m);
    if (zone === undefined) continue;
    const p = positionsDe(repos, m);
    for (let s = 0; s < p.length / 3; s++) {
      const [ci, cj, ck] = [cellule(p[s * 3]), cellule(p[s * 3 + 1]), cellule(p[s * 3 + 2])];
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
        for (const autre of grille.get(`${i},${j},${k}`) ?? []) {
          if (autre.zone === zone) continue;
          const d = Math.hypot(p[s * 3] - autre.p[autre.s * 3], p[s * 3 + 1] - autre.p[autre.s * 3 + 1], p[s * 3 + 2] - autre.p[autre.s * 3 + 2]);
          if (d <= TOLERANCE_JUMEAUX_POSITION_M) voisines.add(`${zone}|${autre.zone}`).add(`${autre.zone}|${zone}`);
        }
      }
      const k = `${ci},${cj},${ck}`;
      const liste = grille.get(k);
      if (liste) liste.push({ zone, p, s });
      else grille.set(k, [{ zone, p, s }]);
    }
  }
  return voisines;
}

/** Les paires de `membres` et de `vetements` (des meshes d'élément, ou du corps pour ses peaux) de zones ni égales ni
 *  voisines (`voisines`) ; un mesh sans zone n'en est pas. `triangles` : par vêtement, ceux d'une paire. */
export function pairesHorsDeZone(
  membres: readonly Mesh[], vetements: readonly Mesh[], zoneDe: (m: Mesh) => string | undefined, voisines: ReadonlySet<string>,
  triangles: (vetement: Mesh) => ArrayLike<number>,
): PaireHorsDeZone[] {
  const zones = vetements.flatMap((vetement) => {
    const autre = zoneDe(vetement);
    return autre === undefined ? [] : [{ vetement, autre, triangles: triangles(vetement) }];
  });
  return membres.flatMap((membre) => {
    const zone = zoneDe(membre);
    if (zone === undefined) return [];
    return zones.flatMap(({ vetement, autre, triangles: t }) => (autre === zone || voisines.has(`${zone}|${autre}`) ? [] : [{ membre, zone, vetement, triangles: t }]));
  });
}

/** La boîte englobante [min x, y, z, max x, y, z] des sommets des positions `p`. */
function boiteDe(p: Float32Array): number[] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let s = 0; s < p.length / 3; s++) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p[s * 3 + k]); b[3 + k] = Math.max(b[3 + k], p[s * 3 + k]); }
  return b;
}
/** Les boîtes englobantes des triangles `triangles` (indices par trois) des positions `p`, six nombres chacune, à plat. */
function boitesDesTriangles(p: Float32Array, triangles: ArrayLike<number>): Float64Array {
  const b = new Float64Array(Math.floor(triangles.length / 3) * 6);
  for (let t = 0, o = 0; t + 2 < triangles.length; t += 3, o += 6) {
    for (let k = 0; k < 3; k++) {
      const [u, v, w] = [p[triangles[t] * 3 + k], p[triangles[t + 1] * 3 + k], p[triangles[t + 2] * 3 + k]];
      b[o + k] = Math.min(u, v, w);
      b[o + 3 + k] = Math.max(u, v, w);
    }
  }
  return b;
}
const dans = (b: readonly number[], x: number, y: number, z: number, marge: number): boolean =>
  x >= b[0] - marge && y >= b[1] - marge && z >= b[2] - marge && x <= b[3] + marge && y <= b[4] + marge && z <= b[5] + marge;
/** Vrai si la boîte `a` croise, à `marge` près, la boîte de `b` qui commence à `o`. */
const croise = (a: ArrayLike<number>, b: ArrayLike<number>, marge: number, o = 0): boolean =>
  a[0] <= b[o + 3] + marge && b[o] <= a[3] + marge && a[1] <= b[o + 4] + marge && b[o + 1] <= a[4] + marge && a[2] <= b[o + 5] + marge && b[o + 2] <= a[5] + marge;

/** Chaque (zone, vêtement) de `paires` dont la zone passe à travers le vêtement dans l'échantillon `e` ; `peaux` : les
 *  paires de chaque membre et des meshes du corps contre lesquels il pince le tissu. */
export function mesurerMembresDansUnVetement(paires: readonly PaireHorsDeZone[], peaux: readonly PaireHorsDeZone[], e: Echantillon): MembreDUnEchantillon[] {
  const boites = new Map<Mesh, number[]>();
  const boite = (m: Mesh): number[] => {
    const connue = boites.get(m);
    if (connue) return connue;
    const nouvelle = boiteDe(positionsDe(e, m));
    boites.set(m, nouvelle);
    return nouvelle;
  };
  const boitesDe = new Map<Mesh, Map<ArrayLike<number>, Float64Array>>();
  /** La couverture des triangles `tous` de `surface` à portée du membre de boîte `bm`, `null` sans eux. */
  const couvertureProche = (bm: readonly number[], surface: Mesh, tous: ArrayLike<number>): Couverture | null => {
    if (!croise(bm, boite(surface), PORTEE_DE_COUVERTURE_M)) return null;
    const ps = positionsDe(e, surface), proches: number[] = [];
    const parTriangles = boitesDe.get(surface) ?? new Map<ArrayLike<number>, Float64Array>();
    boitesDe.set(surface, parTriangles);
    const bt = parTriangles.get(tous) ?? boitesDesTriangles(ps, tous);
    parTriangles.set(tous, bt);
    for (let t = 0, o = 0; t + 2 < tous.length; t += 3, o += 6) {
      if (croise(bm, bt, PORTEE_DE_COUVERTURE_M, o)) proches.push(tous[t], tous[t + 1], tous[t + 2]);
    }
    return proches.length ? couvertureDe(ps, proches) : null;
  };
  /** L'écart signé du point à son triangle couvrant le plus proche de `couverture`, `Infinity` sans lui. */
  const ecartA = (couverture: Couverture, pm: Float32Array, nm: Float32Array, s: number): number => {
    let proche = Infinity;
    visiterLaCouverture(pm[s * 3], pm[s * 3 + 1], pm[s * 3 + 2], nm[s * 3], nm[s * 3 + 1], nm[s * 3 + 2], couverture, (ecart) => { if (Math.abs(ecart) < Math.abs(proche)) proche = ecart; });
    return proche;
  };
  const normales = new Map<Mesh, Float32Array>();
  const peauxDe = new Map<Mesh, Couverture[]>();
  const parZone = new Map<string, { zone: string; objet?: string; vetement: Mesh; derriere: number; devant: number; pire: number }>();
  for (const { membre, zone, vetement, triangles, objet } of paires) {
    const bm = boite(membre);
    const surface = couvertureProche(bm, vetement, triangles);
    if (!surface) continue;
    const pm = positionsDe(e, membre);
    const nm = normales.get(membre) ?? normalesDe(membre, pm);
    normales.set(membre, nm);
    const k = `${zone}\u0000${objet ?? ''}\u0000${vetement.uuid}`;
    const cote = parZone.get(k) ?? { zone, ...(objet === undefined ? {} : { objet }), vetement, derriere: 0, devant: 0, pire: 0 };
    parZone.set(k, cote);
    const bv = boite(vetement);
    for (let s = 0; s < pm.length / 3; s++) {
      if (!dans(bv, pm[s * 3], pm[s * 3 + 1], pm[s * 3 + 2], PORTEE_DE_COUVERTURE_M)) continue;
      const proche = ecartA(surface, pm, nm, s);
      if (proche === Infinity) continue;
      if (proche < -ECART_DE_SUIVI_M) cote.devant++;
      if (proche <= ECART_DE_SUIVI_M) continue;
      let sousLui = peauxDe.get(membre);
      if (!sousLui) {
        sousLui = peaux.flatMap((p) => (p.membre === membre ? [couvertureProche(bm, p.vetement, p.triangles)] : [])).filter((c) => c !== null);
        peauxDe.set(membre, sousLui);
      }
      if (sousLui.some((peau) => { const aLaPeau = ecartA(peau, pm, nm, s); return aLaPeau !== Infinity && proche - aLaPeau <= PORTEE_DE_COUVERTURE_M; })) continue;
      cote.derriere++;
      cote.pire = Math.max(cote.pire, proche);
    }
  }
  return [...parZone.values()].flatMap(({ derriere, devant, pire, ...cote }) => (derriere && devant ? [{ ...cote, clip: e.clip, t: e.t, sommets: derriere, pire }] : []));
}

/** Par (zone, objet, vêtement, clip) de `mesures`, celle de son plus grand écart signé. */
function piresTraversees(mesures: readonly MembreDUnEchantillon[], libelle: LibelleDeMesh): MembreDUnEchantillon[] {
  const pires = new Map<string, MembreDUnEchantillon>();
  for (const m of mesures) {
    const k = `${m.zone}|${m.objet ?? ''}|${libelle(m.vetement)}|${m.clip}`;
    const avant = pires.get(k);
    if (!avant || m.pire > avant.pire) pires.set(k, m);
  }
  return [...pires.values()];
}

/** Un écart par (zone, objet, vêtement, clip), à l'instant de son plus grand écart signé (`piresTraversees`). `plafonds` : par clip échantillonné,
 *  le nombre de ces écarts que la tenue admet, 0 sans entrée. */
export function gardeMembreDansUnVetement(mesures: readonly MembreDUnEchantillon[], libelle: LibelleDeMesh, plafonds: Readonly<Record<string, number>> = {}): Ecart[] {
  const parClip = new Map<string, MembreDUnEchantillon[]>();
  for (const m of piresTraversees(mesures, libelle)) parClip.set(m.clip, [...(parClip.get(m.clip) ?? []), m]);
  return [...new Set([...parClip.keys(), ...Object.keys(plafonds)])].flatMap((clip): Ecart[] => {
    const [traverses, plafond] = [parClip.get(clip) ?? [], plafonds[clip] ?? 0];
    if (traverses.length === plafond) return [];
    if (traverses.length < plafond) return [{ garde: GARDE, code: 'plafond-a-baisser', clip, valeur: traverses.length, seuil: plafond, detail: 'vêtement(s) traversé(s) par une zone du corps, sous le plafond admis du clip : le baisser à cette mesure' }];
    return traverses.map((m) => (m.objet === undefined ? {
      garde: GARDE, code: 'membre-dans-un-vetement', mesh: libelle(m.vetement), clip: m.clip, t: m.t, valeur: m.pire, seuil: ECART_DE_SUIVI_M,
      detail: `${m.sommets} sommet(s) du corps de zone ${m.zone} derrière le vêtement qu'elle traverse : plus grand écart signé, en m`,
    } : {
      garde: GARDE, code: 'objet-dans-un-vetement', mesh: m.objet, clip: m.clip, t: m.t, valeur: m.pire, seuil: ECART_DE_SUIVI_M,
      detail: `${m.sommets} sommet(s) de l'objet rangé, de zone ${m.zone}, derrière ${libelle(m.vetement)} qu'il traverse : plus grand écart signé, en m`,
    }));
  });
}
