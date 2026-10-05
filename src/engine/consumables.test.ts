import { describe, it, expect } from 'vitest';
import { Combatant, ItemInstance } from './types';
import { isConsumable, consumableUntilTime, bakeConsumableFlow, consumableOps } from './consumables';
import { type Flow } from './flowCore';
import { trappings, findTrappingById } from '../data';
import { itemFromTrappingById } from './items';
import { makeRNG } from './dice';
import { objetDeTest, type SurchargeDObjet } from './objetDeTest.testkit';

const user = (over: Partial<Combatant> = {}): Combatant =>
  ({
    name: 'X',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 5, max: 20, base: 20 }, conditions: [], activeEffects: [], ...over,
  }) as unknown as Combatant;

const doFlow = (ops: import('./ops').GameOp[]): Flow => ({ kind: 'do', effect: { type: 'ops', ops } });

const item = (over: SurchargeDObjet = {}): ItemInstance =>
  objetDeTest({ uid: 'i', trappingId: 'corde', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over });

describe('consommables — effet en FLOW (#50 : migration GameOp[] → Flow)', () => {
  it('isConsumable = Flow présent et non vide (un seq sans étape = rien à boire)', () => {
    expect(isConsumable(item({ consumable: doFlow([{ op: 'heal', amount: 1 }]) }))).toBe(true);
    expect(isConsumable(item({ consumable: { kind: 'test', test: { skill: { id: 'resistance' }}, success: { kind: 'seq', steps: [] }, fail: doFlow([]) } }))).toBe(true);
    expect(isConsumable(item())).toBe(false);
    expect(isConsumable(item({ consumable: { kind: 'seq', steps: [] } }))).toBe(false);
  });

  it('consumableUntilTime : « Durée : 2d10 minutes » résolue AU BOIRE depuis now (dés tirés une fois)', () => {
    const it2 = item({ consumableDuration: { minutes: { dice: { n: 2, sides: 10 } } } });
    const until = consumableUntilTime(it2, 1000, user(), makeRNG(7));
    expect(until).toBeGreaterThanOrEqual(1002);
    expect(until).toBeLessThanOrEqual(1020);
  });
  it('consumableUntilTime : « 1d10 × 10 minutes » (Formula `times`, LDB 71 l.33) → multiples de 10 min', () => {
    const it2 = item({ consumableDuration: { minutes: { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } } } });
    const until = consumableUntilTime(it2, 0, user(), makeRNG(3))!;
    expect(until % 10).toBe(0);
    expect(until).toBeGreaterThanOrEqual(10);
    expect(until).toBeLessThanOrEqual(100);
  });
  it('consumableUntilTime : heures/jours convertis en minutes ; sans durée → undefined', () => {
    expect(consumableUntilTime(item({ consumableDuration: { hours: 3 } }), 100, user())).toBe(100 + 180);
    expect(consumableUntilTime(item({ consumableDuration: { days: 1 } }), 0, user())).toBe(24 * 60);
    expect(consumableUntilTime(item(), 0, user())).toBeUndefined();
  });

  it('bakeConsumableFlow : chaque feuille (branches de test comprises) est ciblée sur le buveur et porte untilTime/label', () => {
    const flow: Flow = {
      kind: 'test',
      test: { skill: { id: 'resistance' } },
      success: doFlow([{ op: 'heal', amount: 1 }]),
      fail: { kind: 'if', cond: { kind: 'always' }, then: doFlow([{ op: 'condition', id: 'sonne' }]) },
    };
    const baked = bakeConsumableFlow(flow, 'h1', 4242, 'Belladone');
    const leaves: import('./flowCore').EffectOp[] = [];
    (function walk(f: Flow) {
      if (f.kind === 'do') leaves.push(f.effect);
      else if (f.kind === 'seq') f.steps.forEach(walk);
      else if (f.kind === 'if') { walk(f.then); if (f.else) walk(f.else); }
      else if (f.kind === 'test') { walk(f.success); walk(f.fail); }
    })(baked);
    expect(leaves).toHaveLength(2);
    for (const e of leaves) {
      expect(e.on).toBe('hero');
      expect(e.heroId).toBe('h1');
      expect(e.untilTime).toBe(4242);
      expect(e.label).toBe('Belladone');
    }
    // PUR : la donnée d'origine n'est pas mutée.
    expect((flow as Extract<Flow, { kind: 'test' }>).success.kind === 'do' && (flow as never as { success: { effect: { untilTime?: number } } }).success.effect.untilTime).toBeFalsy();
  });
});

describe('consommables — catalogue migré (LDB 71/72/67 + MSRC, donnée réelle)', () => {
  it('potion-de-guerison : gate « plus de 0 Blessure » (if woundsCurrent ≥ 1) → heal {bonusOf:E} (LDB 72 l.24)', () => {
    const f = findTrappingById('potion-de-guerison')!.consumable!;
    expect(f.kind).toBe('if');
    const g = f as Extract<Flow, { kind: 'if' }>;
    expect(g.cond).toEqual({ kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 });
    expect(consumableOps(f)).toEqual([{ op: 'heal', amount: { bonusOf: 'endurance' } }]);
    expect(isConsumable(itemFromTrappingById('potion-de-guerison')!)).toBe(true);
  });
  it('necessaire-antipoison : « Un Test de Guérison réussi … retire tous les États Empoisonné » (LDB 67 l.13)', () => {
    const f = findTrappingById('necessaire-antipoison')!.consumable! as Extract<Flow, { kind: 'test' }>;
    expect(f.kind).toBe('test');
    expect(f.test.skill).toEqual({ id: 'guerison' });
    expect(consumableOps(f.success)).toEqual([{ op: 'removeCondition', id: 'empoisonne', all: true }]);
    expect(consumableOps(f.fail)).toEqual([]);
  });
  it('brise-coeur : « Combattu avec un Test de Résistance Complexe (-10) » → échec : 4 Empoisonné (LDB 71 l.22, patron Lotus)', () => {
    const f = findTrappingById('brise-coeur')!.consumable! as Extract<Flow, { kind: 'test' }>;
    expect(f.kind).toBe('test');
    expect(f.test.skill).toEqual({ id: 'resistance' });
    expect(f.test.difficulty).toBe('complexe');
    expect(f.test.unlessImmune).toBe('poison');
    expect(consumableOps(f.fail)).toEqual([{ op: 'condition', id: 'empoisonne', value: 4 }]);
  });
  it('faxtoryll : « retirent tous les États Hémorragique sans Test de Guérison » — SANS preventInfection (hors-RAW retiré, LDB 72 l.22)', () => {
    expect(consumableOps(findTrappingById('faxtoryll')!.consumable)).toEqual([
      { op: 'removeCondition', id: 'hemorragique', all: true },
    ]);
  });
  it('les consommables de la base portent un Flow (11 migrés + 9 drogues/herbes LDB 71-72 + rouille MSRC + sel sacré MDG + boissons alcoolisées LDB 09 + malepierre LDB 19, #462 ; + 14 potions VDM 12, #732)', () => {
    const ids = trappings.filter((t) => t.consumable).map((t) => t.id).sort();
    expect(ids).toEqual([
      'bandages',
      'bave',
      'belladone',
      'biere-pinte',
      'bonnet-de-fou',
      'brise-coeur',
      'cataplasme-de-guerison',
      'concentre-de-pouvoir',
      'delice-de-ranald',
      'faxtoryll',
      'fleur-de-lune',
      'gesundheit',
      'l-ami-debauche',
      'lotion-capillaire',
      'lotus-noir',
      'malepierre-brute',
      'malepierre-raffinee',
      'musc-de-sanglier',
      'mystracine',
      'necessaire-antipoison',
      'nectar-de-beaute',
      'nectar-de-veracite',
      'nectar-de-vitalite',
      'panacea-universalis',
      'potion-d-invisibilite',
      'potion-de-divination',
      'potion-de-focalisation',
      'potion-de-guerison',
      'potion-de-puissance',
      'potion-de-vitalite',
      'potion-de-vol',
      'racine-de-mandragore',
      'racine-de-terre',
      'racine-des-tombes',
      'rouille-mouchetee',
      'sel-sacre',
      'soude-commune',
      'tonifiant-de-lucidite',
      'tonique-digestif',
      'vin-spiritueux-verre',
    ]);
  });
  it('malepierre-brute : « Être en contact avec un Démon, une malepierre ou un artefact profané » (LDB 19 l.51) → corruptionExposure moderee/Résistance', () => {
    expect(consumableOps(findTrappingById('malepierre-brute')!.consumable)).toEqual([
      { op: 'corruptionExposure', level: 'moderee', skill: { id: 'resistance' } },
    ]);
  });
  it('malepierre-raffinee : « Utiliser une malepierre raffinée » (LDB 19 l.63) → corruptionExposure majeure/Résistance', () => {
    expect(consumableOps(findTrappingById('malepierre-raffinee')!.consumable)).toEqual([
      { op: 'corruptionExposure', level: 'majeure', skill: { id: 'resistance' } },
    ]);
  });
});
