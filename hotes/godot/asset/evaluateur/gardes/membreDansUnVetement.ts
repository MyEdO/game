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
}

export interface MembreDUnEchantillon {
  readonly zone: string;
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

/** La boîte englobante [min x, y, z, max x, y, z] des sommets `sommets` des positions `p`. */
function boiteDe(p: Float32Array, sommets: Iterable<number>): number[] {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const s of sommets) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], p[s * 3 + k]); b[3 + k] = Math.max(b[3 + k], p[s * 3 + k]); }
  return b;
}
const tousLesSommets = (p: Float32Array): Iterable<number> => Array.from({ length: p.length / 3 }, (_, s) => s);
const dans = (b: readonly number[], x: number, y: number, z: number, marge: number): boolean =>
  x >= b[0] - marge && y >= b[1] - marge && z >= b[2] - marge && x <= b[3] + marge && y <= b[4] + marge && z <= b[5] + marge;
const croise = (a: readonly number[], b: readonly number[], marge: number): boolean =>
  [0, 1, 2].every((k) => a[k] <= b[3 + k] + marge && b[k] <= a[3 + k] + marge);

/** Chaque (zone, vêtement) de `paires` dont la zone passe à travers le vêtement dans l'échantillon `e` ; `peaux` : les
 *  paires de chaque membre et des meshes du corps contre lesquels il pince le tissu. */
export function mesurerMembresDansUnVetement(paires: readonly PaireHorsDeZone[], peaux: readonly PaireHorsDeZone[], e: Echantillon): MembreDUnEchantillon[] {
  const boites = new Map<Mesh, number[]>();
  const boite = (m: Mesh): number[] => {
    const connue = boites.get(m);
    if (connue) return connue;
    const p = positionsDe(e, m), nouvelle = boiteDe(p, tousLesSommets(p));
    boites.set(m, nouvelle);
    return nouvelle;
  };
  /** La couverture des triangles `tous` de `surface` à portée du membre de boîte `bm`, `null` sans eux. */
  const couvertureProche = (bm: readonly number[], surface: Mesh, tous: ArrayLike<number>): Couverture | null => {
    if (!croise(bm, boite(surface), PORTEE_DE_COUVERTURE_M)) return null;
    const ps = positionsDe(e, surface), proches: number[] = [];
    for (let t = 0; t + 2 < tous.length; t += 3) {
      const triangle = [tous[t], tous[t + 1], tous[t + 2]];
      if (croise(bm, boiteDe(ps, triangle), PORTEE_DE_COUVERTURE_M)) proches.push(...triangle);
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
  const parZone = new Map<string, { zone: string; vetement: Mesh; derriere: number; devant: number; pire: number }>();
  for (const { membre, zone, vetement, triangles } of paires) {
    const bm = boite(membre);
    const surface = couvertureProche(bm, vetement, triangles);
    if (!surface) continue;
    const pm = positionsDe(e, membre);
    const nm = normales.get(membre) ?? normalesDe(membre, pm);
    normales.set(membre, nm);
    const k = `${zone}\u0000${vetement.uuid}`;
    const cote = parZone.get(k) ?? { zone, vetement, derriere: 0, devant: 0, pire: 0 };
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
  return [...parZone.values()].flatMap(({ zone, vetement, derriere, devant, pire }) => (derriere && devant ? [{ zone, vetement, clip: e.clip, t: e.t, sommets: derriere, pire }] : []));
}

/** Un écart par (zone, vêtement, clip), à l'instant de son plus grand écart signé. `plafonds` : par clip échantillonné,
 *  le nombre de ces écarts que la tenue admet, 0 sans entrée. */
export function gardeMembreDansUnVetement(mesures: readonly MembreDUnEchantillon[], libelle: LibelleDeMesh, plafonds: Readonly<Record<string, number>> = {}): Ecart[] {
  const pires = new Map<string, MembreDUnEchantillon>();
  for (const m of mesures) {
    const k = `${m.zone}|${libelle(m.vetement)}|${m.clip}`;
    const avant = pires.get(k);
    if (!avant || m.pire > avant.pire) pires.set(k, m);
  }
  const parClip = new Map<string, MembreDUnEchantillon[]>();
  for (const m of pires.values()) parClip.set(m.clip, [...(parClip.get(m.clip) ?? []), m]);
  return [...new Set([...parClip.keys(), ...Object.keys(plafonds)])].flatMap((clip): Ecart[] => {
    const [traverses, plafond] = [parClip.get(clip) ?? [], plafonds[clip] ?? 0];
    if (traverses.length === plafond) return [];
    if (traverses.length < plafond) return [{ garde: GARDE, code: 'plafond-a-baisser', clip, valeur: traverses.length, seuil: plafond, detail: 'vêtement(s) traversé(s) par une zone du corps, sous le plafond admis du clip : le baisser à cette mesure' }];
    return traverses.map((m) => ({
      garde: GARDE, code: 'membre-dans-un-vetement', mesh: libelle(m.vetement), clip: m.clip, t: m.t, valeur: m.pire, seuil: ECART_DE_SUIVI_M,
      detail: `${m.sommets} sommet(s) du corps de zone ${m.zone} derrière le vêtement qu'elle traverse : plus grand écart signé, en m`,
    }));
  });
}
