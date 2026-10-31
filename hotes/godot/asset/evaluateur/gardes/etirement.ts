/**
 * GARDE DE L'ÉTIREMENT DES ARÊTES (#2972, #3101) : la longueur d'une arête se rapporte à l_b, sa longueur de repos sous
 * le gabarit complet (os, binds compensés et clés propres), silhouettes et clés croisées à 0, formes indépendantes à leur influence d'entrée. Au repos posé (gabarit et silhouettes), l_k/l_b reste dans
 * `ETIREMENT_AU_REPOS`, une fois par mesh ; à chaque (clip, t), l_c/l_b, longueur à l'échantillon, reste dans
 * `ETIREMENT_EN_CLIP`. Les cinq pires arêtes de chaque clip, en l_c/l_b, se rendent en mesure. Hors de
 * `ETIREMENT_AU_REPOS`, une shape key effondre ou enfle le repos ; hors de `ETIREMENT_EN_CLIP`, une arête suit un os qui
 * n'est pas le sien. Seuils partagés avec la construction (`scripts/personnage-3d/seuils.py`) :
 * `seuils.json`.
 */
import type { Mesh } from 'three';
import type { Ecart } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';
import seuils from './seuils.json';

/** Un intervalle de rapports de longueurs, [bas ; haut]. */
export type Intervalle = readonly [number, number];

const intervalle = (nom: string, v: readonly number[]): Intervalle => {
  if (v.length !== 2 || !(v[0] > 0 && v[0] < v[1])) throw new Error(`seuils.json : ${nom} n’est pas un intervalle [bas ; haut] de rapports positifs`);
  return [v[0], v[1]];
};

/** Les rapports l_c/l_b admis à un échantillon. Borne haute : le pire mesuré sur la référence `UAL1_Standard.glb`, 43
 *  clips au pas de 1/12 s, 2026-10-24, aux plis des phalanges ; borne basse : évaluation d'ingénierie (#3101). */
export const ETIREMENT_EN_CLIP = intervalle('ETIREMENT_EN_CLIP', seuils.ETIREMENT_EN_CLIP);
/** Les rapports l_k/l_b admis au repos posé : évaluation d'ingénierie (#3101). */
export const ETIREMENT_AU_REPOS = intervalle('ETIREMENT_AU_REPOS', seuils.ETIREMENT_AU_REPOS);
export const PIRES_ARETES_PAR_CLIP = 5;

/** Les codes d'écart d'un intervalle, sous sa borne basse et au-dessus de sa borne haute. */
interface Codes {
  readonly bas: string;
  readonly haut: string;
}

const CODES_EN_CLIP: Codes = { bas: 'arete-ecrasee', haut: 'arete-etiree' };
const CODES_AU_REPOS: Codes = { bas: 'arete-repos-effondree', haut: 'arete-repos-enflee' };

/** Une arête à un instant : ses deux sommets, le rapport l_c/l_b. */
export interface RapportDArete {
  readonly mesh: string;
  readonly a: number;
  readonly b: number;
  readonly t: number;
  readonly rapport: number;
}

/** Les arêtes d'un mesh hors d'une borne : le code et le seuil de la borne, leur nombre, le pire rapport. */
export interface HorsBornes {
  readonly mesh: string;
  readonly code: string;
  readonly seuil: number;
  readonly nombre: number;
  readonly pire: number;
}

/** Ce qu'un échantillon donne de l'étirement : ses arêtes hors de `ETIREMENT_EN_CLIP`, et les pires arêtes. */
export interface MesureDEtirement {
  readonly clip: string;
  readonly t: number;
  readonly horsBornes: readonly HorsBornes[];
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

/** Pour chaque arête de `aretes` (par mesh) de longueur non nulle dans `base`, son rapport de longueur `pose` / `base`. */
function parcourir(aretes: ReadonlyMap<string, Uint32Array>, base: Pose, pose: Pose, visiter: (mesh: string, a: number, b: number, rapport: number) => void): void {
  for (const [mesh, liste] of aretes) {
    const p0 = base.positions.get(mesh);
    const p = pose.positions.get(mesh);
    if (!p0 || !p) continue;
    for (let k = 0; k < liste.length; k += 2) {
      const l0 = longueur(p0, liste[k], liste[k + 1]);
      if (l0 > 0) visiter(mesh, liste[k], liste[k + 1], longueur(p, liste[k], liste[k + 1]) / l0);
    }
  }
}

/** Le décompte, par mesh et par borne franchie de `bornes`, des rapports hors de `bornes`. */
function decompte(bornes: Intervalle, codes: Codes) {
  const parCle = new Map<string, { mesh: string; code: string; seuil: number; nombre: number; pire: number }>();
  return {
    compter(mesh: string, rapport: number): void {
      const cote = rapport < bornes[0] ? 0 : rapport > bornes[1] ? 1 : null;
      if (cote === null) return;
      const code = cote === 0 ? codes.bas : codes.haut;
      const courant = parCle.get(`${mesh}|${code}`);
      if (!courant) parCle.set(`${mesh}|${code}`, { mesh, code, seuil: bornes[cote], nombre: 1, pire: rapport });
      else {
        courant.nombre++;
        if (gravite(rapport) > gravite(courant.pire)) courant.pire = rapport;
      }
    },
    horsBornes: (): HorsBornes[] => [...parCle.values()],
  };
}

/** L'étirement de l'échantillon `e` contre la pose `base` (gabarit complet, silhouettes et clés croisées à 0, formes indépendantes à leur influence d’entrée), sur les arêtes `aretes` (par mesh). */
export function mesurerEtirement(aretes: ReadonlyMap<string, Uint32Array>, base: Pose, e: Echantillon): MesureDEtirement {
  const hors = decompte(ETIREMENT_EN_CLIP, CODES_EN_CLIP);
  let candidates: RapportDArete[] = [];
  parcourir(aretes, base, e, (mesh, a, b, rapport) => {
    hors.compter(mesh, rapport);
    candidates.push({ mesh, a, b, t: e.t, rapport });
    if (candidates.length > 4096) candidates = pires(candidates, PIRES_ARETES_PAR_CLIP);
  });
  return { clip: e.clip, t: e.t, horsBornes: hors.horsBornes(), pires: pires(candidates, PIRES_ARETES_PAR_CLIP) };
}

/** Les cinq pires arêtes de chaque clip de `mesures`. */
export function piresAretes(mesures: readonly MesureDEtirement[]): Record<string, RapportDArete[]> {
  const parClip: Record<string, RapportDArete[]> = {};
  for (const m of mesures) parClip[m.clip] = pires([...(parClip[m.clip] ?? []), ...m.pires], PIRES_ARETES_PAR_CLIP);
  return parClip;
}

/** Les écarts en clip : par mesh, clip et borne, le pire rapport l_c/l_b, son instant, et le nombre d'instants. */
export function gardeEtirement(mesures: readonly MesureDEtirement[]): Ecart[] {
  const parCle = new Map<string, HorsBornes & { clip: string; instants: number; aretes: number; t: number }>();
  for (const m of mesures) {
    for (const h of m.horsBornes) {
      const cle = `${h.mesh}|${m.clip}|${h.code}`;
      const courant = parCle.get(cle);
      if (!courant) parCle.set(cle, { ...h, clip: m.clip, instants: 1, aretes: h.nombre, t: m.t });
      else {
        courant.instants++;
        courant.aretes = Math.max(courant.aretes, h.nombre);
        if (gravite(h.pire) > gravite(courant.pire)) Object.assign(courant, { pire: h.pire, t: m.t });
      }
    }
  }
  const [bas, haut] = ETIREMENT_EN_CLIP;
  return [...parCle.values()].map((s) => ({
    garde: 'etirement', code: s.code, mesh: s.mesh, clip: s.clip, t: s.t, valeur: s.pire, seuil: s.seuil,
    detail: `jusqu’à ${s.aretes} arête(s) en l_c/l_b (longueur à l’échantillon / longueur de repos sous gabarit complet, silhouettes et clés croisées à 0, formes indépendantes à leur influence d’entrée) hors de [${bas} ; ${haut}], à ${s.instants} instant(s)`,
  }));
}

/** Les écarts au repos posé `repos` contre la pose `base` (gabarit complet, silhouettes et clés croisées à 0, formes indépendantes à leur influence d’entrée) : par mesh et borne, le pire rapport
 *  l_k/l_b hors de `ETIREMENT_AU_REPOS`. */
export function gardeEtirementAuRepos(aretes: ReadonlyMap<string, Uint32Array>, base: Pose, repos: Pose): Ecart[] {
  const hors = decompte(ETIREMENT_AU_REPOS, CODES_AU_REPOS);
  parcourir(aretes, base, repos, (mesh, _a, _b, rapport) => hors.compter(mesh, rapport));
  const [bas, haut] = ETIREMENT_AU_REPOS;
  return hors.horsBornes().map((h) => ({
    garde: 'etirement', code: h.code, mesh: h.mesh, valeur: h.pire, seuil: h.seuil,
    detail: `${h.nombre} arête(s) en l_k/l_b (longueur de repos posée / longueur de repos sous gabarit complet, silhouettes et clés croisées à 0, formes indépendantes à leur influence d’entrée) hors de [${bas} ; ${haut}]`,
  }));
}
