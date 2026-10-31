import { describe, expect, it } from 'vitest';
import { Bone, Euler, Skeleton, Vector3 } from 'three';
import { FACTEURS_NEUTRES, poidsDuGabarit, type BornesDuGabarit } from '../gabarit.ts';
import { CLES_DU_GABARIT, type TableDeGabarit } from '../manifesteDeBase.ts';
import { matricesDuGabarit, preparerGabarit, REFERENCE_DES_ANCRES, type PoidsDuSommet } from './gabarit.ts';
import { preparerLaplacien, resoudreLaplacien, type Arete } from './laplacien.ts';

const BORNES: BornesDuGabarit = { legs: { min: 0.4836, max: 1.456 }, arms: { min: 1, max: 1.6 }, head: { min: 1, max: 1.9 } };

function jouet() {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rnd = (a: number) => (rand() * 2 - 1) * a;
  const mk = (name: string, parent?: Bone) => {
    const b = new Bone(); b.name = name;
    b.position.set(rnd(0.2), 0.1 + rand() * 0.4, rnd(0.2));
    b.quaternion.setFromEuler(new Euler(rnd(1.5), rnd(1.5), rnd(1.5)));
    parent?.add(b); return b;
  };
  const root = mk('root'), pelvis = mk('pelvis', root), thigh = mk('thigh', pelvis), calf = mk('calf', thigh), foot = mk('foot', calf);
  const spine = mk('spine', pelvis), up = mk('upperarm', spine), low = mk('lowerarm', up), hand = mk('hand', low);
  const neck = mk('neck', spine), head = mk('Head', neck);
  const bones = [root, pelvis, thigh, calf, foot, spine, up, low, hand, neck, head];
  root.updateMatrixWorld(true);
  const squelette = new Skeleton(bones);
  const positions: Vector3[] = [], poids: PoidsDuSommet[] = [];
  for (let i = 0; i < 90; i++) {
    const bi = 1 + Math.floor(rand() * (bones.length - 1)), b = bones[bi], pi = bones.indexOf(b.parent as Bone);
    positions.push(b.getWorldPosition(new Vector3()).add(new Vector3(rnd(0.05), rnd(0.05), rnd(0.05))));
    const w = i % 3 === 0 ? 1 : 0.3 + 0.6 * rand();
    poids.push(w === 1 ? [[bi, 1]] : [[bi, w], [pi, 1 - w]]);
  }
  const edges = new Set<string>();
  for (let i = 1; i < positions.length; i++) edges.add(`${i - 1},${i}`);
  for (let t = 0; t < 180; t++) { const a = Math.floor(rand() * 90), b = Math.floor(rand() * 90); if (a !== b) edges.add(`${Math.min(a, b)},${Math.max(a, b)}`); }
  const aretes = [...edges].map((s) => s.split(',').map(Number) as unknown as Arete);
  const silhouettes = ['feminin', 'carrure_moins', 'carrure_plus', 'corpulence'].map((nom) => ({ nom, deltas: positions.map(() => new Vector3(rnd(0.03), rnd(0.03), rnd(0.03))) }));
  const table: TableDeGabarit = { racine: 'root', legs: ['thigh', 'calf'], arms: ['upperarm', 'lowerarm'], head: ['Head'], st: { min: 0.8, max: 1.2 }, bornes: BORNES };
  return { positions, aretes, poids, squelette, table, silhouettes };
}

describe('H5 de construction, ancres fixes (#3104)', () => {
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
    h5.resoudre({ ...FACTEURS_NEUTRES, legs: 0.62, arms: 1.6, head: 1.9 });
    h5.resoudre(FACTEURS_NEUTRES);
    expect(h5.ancres).toEqual(ancres);
    expect(c.squelette.bones.map((b) => [b.position.toArray(), b.matrixWorld.toArray()])).toEqual(avant);
    const k = matricesDuGabarit(c.squelette, c.table, FACTEURS_NEUTRES);
    for (const m of k) m.elements.forEach((v, i) => expect(v).toBeCloseTo(i % 5 === 0 ? 1 : 0, 12));
  });

  it('additionne les clés cuites et croisées comme H5 direct sur le repos silhouetté, à 1e-5 m', () => {
    const c = jouet(), h5 = preparerGabarit(c);
    const cles = CLES_DU_GABARIT.flatMap((cle) => (['moins', 'plus'] as const).flatMap((sens) => [
      h5.cuire(cle, sens, BORNES), ...c.silhouettes.map((s) => h5.cuire(cle, sens, BORNES, s)),
    ]));
    expect(cles).toHaveLength(30);
    const poidsSilhouettes = Object.fromEntries(c.silhouettes.map((s, i) => [s.nom, [0.4, 0.8, 1, 0.55][i]]));
    const repos = c.positions.map((p, i) => c.silhouettes.reduce((v, s) => v.addScaledVector(s.deltas[i], poidsSilhouettes[s.nom]), p.clone()));
    const etats = [
      { legs: 0.62, arms: 1.6, head: 1.9 }, { legs: 1.3, arms: 1.4, head: 1.2 },
      { legs: 0.4836, arms: 1, head: 1 }, { legs: 1.456, arms: 1.6, head: 1.9 },
      { legs: 0.66, arms: 1.3, head: 1.9 }, { legs: 0.7, arms: 1.6, head: 1.4 },
    ];
    for (const etat of etats) {
      const facteurs = { ...FACTEURS_NEUTRES, ...etat };
      const poids = poidsDuGabarit(facteurs, BORNES, poidsSilhouettes);
      const additionnes = repos.map((p, i) => cles.reduce((v, c) => v.addScaledVector(c.deltas[i], poids[c.nom]), p.clone()));
      const direct = h5.resoudre(facteurs, repos);
      const max = Math.max(...additionnes.map((p, i) => p.distanceTo(direct[i])));
      console.info('H5 max |cles - direct| m', JSON.stringify(etat), max);
      expect(max, JSON.stringify(etat)).toBeLessThan(1e-5);
    }
  });
});
