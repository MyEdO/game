import { describe, expect, it } from 'vitest';
import { Bone, Matrix4, Skeleton, Vector3 } from 'three';
import { FACTEURS_NEUTRES, poidsDuGabarit, poseDuGabarit, sensCuitsDuGabarit } from '../../../hotes/godot/asset/gabarit.ts';
import type { TableDeGabarit } from '../../../hotes/godot/asset/manifesteDeBase.ts';
import { enfantsDuGabarit, poserEnfantsDuGabarit } from '../../../hotes/godot/asset/evaluateur/gabarit.ts';
import { matricesDuGabarit, preparerGabarit, REFERENCE_DES_ANCRES, type PoidsDuSommet } from './gabarit.ts';
import { preparerLaplacien, resoudreLaplacien } from './laplacien.ts';

import { BORNES, jouet } from './gabarit.testkit.ts';

describe('H5 de construction, ancres fixes (#3104)', () => {
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
    const table: TableDeGabarit = { racine: 'root', legs: ['leg'], arms: [], head: [], st: { min: 0.72, max: 1.7 }, bornes: BORNES };
    const h5 = preparerGabarit({ positions, aretes: [[0, 1], [1, 2], [2, 0], [1, 3], [3, 2]],
      poids: [[[0, 1]], [[0, 0.5], [1, 0.5]], [[1, 1]], [[1, 1]]], squelette: new Skeleton(bones, inv), table });
    const ecart = Math.max(...h5.resoudre(FACTEURS_NEUTRES).map((p, i) => p.distanceTo(positions[i])));
    console.info('H5 bind décalé, écart avant skinning m', decale, ecart);
    expect(ecart).toBeLessThanOrEqual(1e-5);
  });
  it('tient les ancres et résout le gradient uniforme sur une chaîne connue', () => {
    const root = new Bone(), leg = new Bone(), child = new Bone();
    root.name = 'root'; leg.name = 'leg'; child.name = 'child';
    root.add(leg); leg.add(child); child.position.y = 1; root.updateMatrixWorld(true);
    const table: TableDeGabarit = { racine: 'root', legs: ['leg'], arms: [], head: [], st: { min: 0.8, max: 1.2 }, bornes: BORNES };
    const h5 = preparerGabarit({ squelette: new Skeleton([root, leg, child]), table,
      positions: [new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 2, 0)],
      aretes: [[0, 1], [1, 2]], poids: [[[1, 1]], [[1, 0.5], [2, 0.5]], [[2, 1]]],
    });
    expect(h5.ancres).toEqual([true, false, true]);
    expect(h5.resoudre({ ...FACTEURS_NEUTRES, legs: 2 }).map((p) => p.y)).toEqual([0, 1.75, 3]);
  });

  it('résout le laplacien multi-colonnes et refuse une composante sans appui', () => {
    const l = preparerLaplacien([true, false, false, true], [[0, 1], [1, 2], [2, 3]]);
    expect(resoudreLaplacien(l, [[0, 3], [3, 0]])[0][0]).toBeCloseTo(1, 12);
    expect(resoudreLaplacien(l, [[0, 3], [3, 0]])[1][0]).toBeCloseTo(2, 12);
    expect(resoudreLaplacien(l, [[0, 3], [3, 0]])[0][1]).toBeCloseTo(2, 12);
    expect(() => resoudreLaplacien(preparerLaplacien([false, false], [[0, 1]]), [[0], [1]])).toThrow(/sans appui/);
  });

  it('conserve le squelette et choisit les ancres avant les états mesurés', () => {
    const c = jouet(), avant = c.squelette.bones.map((b) => [b.position.toArray(), b.matrixWorld.toArray()]);
    const h5 = preparerGabarit(c), ancres = [...h5.ancres];
    console.info('H5 ancres fixes', ancres.filter(Boolean).length, '/', ancres.length);
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
    const pose = poseDuGabarit({ gabarit: c.table }, facteurs);
    const enfants = enfantsDuGabarit(pose, (nom) => c.squelette.bones.find((b) => b.name === nom)!);
    poserEnfantsDuGabarit(enfants);
    c.squelette.bones[0].updateMatrixWorld(true);
    const attendu = c.squelette.bones.map((b, i) => b.matrixWorld.clone()
      .multiply(new Matrix4().makeScale(...(pose.echellesDesOs[b.name] ?? [1, 1, 1])))
      .multiply(c.squelette.boneInverses[i]));
    const ecart = Math.max(...obtenu.flatMap((m, i) => m.elements.map((x, j) => Math.abs(x - attendu[i].elements[j]))));
    console.info('H5 bind propre par os max |K - M′ S B⁻¹|', ecart);
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
    console.info('H5 max |neutre - positions avant skinning| m', bind, ecartNeutre);
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
      console.info('H5 max |cles - direct| m', JSON.stringify(etat), max);
      expect(max, JSON.stringify(etat)).toBeLessThan(1e-5);
    }
  });
});
