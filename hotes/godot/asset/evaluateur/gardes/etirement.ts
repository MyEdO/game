/**
 * GARDE DE L'ÉTIREMENT DES ARÊTES (#2972) : à chaque (clip, t), le rapport de la longueur déformée d'une arête à sa
 * longueur de repos (gabarit et silhouettes posés) reste dans [`ETIREMENT_MIN` ; `ETIREMENT_MAX`] ; les cinq pires arêtes
 * de chaque clip se rendent en mesure. Les bornes sont une évaluation d'ingénierie, posées au-delà du pire mesuré sur
 * la référence `UAL1_Standard.glb` (43 clips au pas de 1/12 s, 2026-10-24 : 3,51 et 0,014, plis des phalanges) : hors
 * d'elles, une arête suit un os qui n'est pas le sien.
 */
import type { Mesh } from 'three';
import type { Ecart } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';

export const ETIREMENT_MAX = 4;
export const ETIREMENT_MIN = 0.01;
export const PIRES_ARETES_PAR_CLIP = 5;

/** Une arête à un instant : ses deux sommets, le rapport déformé / repos. */
export interface RapportDArete {
  readonly mesh: string;
  readonly a: number;
  readonly b: number;
  readonly t: number;
  readonly rapport: number;
}

/** Ce qu'un échantillon donne de l'étirement : par mesh, ses arêtes hors bornes (nombre, pire rapport), et les pires arêtes. */
export interface MesureDEtirement {
  readonly clip: string;
  readonly t: number;
  readonly horsBornes: ReadonlyMap<string, { readonly nombre: number; readonly pire: number }>;
  readonly pires: readonly RapportDArete[];
}

/** Les arêtes uniques des triangles de `m`, à plat (a, b) avec a < b. */
export function aretesDe(m: Mesh): Uint32Array {
  const index = m.geometry.index;
  const total = index ? index.count : m.geometry.attributes.position.count;
  const sommet = (k: number) => (index ? index.getX(k) : k);
  const vues = new Set<number>();
  const aretes: number[] = [];
  const n = m.geometry.attributes.position.count;
  for (let t = 0; t + 2 < total; t += 3) {
    for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
      const [a, b] = [sommet(t + i), sommet(t + j)].sort((x, y) => x - y);
      const cle = a * n + b;
      if (a === b || vues.has(cle)) continue;
      vues.add(cle);
      aretes.push(a, b);
    }
  }
  return Uint32Array.from(aretes);
}

const longueur = (p: Float32Array, a: number, b: number): number => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);

/** La gravité d'un rapport : son écart logarithmique à 1. */
const gravite = (rapport: number): number => Math.abs(Math.log(rapport));

/** Les `n` pires de `liste` par gravité, une arête au plus une fois. */
function pires(liste: readonly RapportDArete[], n: number): RapportDArete[] {
  const vues = new Set<string>();
  return [...liste].sort((x, y) => gravite(y.rapport) - gravite(x.rapport)).filter((r) => {
    const cle = `${r.mesh}:${r.a}:${r.b}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  }).slice(0, n);
}

/** L'étirement de l'échantillon `e` contre la pose de repos `repos`, sur les arêtes `aretes` (par mesh). */
export function mesurerEtirement(aretes: ReadonlyMap<string, Uint32Array>, repos: Pose, e: Echantillon): MesureDEtirement {
  const horsBornes = new Map<string, { nombre: number; pire: number }>();
  let candidates: RapportDArete[] = [];
  for (const [mesh, liste] of aretes) {
    const p0 = repos.positions.get(mesh);
    const p = e.positions.get(mesh);
    if (!p0 || !p) continue;
    let hors = 0;
    let pire = 1;
    for (let k = 0; k < liste.length; k += 2) {
      const l0 = longueur(p0, liste[k], liste[k + 1]);
      if (l0 === 0) continue;
      const rapport = longueur(p, liste[k], liste[k + 1]) / l0;
      if (rapport > ETIREMENT_MAX || rapport < ETIREMENT_MIN) {
        hors++;
        if (gravite(rapport) > gravite(pire)) pire = rapport;
      }
      candidates.push({ mesh, a: liste[k], b: liste[k + 1], t: e.t, rapport });
      if (candidates.length > 4096) candidates = pires(candidates, PIRES_ARETES_PAR_CLIP);
    }
    if (hors) horsBornes.set(mesh, { nombre: hors, pire });
  }
  return { clip: e.clip, t: e.t, horsBornes, pires: pires(candidates, PIRES_ARETES_PAR_CLIP) };
}

/** Les cinq pires arêtes de chaque clip de `mesures`. */
export function piresAretes(mesures: readonly MesureDEtirement[]): Record<string, RapportDArete[]> {
  const parClip: Record<string, RapportDArete[]> = {};
  for (const m of mesures) parClip[m.clip] = pires([...(parClip[m.clip] ?? []), ...m.pires], PIRES_ARETES_PAR_CLIP);
  return parClip;
}

export function gardeEtirement(mesures: readonly MesureDEtirement[]): Ecart[] {
  const parMeshEtClip = new Map<string, { mesh: string; clip: string; instants: number; aretes: number; pire: number; t: number }>();
  for (const m of mesures) {
    for (const [mesh, { nombre, pire }] of m.horsBornes) {
      const cle = `${mesh}|${m.clip}`;
      const courant = parMeshEtClip.get(cle);
      if (!courant) parMeshEtClip.set(cle, { mesh, clip: m.clip, instants: 1, aretes: nombre, pire, t: m.t });
      else {
        courant.instants++;
        courant.aretes = Math.max(courant.aretes, nombre);
        if (gravite(pire) > gravite(courant.pire)) Object.assign(courant, { pire, t: m.t });
      }
    }
  }
  return [...parMeshEtClip.values()].map((s) => ({
    garde: 'etirement', code: s.pire > 1 ? 'arete-etiree' : 'arete-ecrasee', mesh: s.mesh, clip: s.clip, t: s.t, valeur: s.pire,
    seuil: s.pire > 1 ? ETIREMENT_MAX : ETIREMENT_MIN, detail: `jusqu’à ${s.aretes} arête(s) hors de [${ETIREMENT_MIN} ; ${ETIREMENT_MAX}], à ${s.instants} instant(s)`,
  }));
}
