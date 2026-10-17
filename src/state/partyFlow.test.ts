import { afterEach, describe, it, expect } from 'vitest';
import { choisirForme, transferItem, toggleEquip, stowItem, setLoadoutSlot } from './partyFlow';
import { itemFromTrappingById, recomputeLoadout, totalEncumbrance, avecObjet, activeLoadout, formeResolue } from '../engine/items';
import type { Combatant, ItemInstance } from '../engine/types';
import { setDataset } from '../data/overrides';
import { trappings } from '../data';
import type { Possession } from '../engine/possession';
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';

/** Harnais MINIMAL (get/set) sur un état réduit à `party`+`possessions` — `resolveCarrier` (#620) lit
 *  les deux ; `choisirForme` (loadout, héros seul) ne lit/écrit que `party` (via mutLoadout). Le `set`
 *  fonctionnel de Zustand est miroité (merge du partiel renvoyé). */
function makeHarness(party: Combatant[], possessions: Possession[] = []): { get: Get; set: Set } {
  let state = { party, possessions, log: () => {} } as unknown as GameState;
  const get: Get = () => state;
  const set: Set = (p) => { state = { ...state, ...(typeof p === 'function' ? p(state) : p) }; };
  return { get, set };
}

/** Possession minimale porteuse d'items (`nature: 'bete'`, mule de bât) — #620 Lot 1a. */
function makeMulePossession(items: ItemInstance[]): Possession {
  return {
    uid: 'pos-1', ownerId: 'h1', label: 'Grisette', nature: 'bete', ref: { creatureId: 'mule' },
    location: { kind: 'avec-le-groupe' }, items,
  } as unknown as Possession;
}

/** Héros porteur d'une « Arme simple » ÉQUIPÉE (shape par défaut `epee`), loadout dérivé par recompute. */
function heroWithArmeSimple(): Combatant {
  const it = itemFromTrappingById('arme-simple')!;
  it.equipped = true;
  const hero = {
    id: 'h1', name: 'Test', kind: 'hero', characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: [it], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
  recomputeLoadout(hero);
  return hero;
}

const activeWeapon = (h: Combatant, uid: string) => (h.weapons ?? []).find((w) => w.uid === uid);

describe('choisirForme — sélecteur de forme d’une arme abstraite', () => {
  const catalogueDOrigine = trappings.slice();
  afterEach(() => setDataset('trappings', catalogueDOrigine));
  const editerArmeSimple = (patch: object) =>
    setDataset('trappings', trappings.map((t) => (t.id === 'arme-simple' ? { ...t, ...patch } : t)));

  it('une « Arme simple » créée via itemFromTrappingById ne porte aucun choix : sa forme résolue est celle du catalogue', () => {
    const it = itemFromTrappingById('arme-simple')!;
    expect(it.formeChoisie).toBeUndefined();
    expect(formeResolue(it)).toBe('epee');
  });

  it('pose item.formeChoisie sur une forme valide (∈ formChoices)', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    const { get, set } = makeHarness([hero]);
    choisirForme(get, set, hero.id, uid, 'hache');
    const after = get().party[0];
    expect((after.items ?? []).find((i: ItemInstance) => i.uid === uid)?.formeChoisie).toBe('hache');
  });

  it('ignore une forme HORS formChoices (aucun choix posé)', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    const { get, set } = makeHarness([hero]);
    choisirForme(get, set, hero.id, uid, 'zweihander'); // arme réelle mais hors des 5 formes de l’Arme simple
    const after = get().party[0];
    expect((after.items ?? []).find((i: ItemInstance) => i.uid === uid)?.formeChoisie).toBeUndefined();
  });

  it('l’arme ACTIVE (tenue) porte le choix après recompute, et sa forme résolue le suit (silhouette en jeu)', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    expect(formeResolue(activeWeapon(hero, uid)!)).toBe('epee'); // état initial : épée
    const { get, set } = makeHarness([hero]);
    choisirForme(get, set, hero.id, uid, 'masse');
    const after = get().party[0];
    expect(activeWeapon(after, uid)?.formeChoisie).toBe('masse');
    expect(formeResolue(activeWeapon(after, uid)!)).toBe('masse');
  });

  it('#2113 — une édition du catalogue ne l’écrase pas : le choix prime sur la forme du catalogue', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    const { get, set } = makeHarness([hero]);
    choisirForme(get, set, hero.id, uid, 'masse');
    editerArmeSimple({ shape: 'hache' });
    const arme = activeWeapon(get().party[0], uid)!;
    expect(formeResolue({ trappingId: 'arme-simple' }), 'la sonde mord : le catalogue a changé de forme').toBe('hache');
    expect(formeResolue(arme)).toBe('masse');
  });

  it('#2113 — un choix sorti des `formChoices` du catalogue est ignoré : le catalogue l’emporte', () => {
    const hero = heroWithArmeSimple();
    const uid = hero.items![0].uid;
    const { get, set } = makeHarness([hero]);
    choisirForme(get, set, hero.id, uid, 'masse');
    editerArmeSimple({ formChoices: ['epee', 'hache'] });
    expect(formeResolue(activeWeapon(get().party[0], uid)!)).toBe('epee');
  });
});

/** Deux héros minimaux pour transferItem : `from` porteur des items donnés, `to` sans rien. */
function twoHeroes(fromItems: ItemInstance[]): { from: Combatant; to: Combatant } {
  const from = {
    id: 'h1', label: 'Aldric', name: 'Aldric', kind: 'hero',
    characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: fromItems, talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
  const to = {
    id: 'h2', label: 'Brenna', name: 'Brenna', kind: 'hero',
    characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
  recomputeLoadout(from);
  recomputeLoadout(to);
  return { from, to };
}

describe('transferItem — contenants et objets rangés (#612)', () => {
  it('transférer un sac (contenant) déplace aussi son contenu, sans orphelin ni PA fantôme', () => {
    const sac: ItemInstance = { uid: 'sac', label: 'Sac à dos', kind: 'misc', qualities: [], enc: 1, equipped: false, container: { capacity: 10 } } as unknown as ItemInstance;
    const rations: ItemInstance = { uid: 'rations', label: 'Rations', kind: 'misc', qualities: [], enc: 2, equipped: false, inside: 'sac' } as unknown as ItemInstance;
    const corde: ItemInstance = { uid: 'corde', label: 'Corde', kind: 'misc', qualities: [], enc: 1, equipped: false, inside: 'sac' } as unknown as ItemInstance;
    const { from, to } = twoHeroes([sac, rations, corde]);
    const { get, set } = makeHarness([from, to]);

    transferItem(get, set, 'sac', 'h1', 'h2');

    const after = get().party;
    const afterFrom = after.find((h) => h.id === 'h1')!;
    const afterTo = after.find((h) => h.id === 'h2')!;

    expect(afterFrom.items ?? []).toHaveLength(0); // le sac ET son contenu ont quitté le donneur
    const toItems = afterTo.items ?? [];
    expect(toItems.map((i) => i.uid).sort()).toEqual(['corde', 'rations', 'sac']);
    expect(toItems.find((i) => i.uid === 'rations')?.inside).toBe('sac'); // lien préservé chez le receveur
    expect(toItems.find((i) => i.uid === 'corde')?.inside).toBe('sac');

    expect(totalEncumbrance(afterFrom)).toBe(0);
    expect(totalEncumbrance(afterTo)).toBe(1); // seul le sac compte (contenu absorbé, LDB 64)
  });

  it('transférer un objet RANGÉ dans un sac du donneur : il arrive LIBRE chez le receveur', () => {
    const sac: ItemInstance = { uid: 'sac', label: 'Sac à dos', kind: 'misc', qualities: [], enc: 1, equipped: false, container: { capacity: 10 } } as unknown as ItemInstance;
    const rations: ItemInstance = { uid: 'rations', label: 'Rations', kind: 'misc', qualities: [], enc: 2, equipped: false, inside: 'sac' } as unknown as ItemInstance;
    const { from, to } = twoHeroes([sac, rations]);
    const { get, set } = makeHarness([from, to]);

    transferItem(get, set, 'rations', 'h1', 'h2');

    const after = get().party;
    const afterFrom = after.find((h) => h.id === 'h1')!;
    const afterTo = after.find((h) => h.id === 'h2')!;

    expect((afterFrom.items ?? []).map((i) => i.uid)).toEqual(['sac']); // le sac reste, plus vide
    const received = (afterTo.items ?? []).find((i) => i.uid === 'rations');
    expect(received).toBeDefined();
    expect(received!.inside).toBeUndefined(); // aucun `inside` fantôme (le sac du donneur n'existe pas chez le receveur)
    expect(totalEncumbrance(afterTo)).toBe(2); // compté (libre), pas absorbé par un contenant absent
  });
});

describe('généralisation porteur (#620 SOCLE POSSESSIONS T1-e) — héros OU possession', () => {
  it('toggleEquip(carrierId=hero.id) : comportement héros INCHANGÉ (arme équipée + recomputeLoadout)', () => {
    // Héros SANS loadout encore posé (`ensureDefaultLoadout` ne dérive qu'AU 1er recompute, LDB) : l'item
    // part non-équipé, aucun `weapons` actif tant que toggleEquip n'a pas tourné.
    const it = itemFromTrappingById('arme-simple')!;
    it.equipped = false;
    const hero = {
      id: 'h1', name: 'Test', kind: 'hero', characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
      items: [it], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
    } as unknown as Combatant;
    const uid = it.uid;
    const { get, set } = makeHarness([hero]);

    toggleEquip(get, set, hero.id, uid);

    const after = get().party[0];
    expect((after.items ?? []).find((i) => i.uid === uid)?.equipped).toBe(true);
    expect(activeWeapon(after, uid)).toBeDefined(); // recomputeLoadout a bien tourné (héros)
  });

  it('toggleEquip(carrierId=possession.uid) : bascule equipped sur la possession, SANS recomputeLoadout', () => {
    const it: ItemInstance = { uid: 'selle', label: 'Selle', kind: 'misc', qualities: [], enc: 2, equipped: false } as unknown as ItemInstance;
    const mule = makeMulePossession([it]);
    const { get, set } = makeHarness([], [mule]);

    toggleEquip(get, set, mule.uid, 'selle');

    const after = get().possessions[0];
    expect(after.items.find((i) => i.uid === 'selle')?.equipped).toBe(true);
    expect((after as unknown as Combatant).weapons).toBeUndefined(); // aucun loadout dérivé sur une possession
  });

  it('transferItem héros→possession : déplace l’item, met à jour les deux porteurs (recompute héros seulement)', () => {
    const it: ItemInstance = { uid: 'lanterne', label: 'Lanterne', kind: 'misc', qualities: [], enc: 1, equipped: false } as unknown as ItemInstance;
    const hero = { ...twoHeroes([it]).from };
    const mule = makeMulePossession([]);
    const { get, set } = makeHarness([hero], [mule]);

    transferItem(get, set, 'lanterne', hero.id, mule.uid);

    const afterHero = get().party.find((h) => h.id === hero.id)!;
    const afterMule = get().possessions.find((p) => p.uid === mule.uid)!;
    expect(afterHero.items ?? []).toHaveLength(0);
    expect(afterMule.items.map((i) => i.uid)).toEqual(['lanterne']);
  });

  it('stowItem sur une possession : range dans un contenant DE LA POSSESSION', () => {
    const sac: ItemInstance = { uid: 'bat', label: 'Bât', kind: 'misc', qualities: [], enc: 1, equipped: false, container: { capacity: 10 } } as unknown as ItemInstance;
    const rations: ItemInstance = { uid: 'rations', label: 'Rations', kind: 'misc', qualities: [], enc: 2, equipped: false } as unknown as ItemInstance;
    const mule = makeMulePossession([sac, rations]);
    const { get, set } = makeHarness([], [mule]);

    stowItem(get, set, mule.uid, 'rations', 'bat');

    const after = get().possessions[0];
    expect(after.items.find((i) => i.uid === 'rations')?.inside).toBe('bat');
  });
});

describe('transferItem — invariant de CO-LOCALISATION (#723, garde store, source de vérité)', () => {
  it('héros→possession « avec-le-groupe » : co-localisés, l’objet arrive', () => {
    const it: ItemInstance = { uid: 'lanterne', label: 'Lanterne', kind: 'misc', qualities: [], enc: 1, equipped: false } as unknown as ItemInstance;
    const hero = { ...twoHeroes([it]).from };
    const mule = makeMulePossession([]); // location par défaut : avec-le-groupe
    const { get, set } = makeHarness([hero], [mule]);

    transferItem(get, set, 'lanterne', hero.id, mule.uid);

    expect(get().party.find((h) => h.id === hero.id)!.items ?? []).toHaveLength(0);
    expect(get().possessions.find((p) => p.uid === mule.uid)!.items.map((i) => i.uid)).toEqual(['lanterne']);
  });

  it('héros→possession « au-lieu » (à l’écurie ailleurs) : NON co-localisés, NO-OP', () => {
    const it: ItemInstance = { uid: 'lanterne', label: 'Lanterne', kind: 'misc', qualities: [], enc: 1, equipped: false } as unknown as ItemInstance;
    const hero = { ...twoHeroes([it]).from };
    const mule = { ...makeMulePossession([]), location: { kind: 'au-lieu', placeId: 'altdorf' } } as Possession;
    const { get, set } = makeHarness([hero], [mule]);

    transferItem(get, set, 'lanterne', hero.id, mule.uid);

    expect(get().party.find((h) => h.id === hero.id)!.items ?? []).toHaveLength(1); // reste chez le héros
    expect(get().possessions.find((p) => p.uid === mule.uid)!.items).toHaveLength(0);
  });

  it('héros→possession « embarquée » (sur un navire) : NON co-localisés, NO-OP', () => {
    const it: ItemInstance = { uid: 'lanterne', label: 'Lanterne', kind: 'misc', qualities: [], enc: 1, equipped: false } as unknown as ItemInstance;
    const hero = { ...twoHeroes([it]).from };
    const mule = { ...makeMulePossession([]), location: { kind: 'embarquee', hostUid: 'pos-navire' } } as Possession;
    const { get, set } = makeHarness([hero], [mule]);

    transferItem(get, set, 'lanterne', hero.id, mule.uid);

    expect(get().party.find((h) => h.id === hero.id)!.items ?? []).toHaveLength(1);
    expect(get().possessions.find((p) => p.uid === mule.uid)!.items).toHaveLength(0);
  });
});

// Un objet rangé (`inside`) n'est pas en main : `recomputeLoadout` vide son slot, et le repli `LDB 62 l.28` s'applique.
describe('stowItem — ranger l’arme TENUE dans un sac', () => {
  it('l’épée rangée n’est plus en main, et les Mains nues la remplacent', () => {
    const hero = heroWithArmeSimple();
    const epee = hero.items![0];
    const sac = { ...itemFromTrappingById('sac')!, uid: 'sac-1', equipped: true };
    hero.items!.push(sac);
    recomputeLoadout(hero);
    expect(activeWeapon(hero, epee.uid)).toBeDefined();
    const { get, set } = makeHarness([hero]);
    stowItem(get, set, 'h1', epee.uid, 'sac-1');
    const apres = get().party[0];
    expect(apres.items!.find((i) => i.uid === epee.uid)?.inside, 'l’épée est rangée').toBe('sac-1');
    expect(activeWeapon(apres, epee.uid), 'elle n’est plus en main').toBeUndefined();
    expect(apres.weapons.map((w) => w.label)).toEqual(['Mains nues']);
  });
});

// Un objet mis en main sort de son contenant : l'arme achetée (rangée d'office, `autoStowNewItem`) se choisit au set.
describe('setLoadoutSlot — une arme ACHETÉE, rangée dans un sac, choisie au set', () => {
  it('elle est en main, et n’est plus dans le sac', () => {
    const base = { id: 'h1', label: 'Test', kind: 'hero', characteristics: { force: 30, endurance: 30 }, items: [{ ...itemFromTrappingById('sac')!, uid: 'sac-1', equipped: true }], weapons: [], talents: [], skills: [], traits: [], activeEffects: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 } } as unknown as Combatant;
    recomputeLoadout(base);
    const hero = avecObjet(base, itemFromTrappingById('arme-simple')!);
    const achat = hero.items!.find((i) => i.kind === 'melee')!;
    expect(achat.inside, 'rangée d’office à l’achat').toBe('sac-1');
    const { get, set } = makeHarness([hero]);
    setLoadoutSlot(get, set, 'h1', activeLoadout(hero)!.id, 'main', achat.uid);
    const apres = get().party[0];
    expect(activeWeapon(apres, achat.uid), 'en main').toBeDefined();
    expect(apres.items!.find((i) => i.uid === achat.uid)?.inside, 'hors du sac').toBeUndefined();
  });
});
