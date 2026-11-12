import { Matrix4, Vector3, type Skeleton } from 'three';
import type { GabaritResolu } from '../../../src/noyau/index.ts';
import { nomDeCleDuGabarit, poseDuGabarit, sensCuitsDuGabarit, type CleDuGabarit, type SensDuGabarit } from '../../../hotes/godot/asset/gabarit.ts';
import { FACTEURS_NEUTRES } from '../../../hotes/godot/asset/facteursDuGabarit.ts';
import type { TableDeGabarit } from '../../../hotes/godot/asset/manifesteDeBase.ts';
import { bindsAuGabarit, enfantsDuGabarit, jambesDuGabarit, poserLeGabarit } from '../../../hotes/godot/asset/evaluateur/gabarit.ts';
import { poidsRelatifsDesAretes, preparerLaplacien, resoudreLaplacien, type Arete } from './laplacien.ts';

export const REFERENCE_DES_ANCRES = Object.freeze({ ...FACTEURS_NEUTRES, legs: 1.37, arms: 1.23, head: 1.51 });
/** La verticale monde de Blender, repère des poses de la construction. */
const HAUT = new Vector3(0, 0, 1);

/** #3104 issuecomment-6549354475 ; `plantes`, par échantillon de `poses`, s'il joue un clip planté (#3314). */
export function matricesDePeauDuGabarit(squelette: Skeleton, table: TableDeGabarit, facteurs: GabaritResolu, poses: Float32Array, plantes: readonly boolean[]): Float32Array {
  const bones = squelette.bones, taille = bones.length * 16;
  if (poses.length % taille) throw new Error('gabarit : poses binaires tronquées');
  if (plantes.length !== poses.length / taille) throw new Error(`gabarit : ${plantes.length} drapeau(x) de plantation pour ${poses.length / taille} échantillon(s)`);
  const pose = poseDuGabarit({ gabarit: table }, facteurs, {});
  const binds = bindsAuGabarit(squelette, pose);
  const trouver = (nom: string) => {
    const b = bones.find((os) => os.name === nom);
    if (!b) throw new Error(`gabarit : os absent ${nom}`);
    return b;
  };
  const enfants = enfantsDuGabarit(pose, trouver);
  const jambes = jambesDuGabarit(pose, trouver);
  const racine = bones.find((b) => b.name === pose.racine.os);
  if (!racine) throw new Error('gabarit : racine absente');
  const originales = bones.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }));
  const sortie = new Float32Array(poses.length);
  const monde = new Matrix4(), local = new Matrix4();
  try {
    for (let offset = 0, k = 0; offset < poses.length; offset += taille, k++) {
      const mondes = bones.map((_, i) => {
        const m = new Matrix4();
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) m.elements[c * 4 + r] = poses[offset + i * 16 + r * 4 + c];
        return m;
      });
      bones.forEach((b, i) => {
        const parent = bones.indexOf(b.parent as typeof b);
        local.copy(parent < 0 ? mondes[i] : monde.copy(mondes[parent]).invert().multiply(mondes[i]));
        local.decompose(b.position, b.quaternion, b.scale);
      });
      poserLeGabarit(racine, pose.racine.echelle, enfants, plantes[k] ? jambes : [], HAUT);
      for (const b of bones) b.updateWorldMatrix(true, false);
      bones.forEach((b, i) => {
        monde.copy(b.matrixWorld).multiply(binds[i]);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) sortie[offset + i * 16 + r * 4 + c] = monde.elements[c * 4 + r];
      });
    }
  } finally {
    bones.forEach((b, i) => { b.position.copy(originales[i].p); b.quaternion.copy(originales[i].q); b.scale.copy(originales[i].s); });
    for (const b of bones) b.updateWorldMatrix(true, false);
  }
  return sortie;
}

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
  const pose = poseDuGabarit({ gabarit: table }, facteurs, {});
  for (const b of squelette.bones) b.updateWorldMatrix(true, false);
  const repos = squelette.bones.map((b) => b.matrixWorld.clone());
  const binds = bindsAuGabarit(squelette, pose);
  return repos.map((b, i) => {
    const s = pose.echellesDesOs[squelette.bones[i].name] ?? [1, 1, 1];
    return b.clone().multiply(squelette.boneInverses[i]).multiply(binds[i].clone().invert())
      .multiply(new Matrix4().makeScale(...s)).multiply(squelette.boneInverses[i]);
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
  for (const b of squelette.bones) b.updateWorldMatrix(true, false);
  const peau = squelette.bones.map((b, i) => b.matrixWorld.clone().multiply(squelette.boneInverses[i]));
  const inversesDesPeaux = peau.map((m) => m.clone().invert());
  const relatives = (facteurs: GabaritResolu) => matricesDuGabarit(squelette, table, facteurs)
    .map((m, i) => m.multiply(inversesDesPeaux[i]));
  const generiques = relatives(REFERENCE_DES_ANCRES);
  const ancres = poids.map((ws) => {
    const portes = ws.filter(([, w]) => w > 0).map(([os]) => generiques[os]);
    return portes.every((m) => m.elements.every((x, c) => Math.abs(x - portes[0].elements[c]) < 1e-9));
  });
  const peaux = poids.map((ws) => combiner(peau, ws));
  const peauInverse = peaux.map((m) => m.clone().invert());
  const q0 = positions.map((p, i) => p.clone().applyMatrix4(peaux[i]).toArray());
  const poidsDesAretes = poidsRelatifsDesAretes(q0, aretes);
  const laplacien = preparerLaplacien(ancres, aretes, poidsDesAretes);

  const resoudre = (facteurs: GabaritResolu, repos: readonly Vector3[] = positions): Vector3[] => {
    if (repos.length !== positions.length) throw new Error('gabarit : repos de taille incorrecte');
    const q = repos.map((p, i) => p.clone().applyMatrix4(peaux[i]));
    const k = relatives(facteurs);
    const a = poids.map((ws) => combiner(k, ws));
    const fixes = q.map((p, i) => p.clone().applyMatrix4(a[i]));
    const seconds = laplacien.libres.map(() => [0, 0, 0]);
    for (const [index, [i, j]] of aretes.entries()) {
      const d = q[i].clone().sub(q[j]);
      const e = lineaire(a[i], d).add(lineaire(a[j], d)).multiplyScalar(0.5 * poidsDesAretes[index]);
      for (const [sommet, signe] of [[i, 1], [j, -1]]) {
        const r = laplacien.rang[sommet];
        if (r >= 0) { seconds[r][0] += signe * e.x; seconds[r][1] += signe * e.y; seconds[r][2] += signe * e.z; }
      }
    }
    for (const [r, sommet, w] of laplacien.bord) { seconds[r][0] += w * fixes[sommet].x; seconds[r][1] += w * fixes[sommet].y; seconds[r][2] += w * fixes[sommet].z; }
    const solution = resoudreLaplacien(laplacien, seconds);
    return fixes.map((p, i) => (ancres[i] ? p : new Vector3(...solution[laplacien.rang[i]] as [number, number, number])).applyMatrix4(peauInverse[i]));
  };

  const sensCuits = sensCuitsDuGabarit(table.bornes);
  const neutres = new Map<string, readonly Vector3[]>();
  const cuire = (cle: CleDuGabarit, sens: SensDuGabarit, silhouette?: { readonly nom: string; readonly deltas: readonly Vector3[] }) => {
    const cuit = sensCuits.find((s) => s.cle === cle && s.sens === sens);
    if (!cuit) throw new Error(`gabarit.${cle} : sens ${sens} sans clé, borne 1`);
    const facteur = cuit.extremite;
    if (silhouette && silhouette.deltas.length !== positions.length) throw new Error(`gabarit : silhouette ${silhouette.nom}, deltas de taille incorrecte`);
    const facteurs = { ...FACTEURS_NEUTRES, [cle]: facteur };
    const nom = nomDeCleDuGabarit(cle, sens);
    let neutre = neutres.get(nom);
    if (!neutre) { neutre = resoudre(facteurs); neutres.set(nom, neutre); }
    const forme = silhouette ? positions.map((p, i) => p.clone().add(silhouette.deltas[i])) : positions;
    const resolu = silhouette ? resoudre(facteurs, forme) : neutre;
    const deltas = resolu.map((p, i) => silhouette ? p.clone().sub(neutre[i]).sub(silhouette.deltas[i]) : p.clone().sub(positions[i]));
    return { nom: nomDeCleDuGabarit(cle, sens, silhouette?.nom), deltas };
  };
  return { ancres: Object.freeze(ancres), resoudre, cuire };
}
