/**
 * GARDE DES POIDS DE SKINNING (#2972) : au plus `INFLUENCES_MAX` influences (un jeu `JOINTS_1`/`WEIGHTS_1` est lu par
 * `lireGlb`), somme à 1, aucun sommet sans poids, aucun os pondéré hors de la base, et des JUMEAUX (deux sommets d'un
 * mesh à la même position de repos) aux poids identiques. Seuils : `scripts/personnage-3d/verifier_export.py:22-25`.
 */
import type { SkinnedMesh } from 'three';
import type { Ecart } from '../ecart.ts';

export const INFLUENCES_MAX = 4;
export const POIDS_NEGLIGEABLE = 1e-7;
export const TOLERANCE_SOMME_POIDS = 1e-4;
export const TOLERANCE_JUMEAUX_POSITION_M = 1e-5;
export const TOLERANCE_JUMEAUX_POIDS = 1e-4;

export interface SujetDePoids {
  readonly meshes: readonly SkinnedMesh[];
  readonly osDeLaBase: ReadonlySet<string>;
  /** Par nœud à mesh, ses attributs d'influence au-delà du premier jeu (`ContenuGlb.influencesEtendues`). */
  readonly influencesEtendues: ReadonlyMap<string, readonly string[]>;
}

const GARDE = 'poids';

/** Les poids du sommet `i` de `m`, par nom d'os (au-dessus de `POIDS_NEGLIGEABLE`). */
function poidsDuSommet(m: SkinnedMesh, i: number): Map<string, number> {
  const indices = m.geometry.attributes.skinIndex;
  const poids = m.geometry.attributes.skinWeight;
  const parOs = new Map<string, number>();
  for (let k = 0; k < INFLUENCES_MAX; k++) {
    const w = poids.getComponent(i, k);
    if (w <= POIDS_NEGLIGEABLE) continue;
    const nom = m.skeleton.bones[indices.getComponent(i, k)]?.name ?? `#${indices.getComponent(i, k)}`;
    parOs.set(nom, (parOs.get(nom) ?? 0) + w);
  }
  return parOs;
}

const ecartDePoids = (a: Map<string, number>, b: Map<string, number>): number =>
  Math.max(0, ...[...new Set([...a.keys(), ...b.keys()])].map((os) => Math.abs((a.get(os) ?? 0) - (b.get(os) ?? 0))));

/** Les paires de sommets de `m` distants d'au plus `TOLERANCE_JUMEAUX_POSITION_M` au repos (grille de ce pas, cellules voisines comprises). */
function jumeaux(m: SkinnedMesh): [number, number][] {
  const p = m.geometry.attributes.position;
  const cellule = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map((c) => Math.floor(c / TOLERANCE_JUMEAUX_POSITION_M));
  const grille = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) {
    const cle = cellule(i).join(',');
    const liste = grille.get(cle);
    if (liste) liste.push(i);
    else grille.set(cle, [i]);
  }
  const paires: [number, number][] = [];
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = cellule(i);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grille.get(`${x + dx},${y + dy},${z + dz}`) ?? []) {
        if (j <= i) continue;
        const d = Math.hypot(p.getX(i) - p.getX(j), p.getY(i) - p.getY(j), p.getZ(i) - p.getZ(j));
        if (d <= TOLERANCE_JUMEAUX_POSITION_M) paires.push([i, j]);
      }
    }
  }
  return paires;
}

export function gardePoids(sujet: SujetDePoids): Ecart[] {
  const ecarts: Ecart[] = [];
  for (const [noeud, attributs] of sujet.influencesEtendues) {
    ecarts.push({ garde: GARDE, code: 'influences-au-dela-de-4', mesh: noeud, valeur: attributs.join(', '), seuil: INFLUENCES_MAX, detail: `jeu d’influence au-delà du premier (${attributs.join(', ')})` });
  }
  for (const m of sujet.meshes) {
    const n = m.geometry.attributes.position.count;
    const poids = Array.from({ length: n }, (_, i) => poidsDuSommet(m, i));
    let nulles = 0;
    let fausses = 0;
    let pire = { i: -1, somme: 1 };
    const horsBase = new Set<string>();
    poids.forEach((parOs, i) => {
      const somme = [...parOs.values()].reduce((a, b) => a + b, 0);
      if (somme === 0) nulles++;
      else if (Math.abs(somme - 1) > TOLERANCE_SOMME_POIDS) {
        fausses++;
        if (Math.abs(somme - 1) > Math.abs(pire.somme - 1)) pire = { i, somme };
      }
      for (const os of parOs.keys()) if (!sujet.osDeLaBase.has(os)) horsBase.add(os);
    });
    if (nulles) ecarts.push({ garde: GARDE, code: 'somme-nulle', mesh: m.name, valeur: nulles, seuil: 0, detail: `${nulles} sommet(s) sans aucun poids` });
    if (fausses) ecarts.push({ garde: GARDE, code: 'somme', mesh: m.name, valeur: pire.somme, seuil: TOLERANCE_SOMME_POIDS, detail: `${fausses} sommet(s) de somme ≠ 1, pire #${pire.i}` });
    if (horsBase.size) ecarts.push({ garde: GARDE, code: 'os-hors-base', mesh: m.name, valeur: horsBase.size, seuil: 0, detail: `os pondérés hors de la base : ${[...horsBase].join(', ')}` });
    const divergents = jumeaux(m).map(([i, j]) => ({ i, j, ecart: ecartDePoids(poids[i], poids[j]) })).filter((d) => d.ecart > TOLERANCE_JUMEAUX_POIDS);
    if (divergents.length) {
      const d = divergents.reduce((a, b) => (b.ecart > a.ecart ? b : a));
      ecarts.push({ garde: GARDE, code: 'jumeaux-divergents', mesh: m.name, valeur: d.ecart, seuil: TOLERANCE_JUMEAUX_POIDS, detail: `${divergents.length} paire(s) de sommets confondus aux poids différents, pire #${d.i}/#${d.j}` });
    }
  }
  return ecarts;
}
