import { describe, it, expect } from 'vitest';
import { applyCrewHit } from './shipCritical';
import { applyOps } from './ops';
import type { Combatant, ShipPoste } from './types';
import type { ShipCrewHit } from '../data/shipCriticals';
import { isUnarmed } from './items';

/** Marin minimal — assez pour `testValue('athletisme')` (Ag=36) + `applyOps` wounds (BE=3, PA=0). */
const sailor = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id, name: id, kind: 'npc', characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 31, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
  armour: { corps: 0 }, wounds: { current: 13, max: 13, base: 13 }, advantage: 0, ...over,
}) as unknown as Combatant;

/**
 * « Canon perdu » (MDG 13 l.765) : une pièce passe par-dessus bord. Mécanisé par l'op GÉNÉRIQUE
 * `removeShipPoste` (authoré en DONNÉE — `ops` du Critique dans `ship-criticals.json`), plus aucun flag/branche
 * en dur. Le `target` est la coque ; l'équipage vient de `ctx.crew` (pour démanciper le chef).
 */
describe('op removeShipPoste — Canon perdu (MDG 13 l.765)', () => {
  const setup = () => {
    const poste: ShipPoste = { item: { uid: 'p1', name: 'Pierrier' } as never, side: 'tribord', crewIds: ['chef'] };
    const hull = { id: 'hull', name: 'Cogue', postes: [poste] } as unknown as Combatant;
    const chef = { id: 'chef', name: 'Canonnier', mannedPoste: poste, weapons: [{ uid: 'p1', name: 'Pierrier', type: 'ranged' }] } as unknown as Combatant;
    return { hull, chef, poste };
  };
  const rng0 = { int: () => 0 }; // tire le poste d'index 0

  it('retire le poste de la coque ET démancipe son chef (mannedPoste + arme du poste)', () => {
    const { hull, chef } = setup();
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [chef], rng: rng0 });
    expect(hull.postes).toHaveLength(0); // passé par-dessus bord
    expect(chef.mannedPoste).toBeUndefined(); // il ne sert plus rien
    expect(chef.weapons.find((w) => w.uid === 'p1')).toBeUndefined(); // l'arme du poste disparaît du loadout
  });

  // `LDB 62 l.28` : le chef qui ne tenait que la pièce frappe aux Mains nues (`items.lacherLArme`).
  it('le chef qui ne tenait que la pièce tient les Mains nues', () => {
    const { hull, chef } = setup();
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [chef], rng: rng0 });
    expect(chef.weapons.map(isUnarmed)).toEqual([true]);
  });

  it('coque sans poste → inerte (aucun retrait fantôme)', () => {
    const hull = { id: 'hull', postes: [] } as unknown as Combatant;
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [], rng: rng0 });
    expect(hull.postes).toHaveLength(0);
  });

  it('ne touche au chef QUE s’il servait bien CE poste (pas de démancipation parasite)', () => {
    const { hull, chef } = setup();
    const autre: ShipPoste = { item: { uid: 'p2', name: 'Canon' } as never, side: 'babord', crewIds: ['chef'] };
    chef.mannedPoste = autre; // le chef sert un AUTRE poste
    applyOps(hull, [{ op: 'removeShipPoste' }], { crew: [chef], rng: rng0 }); // retire `poste` (p1)
    expect(chef.mannedPoste).toBe(autre); // intact : il ne servait pas le poste perdu
    expect(chef.weapons.find((w) => w.uid === 'p1')).toBeDefined();
  });
});

/** « Canon détaché » authoré en DONNÉE : le nœud `test` du Flow porte le jet ET, dans sa branche
 *  d'ÉCHEC, la conséquence en `GameOp` (branche `success` vide — seul l'échec est servi). */
const detachTest: ShipCrewHit = {
  crewTarget: { poste: true },
  test: {
    kind: 'test',
    test: { skill: { id: 'athletisme' }, difficulty: 'intermediaire' },
    success: { kind: 'seq', steps: [] },
    fail: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'wounds', amount: 12, ignoreTB: false, ignoreAP: false }], on: 'target' } },
  },
};

/** Coup à l'équipage SANS jet (MSRC 07 l.82 « les échardes infligent +5 Dégâts ») — la conséquence est
 *  CERTAINE, c'est le seul cas où `applyCrewHit` applique encore quelque chose. */
const echardes: ShipCrewHit = { crewTarget: { stations: ['avirons'] }, ops: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: false }] };

/**
 * « Canon détaché » (MDG 13 l.763-764) : `applyCrewHit` DÉSIGNE l'équipage du poste et REND le nœud
 * `test` de la rangée — il ne le ROULE plus (#1657 B3-2, la porte canonique décide de la surface).
 * Le canon RESTE à bord (≠ « Canon perdu »). Plus aucune valeur (12 / Athlétisme) en dur.
 */
describe('applyCrewHit — Canon détaché (data-driven, MDG 13 l.763-764)', () => {
  const hullWith = (crewIds: string[]) => {
    const poste: ShipPoste = { item: { uid: 'p1', name: 'Canon' } as never, side: 'tribord', crewIds };
    return { hull: { id: 'hull', postes: [poste] } as unknown as Combatant, poste };
  };
  // Le SEUL tirage restant est celui du poste (`int(0, n)`) : plus aucun d100 n'est consommé ici.
  const rngPoste = { int: () => 0 };

  it('l’équipage du poste est DÉSIGNÉ et le nœud RENDU — rien n’est appliqué, rien n’est jeté', () => {
    const { hull } = hullWith(['m1']);
    const m1 = sailor('m1');
    const out = applyCrewHit(hull, [m1], detachTest, rngPoste);
    expect(out.victims).toEqual(['m1']);
    expect(out.testFlow).toBe(detachTest.test); // le nœud AUTHORÉ part tel quel à la porte
    expect(out.hits).toEqual([]);               // aucune conséquence : l'issue n'est pas encore jouée
    expect(m1.wounds.current).toBe(13);
  });

  it('AUCUN dé n’est consommé pour l’issue : seul le tirage du POSTE part', () => {
    const { hull } = hullWith(['m1']);
    const tirages: [number, number][] = [];
    const rng = { int: (min: number, max: number) => { tirages.push([min, max]); return 0; } };
    applyCrewHit(hull, [sailor('m1')], detachTest, rng);
    expect(tirages, 'un d100 est encore tiré dans le moteur — le Test échapperait à la porte').toEqual([[0, 0]]);
  });

  it('coque sans poste → personne de visé (rien à détacher)', () => {
    const hull = { id: 'hull', postes: [] } as unknown as Combatant;
    expect(applyCrewHit(hull, [], detachTest, rngPoste).victims).toEqual([]);
  });

  it('servants déjà hors de combat (mort / 0 PB) ignorés', () => {
    const { hull } = hullWith(['mort', 'ko']);
    const mort = sailor('mort', { dead: true });
    const ko = sailor('ko', { wounds: { current: 0, max: 13, base: 13 } as never });
    expect(applyCrewHit(hull, [mort, ko], detachTest, rngPoste).victims).toEqual([]);
  });

  it('coup CERTAIN (`ops`, MSRC 07 l.82) : appliqué sur place au rameur ÉPINGLÉ, aucun nœud à ouvrir', () => {
    const m1 = sailor('m1', { shipStation: 'avirons' });
    const out = applyCrewHit({ id: 'hull' } as unknown as Combatant, [m1], echardes, rngPoste);
    expect(out.testFlow).toBeUndefined();
    expect(out.hits).toEqual([{ crewId: 'm1' }]);
    expect(m1.wounds.current).toBe(13 - (5 - 3)); // 5 − BE(3) − PA(0) = 2 PB perdus
  });
});
