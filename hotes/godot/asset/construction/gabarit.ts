import { Matrix4, Vector3, type Skeleton } from 'three';
import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import { FACTEURS_NEUTRES, nomDeCleDuGabarit, poseDuGabarit, type BornesDuGabarit, type CleDuGabarit, type SensDuGabarit } from '../gabarit.ts';
import type { TableDeGabarit } from '../manifesteDeBase.ts';
import { bindsAuGabarit } from '../evaluateur/gabarit.ts';
import { preparerLaplacien, resoudreLaplacien, type Arete } from './laplacien.ts';

export const REFERENCE_DES_ANCRES = Object.freeze({ ...FACTEURS_NEUTRES, legs: 1.37, arms: 1.23, head: 1.51 });
export type PoidsDuSommet = readonly (readonly [os: number, poids: number])[];
export interface CorpsDuGabarit {
  readonly positions: readonly Vector3[];
  readonly aretes: readonly Arete[];
  readonly poids: readonly PoidsDuSommet[];
  readonly squelette: Skeleton;
  readonly table: TableDeGabarit;
}

/** #3104 issuecomment-6543352958, issuecomment-6543516831. */
export function matricesDuGabarit(squelette: Skeleton, table: TableDeGabarit, facteurs: GabaritResolu): Matrix4[] {
  const pose = poseDuGabarit({ gabarit: table, appuis: { pieds: [], vitessesAuSol: {} } }, facteurs);
  for (const b of squelette.bones) b.updateWorldMatrix(true, false);
  const repos = squelette.bones.map((b) => b.matrixWorld.clone());
  const binds = bindsAuGabarit(squelette, pose);
  return repos.map((b, i) => {
    const s = pose.echellesDesOs[squelette.bones[i].name] ?? [1, 1, 1];
    return b.clone().multiply(squelette.boneInverses[i]).multiply(binds[i].clone().invert())
      .multiply(new Matrix4().makeScale(...s)).multiply(b.clone().invert());
  });
}

function combiner(matrices: readonly Matrix4[], poids: PoidsDuSommet): Matrix4 {
  const m = new Matrix4();
  m.elements.fill(0);
  for (const [os, w] of poids) for (let c = 0; c < 16; c++) m.elements[c] += matrices[os].elements[c] * w;
  return m;
}

function lineaire(m: Matrix4, p: Vector3): Vector3 {
  const e = m.elements;
  return new Vector3(e[0] * p.x + e[4] * p.y + e[8] * p.z, e[1] * p.x + e[5] * p.y + e[9] * p.z, e[2] * p.x + e[6] * p.y + e[10] * p.z);
}

/** #3104 issuecomment-6543352958, issuecomment-6543628310. */
export function preparerGabarit(corps: CorpsDuGabarit) {
  const { positions, aretes, poids, squelette, table } = corps;
  if (poids.length !== positions.length) throw new Error('gabarit : un poids par sommet attendu');
  for (const ws of poids) {
    if (!ws.length || ws.some(([os, w]) => !Number.isInteger(os) || os < 0 || os >= squelette.bones.length || !Number.isFinite(w) || w < 0)
      || Math.abs(ws.reduce((s, [, w]) => s + w, 0) - 1) > 1e-6) throw new Error('gabarit : poids invalides');
  }
  const generiques = matricesDuGabarit(squelette, table, REFERENCE_DES_ANCRES);
  const ancres = poids.map((ws) => {
    const portes = ws.filter(([, w]) => w > 0).map(([os]) => generiques[os]);
    return portes.every((m) => m.elements.every((x, c) => Math.abs(x - portes[0].elements[c]) < 1e-9));
  });
  const laplacien = preparerLaplacien(ancres, aretes);

  const resoudre = (facteurs: GabaritResolu, repos: readonly Vector3[] = positions): Vector3[] => {
    if (repos.length !== positions.length) throw new Error('gabarit : repos de taille incorrecte');
    const k = matricesDuGabarit(squelette, table, facteurs);
    const a = poids.map((ws) => combiner(k, ws));
    const fixes = repos.map((p, i) => p.clone().applyMatrix4(a[i]));
    const seconds = laplacien.libres.map(() => [0, 0, 0]);
    for (const [i, j] of aretes) {
      const d = repos[i].clone().sub(repos[j]);
      const e = lineaire(a[i], d).add(lineaire(a[j], d)).multiplyScalar(0.5);
      for (const [sommet, signe] of [[i, 1], [j, -1]]) {
        const r = laplacien.rang[sommet];
        if (r >= 0) { seconds[r][0] += signe * e.x; seconds[r][1] += signe * e.y; seconds[r][2] += signe * e.z; }
      }
    }
    for (const [r, sommet] of laplacien.bord) { seconds[r][0] += fixes[sommet].x; seconds[r][1] += fixes[sommet].y; seconds[r][2] += fixes[sommet].z; }
    const solution = resoudreLaplacien(laplacien, seconds);
    return fixes.map((p, i) => ancres[i] ? p : new Vector3(...solution[laplacien.rang[i]] as [number, number, number]));
  };

  const cuire = (cle: CleDuGabarit, sens: SensDuGabarit, bornes: BornesDuGabarit, silhouette?: { readonly nom: string; readonly deltas: readonly Vector3[] }) => {
    const facteur = sens === 'moins' ? bornes[cle].min : bornes[cle].max;
    const facteurs = { ...FACTEURS_NEUTRES, [cle]: facteur };
    const neutre = resoudre(facteurs);
    const forme = silhouette ? positions.map((p, i) => p.clone().add(silhouette.deltas[i])) : positions;
    const resolu = silhouette ? resoudre(facteurs, forme) : neutre;
    const deltas = resolu.map((p, i) => silhouette ? p.clone().sub(neutre[i]).sub(silhouette.deltas[i]) : p.clone().sub(positions[i]));
    return { nom: nomDeCleDuGabarit(cle, sens, silhouette?.nom), deltas };
  };
  return { ancres: Object.freeze(ancres), resoudre, cuire };
}
