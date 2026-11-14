import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bone, Matrix4, Skeleton, Vector3 } from 'three';
import { deplacementsDesOs, poidsDuGabarit, poseDuGabarit, sensCuitsDuGabarit } from '../../../hotes/godot/asset/gabarit.ts';
import { FACTEURS_NEUTRES } from '../../../hotes/godot/asset/facteursDuGabarit.ts';
import { CARRURE_MOINS, CARRURE_PLUS, FEMININ, CORPULENCE } from '../../../hotes/godot/asset/silhouettes.ts';
import type { TableDeGabarit } from '../../../hotes/godot/asset/manifesteDeBase.ts';
import { bindsAuGabarit, deplacementsMondeDesOs, enfantsDuGabarit, poserEnfantsDuGabarit } from '../../../hotes/godot/asset/evaluateur/gabarit.ts';
import { matricesDePeauDuGabarit, matricesDuGabarit, preparerGabarit, REFERENCE_DES_ANCRES, type PoidsDuSommet } from './gabarit.ts';
import { poidsRelatifsDesAretes, preparerLaplacien, resoudreLaplacien, type Arete } from './laplacien.ts';

import { etatsDuGabarit } from '../../../hotes/godot/asset/etatsDuGabarit.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { jouet } from './gabarit.testkit.ts';
import { BORNES } from '../../../hotes/godot/asset/gabarit.testkit.ts';

describe('H5 de construction, ancres fixes (#3104)', () => {
  it('émet chaque état de construction avec sa référence sans silhouettes', () => {
    const c = jouet(), noms = c.silhouettes.map((s) => s.nom);
    const etats = etatsDuGabarit(c.table, noms);
    expect(etats.filter((e) => Object.entries(FACTEURS_NEUTRES).every(([cle, v]) => e.facteurs[cle as keyof typeof FACTEURS_NEUTRES] === v)).map((e) => e.nom).sort()).toEqual(['neutre', FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS, `${CORPULENCE}_${CARRURE_MOINS}`, `${FEMININ}_${CORPULENCE}`, `${FEMININ}_${CARRURE_MOINS}`, `${FEMININ}_${CORPULENCE}_${CARRURE_MOINS}`].sort());
    for (const { cle, sens } of sensCuitsDuGabarit(BORNES)) for (const silhouette of ['neutre', ...noms]) {
      const e = etats.find((etat) => etat.nom === `${cle}_${sens}__${silhouette}`);
      expect(e).toBeDefined();
      expect(e!.poidsReference).toEqual(poidsDuGabarit(e!.facteurs, BORNES, tableTotale(noms, () => 0)));
    }
    expect(etats.filter((e) => e.nom.startsWith('combinaison')).length).toBeGreaterThan(0);
  });

  it('transporte les poses monde en peau compensée, au repos et pendant le clip', () => {
    const c = jouet(), poses: number[] = [], bones = c.squelette.bones;
    const avant = bones.map((b) => b.position.toArray());
    for (const angle of [0, 0.7]) {
      bones[3].rotation.z += angle;
      bones[0].updateMatrixWorld(true);
      for (const b of bones) poses.push(...b.matrixWorld.clone().transpose().elements);
      bones[3].rotation.z -= angle;
    }
    bones[0].updateMatrixWorld(true);
    const facteurs = { ...FACTEURS_NEUTRES, legs: BORNES.legs.min, arms: BORNES.arms.max };
    const obtenu = matricesDePeauDuGabarit(c.squelette, c.table, facteurs, {}, new Float32Array(poses), [false, false]);
    const pose = poseDuGabarit({ gabarit: c.table }, facteurs, {});
    const enfants = enfantsDuGabarit(pose, (nom) => bones.find((b) => b.name === nom)!);
    const binds = bindsAuGabarit(c.squelette, pose);
    for (const [rang, angle] of [0, 0.7].entries()) {
      bones[3].rotation.z += angle;
      poserEnfantsDuGabarit(enfants);
      bones[0].updateMatrixWorld(true);
      for (const [i, b] of bones.entries()) {
        const attendu = b.matrixWorld.clone().multiply(binds[i]).transpose().elements;
        attendu.forEach((v, j) => expect(obtenu[(rang * bones.length + i) * 16 + j]).toBeCloseTo(v, 5));
      }
      for (const [b, facteur] of enfants) b.position.y /= facteur;
      bones[3].rotation.z -= angle;
    }
    bones.forEach((b, i) => b.position.toArray().forEach((v, j) => expect(v).toBeCloseTo(avant[i][j], 12)));
    expect(() => matricesDePeauDuGabarit(c.squelette, c.table, facteurs, {}, new Float32Array(3), [])).toThrow(/tronquées/);
    expect(() => matricesDePeauDuGabarit(c.squelette, c.table, facteurs, {}, new Float32Array(poses), [false])).toThrow(/1 drapeau\(x\) de plantation pour 2/);
  });

  it('plie les jambes des échantillons plantés : le pied garde sa matrice monde du clip, le haut du corps suit le gabarit', () => {
    const c = jouet(), poses: number[] = [], bones = c.squelette.bones;
    bones[3].rotation.z += 0.4;
    bones[0].updateMatrixWorld(true);
    const neutres = bones.map((b) => b.matrixWorld.clone());
    for (let k = 0; k < 2; k++) for (const b of bones) poses.push(...b.matrixWorld.clone().transpose().elements);
    bones[3].rotation.z -= 0.4;
    bones[0].updateMatrixWorld(true);
    const facteurs = { ...FACTEURS_NEUTRES, legs: BORNES.legs.max };
    const obtenu = matricesDePeauDuGabarit(c.squelette, c.table, facteurs, {}, new Float32Array(poses), [false, true]);
    const binds = bindsAuGabarit(c.squelette, poseDuGabarit({ gabarit: c.table }, facteurs, {}));
    const monde = (rang: number, os: number) => new Matrix4().fromArray(Array.from(obtenu.subarray((rang * bones.length + os) * 16, (rang * bones.length + os + 1) * 16))).transpose().multiply(binds[os].clone().invert());
    const pied = bones.findIndex((b) => b.name === 'foot');
    const ecart = (a: Matrix4, b: Matrix4) => Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i])));
    expect(ecart(monde(1, pied), neutres[pied])).toBeLessThan(1e-5);
    expect(ecart(monde(0, pied), neutres[pied])).toBeGreaterThan(1e-2);
  });

  it('énumère les extrémités cuites depuis les bornes', () => {
    expect(sensCuitsDuGabarit(BORNES)).toEqual([
      { cle: 'legs', sens: 'moins', extremite: BORNES.legs.min },
      { cle: 'legs', sens: 'plus', extremite: BORNES.legs.max },
      { cle: 'arms', sens: 'plus', extremite: BORNES.arms.max },
      { cle: 'head', sens: 'plus', extremite: BORNES.head.max },
    ]);
  });

  it.each([0, 0.3])('résout dans le repère avant skinning avec un bind décalé de %s m', (decale) => {
    const root = new Bone(), leg = new Bone();
    root.name = 'root'; leg.name = 'leg'; leg.position.y = 1; root.add(leg);
    root.updateWorldMatrix(true, true);
    const bones = [root, leg];
    const inv = bones.map((b) => new Matrix4().makeTranslation(0, decale, 0).multiply(b.matrixWorld).invert());
    const positions = [new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(1, 1, 0)];
    const table: TableDeGabarit = { racine: 'root', legs: ['leg'], arms: [], head: [], st: { min: 0.72, max: 1.7 }, bornes: BORNES, osDesSilhouettes: {} };
    const h5 = preparerGabarit({ positions, aretes: [[0, 1], [1, 2], [2, 0], [1, 3], [3, 2]],
      poids: [[[0, 1]], [[0, 0.5], [1, 0.5]], [[1, 1]], [[1, 1]]], squelette: new Skeleton(bones, inv), table });
    const ecart = Math.max(...h5.resoudre(FACTEURS_NEUTRES).map((p, i) => p.distanceTo(positions[i])));
    expect(ecart).toBeLessThanOrEqual(1e-5);
  });
  it('tient les ancres et résout le gradient uniforme sur une chaîne connue', () => {
    const root = new Bone(), leg = new Bone(), child = new Bone();
    root.name = 'root'; leg.name = 'leg'; child.name = 'child';
    root.add(leg); leg.add(child); child.position.y = 1; root.updateMatrixWorld(true);
    const table: TableDeGabarit = { racine: 'root', legs: ['leg'], arms: [], head: [], st: { min: 0.8, max: 1.2 }, bornes: BORNES, osDesSilhouettes: {} };
    const h5 = preparerGabarit({ squelette: new Skeleton([root, leg, child]), table,
      positions: [new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 2, 0)],
      aretes: [[0, 1], [1, 2]], poids: [[[1, 1]], [[1, 0.5], [2, 0.5]], [[2, 1]]],
    });
    expect(h5.ancres).toEqual([true, false, true]);
    expect(h5.resoudre({ ...FACTEURS_NEUTRES, legs: 2 }).map((p) => p.y)).toEqual([0, 1.75, 3]);
  });

  it('tient une arête courte sous énergie relative malgré un champ cible incompatible', () => {
    const aretes: Arete[] = [[0, 1], [1, 2]];
    const positions = [[0, 0, 0], [0.01, 0, 0], [1, 0, 0]];
    const resoudre = (poids: readonly number[]) => {
      const l = preparerLaplacien([true, false, true], aretes, poids);
      const second = poids[0] * 0.01 - poids[1] * 0.99 + poids[1] * 0.98;
      return resoudreLaplacien(l, [[second]])[0][0] / 0.01;
    };
    expect(Math.abs(resoudre([1, 1]))).toBeLessThan(0.25);
    const relatif = resoudre(poidsRelatifsDesAretes(positions, aretes));
    expect(relatif).toBeGreaterThanOrEqual(0.25);
    expect(relatif).toBeLessThanOrEqual(3.5);
    expect(relatif).toBeCloseTo(0.9997959600081616, 12);
  });

  it.each(['repos', 'propres à chaque os'] as const)('câble dans H5 les longueurs du repos skinné sur une chaîne à arête courte, binds %s', (bind) => {
    const root = new Bone(), leg = new Bone(), child = new Bone();
    root.name = 'root'; leg.name = 'leg'; child.name = 'child';
    root.add(leg); leg.add(child); child.position.y = 1; root.updateMatrixWorld(true);
    const bones = [root, leg, child], echelles = bind === 'repos' ? [1, 1, 1] : [1, 3, 0.3];
    const inverses = bones.map((b, i) => b.matrixWorld.clone().invert().multiply(new Matrix4().makeScale(1, echelles[i], 1)));
    const squelette = new Skeleton(bones, inverses);
    const positions = [new Vector3(0, 0, 0), new Vector3(0, 0.01, 0), new Vector3(0, 1, 0)];
    const table: TableDeGabarit = { racine: 'root', legs: ['leg'], arms: [], head: [], st: { min: 0.8, max: 1.2 }, bornes: { ...BORNES, legs: { min: 0.5, max: 2 } }, osDesSilhouettes: {} };
    const h5 = preparerGabarit({ squelette, table, positions, aretes: [[0, 1], [1, 2]],
      poids: [[[1, 1]], [[1, 0.5], [2, 0.5]], [[2, 1]]] });
    const peauDuMilieu = (echelles[1] + echelles[2]) / 2;
    const q = [0, 0.01 * peauDuMilieu, echelles[2]];
    const poidsCourt = 1 / (q[1] - q[0]) ** 2, poidsLong = 1 / (q[2] - q[1]) ** 2;
    const cibleDepuisLeBas = 1.75 * (q[1] - q[0]);
    const cibleDepuisLeHaut = q[2] + 1 - 1.25 * (q[2] - q[1]);
    const milieu = (poidsCourt * cibleDepuisLeBas + poidsLong * cibleDepuisLeHaut) / (poidsCourt + poidsLong);
    const attendus = [new Vector3(), new Vector3(0, milieu / peauDuMilieu, 0), new Vector3(0, (q[2] + 1) / echelles[2], 0)];
    const rendus = h5.resoudre({ ...FACTEURS_NEUTRES, legs: 2 });
    expect(h5.ancres).toEqual([true, false, true]);
    for (const [i, rendu] of rendus.entries()) expect(rendu.distanceTo(attendus[i]), `sommet ${i}, binds ${bind}`).toBeLessThan(1e-12);
  });

  it('refuse une arête neutre de longueur nulle par son nom sans seuil de longueur', () => {
    expect(() => poidsRelatifsDesAretes([[0, 0, 0], [0, 0, 0]], [[0, 1]])).toThrow(/arete-de-longueur-nulle 0-1/);
    expect(poidsRelatifsDesAretes([[0, 0, 0], [1e-12, 0, 0]], [[0, 1]])[0]).toBeCloseTo(1e24, -10);
  });

  it('résout le laplacien multi-colonnes et refuse une composante sans appui', () => {
    const l = preparerLaplacien([true, false, false, true], [[0, 1], [1, 2], [2, 3]], [1, 1, 1]);
    expect(resoudreLaplacien(l, [[0, 3], [3, 0]])[0][0]).toBeCloseTo(1, 12);
    expect(resoudreLaplacien(l, [[0, 3], [3, 0]])[1][0]).toBeCloseTo(2, 12);
    expect(resoudreLaplacien(l, [[0, 3], [3, 0]])[0][1]).toBeCloseTo(2, 12);
    expect(() => resoudreLaplacien(preparerLaplacien([false, false], [[0, 1]], [1]), [[0], [1]])).toThrow(/sans appui/);
  });

  it('conserve le squelette et choisit les ancres avant les états mesurés', () => {
    const c = jouet(), avant = c.squelette.bones.map((b) => [b.position.toArray(), b.matrixWorld.toArray()]);
    const h5 = preparerGabarit(c), ancres = [...h5.ancres];
    expect(ancres.filter(Boolean).length).toBeGreaterThan(0);
    expect(ancres.filter((a) => !a).length).toBeGreaterThan(0);
    expect(REFERENCE_DES_ANCRES).toEqual({ sl: 1, st: 1, legs: 1.37, arms: 1.23, head: 1.51 });
    h5.resoudre({ ...FACTEURS_NEUTRES, legs: 0.62, arms: BORNES.arms.max, head: BORNES.head.max });
    h5.resoudre(FACTEURS_NEUTRES);
    expect(h5.ancres).toEqual(ancres);
    expect(c.squelette.bones.map((b) => [b.position.toArray(), b.matrixWorld.toArray()])).toEqual(avant);
    const k = matricesDuGabarit(c.squelette, c.table, FACTEURS_NEUTRES);
    for (const m of k) m.elements.forEach((v, i) => expect(v).toBeCloseTo(i % 5 === 0 ? 1 : 0, 12));
  });

  it('emploie le bind propre à chaque os dans M′ S B⁻¹', () => {
    const c = jouet();
    c.squelette.boneInverses = c.squelette.bones.map((b, i) =>
      b.matrixWorld.clone().multiply(new Matrix4().makeRotationZ(0.1 * i).setPosition(0.01 * i, 0, 0)).invert());
    const neutre = matricesDuGabarit(c.squelette, c.table, FACTEURS_NEUTRES);
    for (const [i, m] of neutre.entries()) {
      const attendu = c.squelette.bones[i].matrixWorld.clone().multiply(c.squelette.boneInverses[i]);
      m.elements.forEach((x, j) => expect(x).toBeCloseTo(attendu.elements[j], 12));
    }
    expect(Math.max(...neutre.flatMap((m) => m.elements.map((x, j) => Math.abs(x - (j % 5 === 0 ? 1 : 0)))))).toBeGreaterThan(0.1);
    const facteurs = { ...FACTEURS_NEUTRES, legs: 0.62, arms: BORNES.arms.max, head: BORNES.head.max };
    const obtenu = matricesDuGabarit(c.squelette, c.table, facteurs);
    const pose = poseDuGabarit({ gabarit: c.table }, facteurs, {});
    const enfants = enfantsDuGabarit(pose, (nom) => c.squelette.bones.find((b) => b.name === nom)!);
    poserEnfantsDuGabarit(enfants);
    c.squelette.bones[0].updateMatrixWorld(true);
    const attendu = c.squelette.bones.map((b, i) => b.matrixWorld.clone()
      .multiply(new Matrix4().makeScale(...(pose.echellesDesOs[b.name] ?? [1, 1, 1])))
      .multiply(c.squelette.boneInverses[i]));
    const ecart = Math.max(...obtenu.flatMap((m, i) => m.elements.map((x, j) => Math.abs(x - attendu[i].elements[j]))));
    expect(ecart).toBeLessThan(1e-12);
  });

  it('refuse les poids et les tailles de repos ou de silhouette invalides', () => {
    const c = jouet();
    expect(() => preparerGabarit({ ...c, poids: [] })).toThrow(/un poids par sommet/);
    const invalides: readonly PoidsDuSommet[] = [[], [[-1, 1]], [[1.5, 1]], [[c.squelette.bones.length, 1]],
      [[0, Number.NaN]], [[0, -1], [1, 2]], [[0, 0.9]]];
    for (const poids of invalides) expect(() => preparerGabarit({ ...c, poids: [poids, ...c.poids.slice(1)] })).toThrow(/poids invalides/);
    expect(() => preparerGabarit({ ...c, aretes: [[0, c.positions.length]] })).toThrow(/arête hors du maillage/);
    const h5 = preparerGabarit(c);
    expect(() => h5.resoudre(FACTEURS_NEUTRES, [])).toThrow(/repos de taille incorrecte/);
    expect(() => h5.cuire('arms', 'moins')).toThrow(/arms.*moins.*1/);
    expect(() => h5.cuire('head', 'moins')).toThrow(/head.*moins.*1/);
    expect(() => h5.cuire('legs', 'plus', { nom: 'tronquee', deltas: [] })).toThrow(/tronquee.*deltas de taille incorrecte/);
  });

  it.each(['repos', 'affine commun', 'propre à chaque os'] as const)('additionne les clés cuites et croisées comme H5 direct, bind %s, à 1e-5 m', (bind) => {
    const c = jouet();
    if (bind === 'affine commun') {
      const peau = new Matrix4().makeRotationZ(0.37).setPosition(0.14, -0.08, 0.03);
      c.squelette.boneInverses = c.squelette.bones.map((b) => b.matrixWorld.clone().invert().multiply(peau));
    } else if (bind === 'propre à chaque os') {
      c.squelette.boneInverses = c.squelette.bones.map((b, i) =>
        b.matrixWorld.clone().multiply(new Matrix4().makeRotationZ(0.1 * i).setPosition(0.01 * i, 0, 0)).invert());
    }
    const h5 = preparerGabarit(c);
    const neutre = h5.resoudre(FACTEURS_NEUTRES);
    const ecartNeutre = Math.max(...neutre.map((p, i) => p.distanceTo(c.positions[i])));
    expect(ecartNeutre, bind).toBeLessThanOrEqual(1e-5);
    const cles = sensCuitsDuGabarit(BORNES).flatMap(({ cle, sens }) => [
      h5.cuire(cle, sens), ...c.silhouettes.map((s) => h5.cuire(cle, sens, s)),
    ]);
    expect(cles).toHaveLength(20);
    const poidsSilhouettes = Object.fromEntries(c.silhouettes.map((s, i) => [s.nom, [0.4, 0.8, 1, 0.55][i]]));
    const repos = c.positions.map((p, i) => c.silhouettes.reduce((v, s) => v.addScaledVector(s.deltas[i], poidsSilhouettes[s.nom]), p.clone()));
    const etats = [
      { legs: 0.62, arms: BORNES.arms.max, head: BORNES.head.max }, { legs: 1.3, arms: 1.4, head: 1.2 },
      { legs: BORNES.legs.min, arms: FACTEURS_NEUTRES.arms, head: FACTEURS_NEUTRES.head }, { legs: BORNES.legs.max, arms: BORNES.arms.max, head: BORNES.head.max },
      { legs: 0.66, arms: 1.3, head: BORNES.head.max }, { legs: 0.7, arms: BORNES.arms.max, head: 1.4 },
      { legs: FACTEURS_NEUTRES.legs, arms: BORNES.arms.max, head: FACTEURS_NEUTRES.head }, { legs: FACTEURS_NEUTRES.legs, arms: FACTEURS_NEUTRES.arms, head: BORNES.head.max },
      { ...FACTEURS_NEUTRES }, { legs: 1.6, arms: 1.8, head: 2.1 },
      { legs: 1.2, arms: FACTEURS_NEUTRES.arms, head: FACTEURS_NEUTRES.head }, { legs: FACTEURS_NEUTRES.legs, arms: 1.3, head: FACTEURS_NEUTRES.head }, { legs: 0.8, arms: FACTEURS_NEUTRES.arms, head: FACTEURS_NEUTRES.head },
    ];
    for (const etat of etats) {
      const facteurs = { ...FACTEURS_NEUTRES, ...etat };
      const poids = poidsDuGabarit(facteurs, BORNES, poidsSilhouettes);
      const additionnes = repos.map((p, i) => cles.reduce((v, cle) => v.addScaledVector(cle.deltas[i], poids[cle.nom]), p.clone()));
      const direct = h5.resoudre(facteurs, repos);
      const max = Math.max(...additionnes.map((p, i) => p.distanceTo(direct[i])));
      expect(max, JSON.stringify(etat)).toBeLessThan(1e-5);
    }
  });
});

/** Racine, `bras` et son `enfant`, non colinéaires ; la carrure déplace la tête de `enfant` (#4002). */
function fourche() {
  const root = new Bone(), bras = new Bone(), enfant = new Bone();
  root.name = 'root'; bras.name = 'bras'; enfant.name = 'enfant';
  bras.position.set(0.05, 0.3, 0); bras.rotation.z = 0.4;
  enfant.position.set(0, 0.5, 0); enfant.rotation.z = 1;
  root.add(bras); bras.add(enfant); root.updateMatrixWorld(true);
  const bones = [root, bras, enfant], squelette = new Skeleton(bones);
  const table: TableDeGabarit = { racine: 'root', legs: [], arms: ['bras'], head: [], st: { min: 0.8, max: 1.2 }, bornes: BORNES,
    osDesSilhouettes: { [CARRURE_PLUS]: { enfant: [0.1, 0.02, 0] } } };
  const tete = (b: Bone) => b.getWorldPosition(new Vector3());
  const segments = [[tete(root), tete(bras), 0, 1], [tete(bras), tete(enfant), 1, 2], [tete(enfant), enfant.localToWorld(new Vector3(0, 0.4, 0)), 2, 2]] as const;
  const positions: Vector3[] = [], poids: PoidsDuSommet[] = [];
  for (const [a, b, i, j] of segments) for (const t of [0, 1 / 3, 2 / 3]) for (const decale of [-0.04, 0.04]) {
    positions.push(a.clone().lerp(b, t).add(new Vector3(decale, 0, decale / 2)));
    poids.push(t === 0 || i === j ? [[i, 1]] : [[i, 1 - t], [j, t]]);
  }
  const aretes: Arete[] = positions.flatMap((_, i): Arete[] => [...(i ? [[i - 1, i] as Arete] : []), ...(i > 1 ? [[i - 2, i] as Arete] : [])]);
  const trouver = (nom: string) => bones.find((b) => b.name === nom)!;
  const deplaces = Object.entries(deplacementsDesOs(table, { [CARRURE_PLUS]: 1 })).map(([nom, t]) => [trouver(nom), t] as const);
  const d = deplacementsMondeDesOs(deplaces, bones);
  const portage = poids.map((ws) => ws.reduce((v, [os, w]) => v.addScaledVector(d[os], w), new Vector3()));
  const residu = positions.map((_, i) => new Vector3(0.01 * Math.sin(i), 0.008 * Math.cos(2 * i), 0.005 * Math.sin(3 * i)));
  const corps = {
    positions: positions.map((p) => p.toArray()), aretes, poids,
    squelette: bones.map((b, i) => ({ nom: b.name, parent: b.parent === null ? null : bones.indexOf(b.parent as Bone), repos: b.matrix.toArray(), boneInverse: squelette.boneInverses[i].toArray() })),
    silhouettes: [{ nom: CARRURE_PLUS, deltas: residu.map((p) => p.toArray()), portage: portage.map((p) => p.toArray()) }],
  };
  const repos = bones.flatMap((b) => b.matrixWorld.clone().transpose().toArray());
  return { bones, squelette, table, positions, poids, d, portage, residu, corps, repos };
}

const pont = (entree: unknown) => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./gabarit.mjs', import.meta.url))], { input: JSON.stringify(entree), encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout);
};

const matriceDeLaPile = (pile: Float32Array, echantillon: number, os: number, nombre: number) =>
  new Matrix4().fromArray(Array.from(pile.subarray((echantillon * nombre + os) * 16, (echantillon * nombre + os + 1) * 16))).transpose();

describe('Os déplacés par les silhouettes à la construction (#4002 issuecomment-6817454030)', () => {
  it('rend par les clés T et la pose aux os déplacés la référence résolue sur le résidu plus le portage, à 1e-6', () => {
    const f = fourche();
    const { cles, etats } = pont({ table: f.table, corps: f.corps });
    const etat = etats.find((e: { nom: string }) => e.nom === `combinaison_legs_moins_arms_plus_head_plus__extremes__${CARRURE_PLUS}`);
    expect(etat.poidsSilhouettes[CARRURE_PLUS]).toBe(1);
    expect(etat.facteurs.arms).not.toBe(FACTEURS_NEUTRES.arms);
    const sl = 1.25;
    const totale = f.positions.map((_, i) => f.residu[i].clone().add(f.portage[i]));
    const peau = matricesDePeauDuGabarit(f.squelette, f.table, { ...etat.facteurs, sl }, etat.poidsSilhouettes, new Float32Array(f.repos), [false]);
    const echelle = new Matrix4().makeScale(sl, sl, sl);
    let ecart = 0;
    for (const [i, p] of f.positions.entries()) {
      const pose = cles.reduce((v: Vector3, cle: { nom: string; deltas: number[][] }) => v.addScaledVector(new Vector3(...cle.deltas[i]), etat.poidsGabarit[cle.nom] ?? 0), p.clone().add(totale[i]));
      const rendu = f.poids[i].reduce((v, [os, w]) => v.addScaledVector(pose.clone().applyMatrix4(matriceDeLaPile(peau, 0, os, f.bones.length)), w), new Vector3());
      ecart = Math.max(ecart, rendu.distanceTo(new Vector3(...etat.positions[i]).applyMatrix4(echelle)));
    }
    expect(Math.max(...f.portage.map((c) => c.length()))).toBeGreaterThan(0.05);
    expect(ecart).toBeLessThan(1e-6);
  });

  it('tient les matrices du repos sans les os déplacés et tourne l’enfant fléchi autour de sa tête déplacée', () => {
    const f = fourche(), enfant = f.bones[2];
    enfant.rotation.z += 0.6;
    f.bones[0].updateMatrixWorld(true);
    const poses = new Float32Array([...f.repos, ...f.bones.flatMap((b) => b.matrixWorld.clone().transpose().toArray())]);
    enfant.rotation.z -= 0.6;
    f.bones[0].updateMatrixWorld(true);
    const ecart = (a: Matrix4, b: Matrix4) => Math.max(...a.elements.map((v, i) => Math.abs(v - b.elements[i])));
    const facteurs = { ...FACTEURS_NEUTRES, sl: 1.25, arms: 1.6 };
    const sans = matricesDePeauDuGabarit(f.squelette, f.table, facteurs, { [CARRURE_PLUS]: 0 }, poses, [false, false]);
    const avec = matricesDePeauDuGabarit(f.squelette, f.table, facteurs, { [CARRURE_PLUS]: 1 }, poses, [false, false]);
    for (const os of f.bones.keys()) expect(ecart(matriceDeLaPile(avec, 0, os, 3), matriceDeLaPile(sans, 0, os, 3)), `os ${os}`).toBeLessThan(1e-6);
    expect(ecart(matriceDeLaPile(avec, 1, 2, 3), matriceDeLaPile(sans, 1, 2, 3))).toBeGreaterThan(1e-2);
    const neutres = matricesDePeauDuGabarit(f.squelette, f.table, FACTEURS_NEUTRES, { [CARRURE_PLUS]: 1 }, poses, [false, false]);
    const tete = enfant.getWorldPosition(new Vector3()).add(f.d[2]);
    expect(tete.clone().applyMatrix4(matriceDeLaPile(neutres, 1, 2, 3)).distanceTo(tete)).toBeLessThan(1e-6);
    expect(f.d[2].length()).toBeGreaterThan(0.05);
  });

  it('calcule un jeu de matrices par facteurs et poids des silhouettes à os, partagé entre les états qui les ont', () => {
    const f = fourche(), dossier = mkdtempSync(join(tmpdir(), 'gabarit-jeux-'));
    try {
      f.bones[2].rotation.z += 0.6;
      f.bones[0].updateMatrixWorld(true);
      const poses = [...f.repos, ...f.bones.flatMap((b) => b.matrixWorld.clone().transpose().toArray())];
      f.bones[2].rotation.z -= 0.6;
      f.bones[0].updateMatrixWorld(true);
      writeFileSync(join(dossier, 'poses.bin'), new Uint8Array(new Float32Array(poses).buffer));
      const facteurs = { ...FACTEURS_NEUTRES, arms: 1.3 };
      const etats = [
        { nom: 'a', facteurs, poidsSilhouettes: { [FEMININ]: 0, [CARRURE_PLUS]: 0 } },
        { nom: 'b', facteurs, poidsSilhouettes: { [FEMININ]: 0, [CARRURE_PLUS]: 1 } },
        { nom: 'c', facteurs, poidsSilhouettes: { [FEMININ]: 1, [CARRURE_PLUS]: 1 } },
      ];
      const { groupes } = pont({ operation: 'matrices', table: f.table, corps: { squelette: f.corps.squelette }, clips: [['clip', 1]], plantes: [],
        poses: join(dossier, 'poses.bin'), sortie: dossier, etats });
      expect(groupes).toHaveLength(1);
      expect(groupes[0].etats.map((e: { nom: string }) => e.nom)).toEqual(['a', 'b', 'c']);
      expect(groupes[0].fichiers).toEqual([join(dossier, 'jeu-0.bin'), join(dossier, 'jeu-1.bin')]);
      expect(groupes[0].jeux).toEqual([0, 1, 1]);
      const lire = (nom: string) => { const o = readFileSync(join(dossier, nom)); return new Float32Array(o.buffer, o.byteOffset, o.byteLength / 4); };
      const sans = lire('jeu-0.bin'), avec = lire('jeu-1.bin');
      expect(Array.from(avec)).toEqual(Array.from(matricesDePeauDuGabarit(f.squelette, f.table, facteurs, { [CARRURE_PLUS]: 1 }, new Float32Array(poses), [false, false])));
      expect(Array.from(sans)).toEqual(Array.from(matricesDePeauDuGabarit(f.squelette, f.table, facteurs, {}, new Float32Array(poses), [false, false])));
      expect(Math.max(...Array.from(avec).map((v, i) => Math.abs(v - sans[i])))).toBeGreaterThan(1e-2);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
