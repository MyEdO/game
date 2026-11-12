/**
 * GARDE DU MEMBRE DANS UN VÊTEMENT (#3842) : en clip, le corps d'une zone Z1 (`extras.zone`) ne passe pas à travers un
 * mesh d'élément de zone Z2, Z2 ni Z1 ni voisine de Z1. Deux zones sont voisines si des meshes du corps de l'une et de
 * l'autre ont, au repos, deux sommets à moins de `TOLERANCE_JUMEAUX_POSITION_M`. Le côté d'un sommet est celui de son
 * triangle couvrant le plus proche (`visiterLaCouverture`, `pile.ts`) : derrière si son écart signé e dépasse
 * `ECART_DE_SUIVI_M`, devant s'il est sous −`ECART_DE_SUIVI_M`. À un échantillon, la zone passe à travers le mesh si
 * elle a des sommets de chaque côté. Les meshes masqués au montage n'y entrent pas (`sansLesZonesMasquees`).
 * `membre-dans-un-vetement` : un écart par (zone, mesh, clip), à son pire instant, de valeur le plus grand e derrière.
 */
import type { Mesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { TOLERANCE_JUMEAUX_POSITION_M } from './poids.ts';
import { indicesDe, normalesDe, positionsDe } from './traversee.ts';
import { couvertureDe, PORTEE_DE_COUVERTURE_M, visiterLaCouverture } from '../../pile.ts';

const GARDE = 'membreDansUnVetement';

/** Un mesh du corps et un mesh d'élément de zones ni égales ni voisines. */
export interface PaireHorsDeZone {
  readonly membre: Mesh;
  readonly zone: string;
  readonly vetement: Mesh;
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

/** Les paires de `membres` et de `vetements` de zones ni égales ni voisines (`voisines`) ; un mesh sans zone n'en est pas. */
export function pairesHorsDeZone(membres: readonly Mesh[], vetements: readonly Mesh[], zoneDe: (m: Mesh) => string | undefined, voisines: ReadonlySet<string>): PaireHorsDeZone[] {
  return membres.flatMap((membre) => {
    const zone = zoneDe(membre);
    if (zone === undefined) return [];
    return vetements.flatMap((vetement) => {
      const autre = zoneDe(vetement);
      return autre === undefined || autre === zone || voisines.has(`${zone}|${autre}`) ? [] : [{ membre, zone, vetement }];
    });
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

/** Chaque (zone, vêtement) des paires dont la zone passe à travers le vêtement dans l'échantillon `e`. */
export function mesurerMembresDansUnVetement(paires: readonly PaireHorsDeZone[], e: Echantillon): MembreDUnEchantillon[] {
  const boites = new Map<Mesh, number[]>();
  const boite = (m: Mesh): number[] => {
    const connue = boites.get(m);
    if (connue) return connue;
    const p = positionsDe(e, m), nouvelle = boiteDe(p, tousLesSommets(p));
    boites.set(m, nouvelle);
    return nouvelle;
  };
  const normales = new Map<Mesh, Float32Array>();
  const parZone = new Map<string, { zone: string; vetement: Mesh; derriere: number; devant: number; pire: number }>();
  for (const { membre, zone, vetement } of paires) {
    const bm = boite(membre), bv = boite(vetement);
    if (!croise(bm, bv, PORTEE_DE_COUVERTURE_M)) continue;
    const pv = positionsDe(e, vetement), pm = positionsDe(e, membre);
    const tous = indicesDe(vetement, pv.length / 3), proches: number[] = [];
    for (let t = 0; t + 2 < tous.length; t += 3) {
      const triangle = [tous[t], tous[t + 1], tous[t + 2]];
      if (croise(bm, boiteDe(pv, triangle), PORTEE_DE_COUVERTURE_M)) proches.push(...triangle);
    }
    if (!proches.length) continue;
    const surface = couvertureDe(pv, proches);
    const nm = normales.get(membre) ?? normalesDe(membre, pm);
    normales.set(membre, nm);
    const k = `${zone}\u0000${vetement.uuid}`;
    const cote = parZone.get(k) ?? { zone, vetement, derriere: 0, devant: 0, pire: 0 };
    parZone.set(k, cote);
    for (let s = 0; s < pm.length / 3; s++) {
      if (!dans(bv, pm[s * 3], pm[s * 3 + 1], pm[s * 3 + 2], PORTEE_DE_COUVERTURE_M)) continue;
      let proche = Infinity;
      visiterLaCouverture(pm[s * 3], pm[s * 3 + 1], pm[s * 3 + 2], nm[s * 3], nm[s * 3 + 1], nm[s * 3 + 2], surface, (ecart) => { if (Math.abs(ecart) < Math.abs(proche)) proche = ecart; });
      if (proche === Infinity) continue;
      if (proche > ECART_DE_SUIVI_M) { cote.derriere++; cote.pire = Math.max(cote.pire, proche); }
      if (proche < -ECART_DE_SUIVI_M) cote.devant++;
    }
  }
  return [...parZone.values()].flatMap(({ zone, vetement, derriere, devant, pire }) => (derriere && devant ? [{ zone, vetement, clip: e.clip, t: e.t, sommets: derriere, pire }] : []));
}

/** Un écart par (zone, vêtement, clip), à l'instant de son plus grand écart signé. */
export function gardeMembreDansUnVetement(mesures: readonly MembreDUnEchantillon[], libelle: LibelleDeMesh): Ecart[] {
  const pires = new Map<string, MembreDUnEchantillon>();
  for (const m of mesures) {
    const k = `${m.zone}|${libelle(m.vetement)}|${m.clip}`;
    const avant = pires.get(k);
    if (!avant || m.pire > avant.pire) pires.set(k, m);
  }
  return [...pires.values()].map((m): Ecart => ({
    garde: GARDE, code: 'membre-dans-un-vetement', mesh: libelle(m.vetement), clip: m.clip, t: m.t, valeur: m.pire, seuil: ECART_DE_SUIVI_M,
    detail: `${m.sommets} sommet(s) du corps de zone ${m.zone} derrière le vêtement qu'elle traverse : plus grand écart signé, en m`,
  }));
}
