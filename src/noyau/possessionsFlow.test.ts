import { describe, it, expect } from 'vitest';
import {
  addPossession,
  renamePossession,
  transferPossession,
  stablePossession,
  retrievePossession,
  embark,
  disembark,
  abandonPossession,
  learnPossessionTrait,
  possessionsByOwner,
  possessionsByLocation,
} from './possessionsFlow';
import { partyRemoveHero } from './partyFlow';
import { creditBourse } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import type { Possession } from '../engine/possession';
import type { Combatant } from '../engine/types';
import type { GameState } from '../state/store';
import type { Get, Set } from './flowTypes';

/** Harnais MINIMAL (get/set) — même patron que `bourseFlow.test.ts`/`partyFlow.test.ts`. */
function makeHarness(party: Combatant[], possessions: Possession[] = []): { get: Get; set: Set } {
  let state = {
    party,
    possessions,
    flags: {},
    gameTime: 0,
    log: () => {},
    net: { ownership: {} as Record<string, number> },
  } as unknown as GameState;
  const get: Get = () => state;
  const set: Set = (p) => {
    state = { ...state, ...(typeof p === 'function' ? p(state) : p) };
  };
  return { get, set };
}

type NavirePossession = Extract<Possession, { nature: 'navire' }>;

const barge = (ownerId: string): Omit<NavirePossession, 'uid'> => ({
  nature: 'navire',
  ownerId,
  location: { kind: 'avec-le-groupe' },
  items: [],
  vehicleId: 'barge',
  naval: { morale: { score: 0, lastMoraleWeek: 0, factors: [] } },
});

type VehiculePossession = Extract<Possession, { nature: 'vehicule' }>;

const vehicule = (
  ownerId: string,
  vehicleId: string,
  cargo?: VehiculePossession['cargo'],
): Omit<VehiculePossession, 'uid'> => ({
  nature: 'vehicule',
  ownerId,
  location: { kind: 'avec-le-groupe' },
  items: [],
  vehicleId,
  cargo,
});

function makeHero(id: string): Combatant {
  return {
    id, label: id, kind: 'hero',
    characteristics: { force: 30, endurance: 30 } as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
  } as unknown as Combatant;
}

type BetePossession = Extract<Possession, { nature: 'bete' }>;

const mule = (ownerId: string): Omit<BetePossession, 'uid'> => ({
  nature: 'bete',
  ownerId,
  location: { kind: 'avec-le-groupe' },
  items: [],
  ref: { creatureId: 'mule' },
});

describe('possessionsFlow — registre (#615 SOCLE POSSESSIONS T1-c1)', () => {
  it('addPossession attribue pos-1 puis pos-2 par scan du registre', () => {
    const { get, set } = makeHarness([]);
    const uid1 = addPossession(get, set, mule('h1'));
    const uid2 = addPossession(get, set, mule('h1'));
    expect(uid1).toBe('pos-1');
    expect(uid2).toBe('pos-2');
    expect(get().possessions).toHaveLength(2);
  });

  it('anti-collision par SCAN : pos-1 encore présent → un 3e ajout prend pos-3, jamais pos-1', () => {
    const { get, set } = makeHarness([]);
    addPossession(get, set, mule('h1')); // pos-1
    addPossession(get, set, mule('h1')); // pos-2
    const uid3 = addPossession(get, set, mule('h1'));
    expect(uid3).toBe('pos-3');
  });

  it('anti-collision par SCAN : pos-1 retiré du registre → le prochain ajout reste au-delà du max restant', () => {
    const { get, set } = makeHarness([]);
    addPossession(get, set, mule('h1')); // pos-1
    addPossession(get, set, mule('h1')); // pos-2
    // pos-1 retiré directement (simule une consommation externe du registre)
    set((s) => ({ possessions: s.possessions.filter((p) => p.uid !== 'pos-1') }));
    const uid3 = addPossession(get, set, mule('h1'));
    expect(uid3).toBe('pos-3'); // scanne le MAX (pos-2), pas un compteur qui réutiliserait pos-1
  });

  it('renamePossession pose le label d’instance', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    renamePossession(get, set, uid, 'Marguerite');
    expect(get().possessions.find((p) => p.uid === uid)?.label).toBe('Marguerite');
  });

  it('transferPossession réaffecte ownerId', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    transferPossession(get, set, uid, 'h2');
    expect(get().possessions.find((p) => p.uid === uid)?.ownerId).toBe('h2');
  });

  it('stablePossession → au-lieu, retrievePossession → avec-le-groupe', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    stablePossession(get, set, uid, 'lieu-1');
    expect(get().possessions.find((p) => p.uid === uid)?.location).toEqual({ kind: 'au-lieu', placeId: 'lieu-1' });
    retrievePossession(get, set, uid);
    expect(get().possessions.find((p) => p.uid === uid)?.location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('embark → embarquee sur hostUid, disembark → avec-le-groupe', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    const hostUid = addPossession(get, set, barge('h1'));
    embark(get, set, uid, hostUid);
    expect(get().possessions.find((p) => p.uid === uid)?.location).toEqual({ kind: 'embarquee', hostUid });
    disembark(get, set, uid);
    expect(get().possessions.find((p) => p.uid === uid)?.location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('embark refuse un hôte introuvable — no-op (registre incohérent)', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    embark(get, set, uid, 'pos-inexistant');
    expect(get().possessions.find((p) => p.uid === uid)?.location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('embark refuse navire sur navire — nature incompatible (§5)', () => {
    const { get, set } = makeHarness([]);
    const uidA = addPossession(get, set, barge('h1'));
    const uidB = addPossession(get, set, barge('h1'));
    embark(get, set, uidA, uidB);
    expect(get().possessions.find((p) => p.uid === uidA)?.location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('embark refuse si la capacité libre de l’hôte est dépassée', () => {
    const { get, set } = makeHarness([]);
    // barge → capacité 300 Enc (MDG 12) ; une charrette (véhicule) pèse 10 (own) + son cargo.
    const hostUid = addPossession(get, set, barge('h1'));
    const idA = addPossession(get, set, vehicule('h1', 'charrette', [{ cargoId: 'grain', enc: 280, basePriceGold: 1 }]));
    embark(get, set, idA, hostUid);
    expect(get().possessions.find((p) => p.uid === idA)?.location).toEqual({ kind: 'embarquee', hostUid });
    const idB = addPossession(get, set, vehicule('h1', 'chariot-leger'));
    embark(get, set, idB, hostUid); // 290 (charrette 10+280) déjà + 30 (chariot-leger) > 300
    expect(get().possessions.find((p) => p.uid === idB)?.location).toEqual({ kind: 'avec-le-groupe' });
  });

  it('abandonPossession pose destroyed=true (la confirmation reste côté appelant)', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    abandonPossession(get, set, uid);
    expect(get().possessions.find((p) => p.uid === uid)?.destroyed).toBe(true);
  });

  it('learnPossessionTrait ajoute un trait appris (nature bete), idempotent', () => {
    const { get, set } = makeHarness([]);
    const uid = addPossession(get, set, mule('h1'));
    learnPossessionTrait(get, set, uid, 'dresse-monter');
    learnPossessionTrait(get, set, uid, 'dresse-monter'); // pas de doublon
    const p = get().possessions.find((x) => x.uid === uid);
    expect(p?.nature === 'bete' && p.learnedTraits).toEqual(['dresse-monter']);
  });

  it('possessionsByOwner filtre par propriétaire', () => {
    const { get, set } = makeHarness([]);
    addPossession(get, set, mule('h1'));
    addPossession(get, set, mule('h2'));
    expect(possessionsByOwner(get, 'h1')).toHaveLength(1);
    expect(possessionsByOwner(get, 'h2')).toHaveLength(1);
  });

  it('possessionsByLocation filtre par localisation et exclut les détruites', () => {
    const { get, set } = makeHarness([]);
    const uid1 = addPossession(get, set, mule('h1'));
    addPossession(get, set, { ...mule('h1'), location: { kind: 'au-lieu', placeId: 'l1' } });
    abandonPossession(get, set, uid1);
    expect(possessionsByLocation(get, 'avec-le-groupe')).toHaveLength(0); // uid1 détruite, exclue
    expect(possessionsByLocation(get, 'au-lieu')).toHaveLength(1);
  });
});

describe('possessionsFlow — succession à la sortie de groupe (#615 §6/§19 décision №3)', () => {
  it('partyRemoveHero transfère les possessions du partant au doyen restant', () => {
    const h1 = makeHero('h1');
    const h2 = makeHero('h2');
    const { get, set } = makeHarness([h1, h2]);
    const uidA = addPossession(get, set, mule('h1'));
    const uidB = addPossession(get, set, mule('h1'));
    partyRemoveHero(get, set, 'h1');
    expect(get().possessions.find((p) => p.uid === uidA)?.ownerId).toBe('h2');
    expect(get().possessions.find((p) => p.uid === uidB)?.ownerId).toBe('h2');
    expect(get().party.map((h) => h.id)).toEqual(['h2']);
  });

  it('partyRemoveHero transfère la Bourse du partant au doyen — jamais perdue', () => {
    const h1 = makeHero('h1');
    const h2 = makeHero('h2');
    const { get, set } = makeHarness([h1, h2]);
    creditBourse(get, set, 'h1', { gold: 5, silver: 0, brass: 0 });
    creditBourse(get, set, 'h2', { gold: 1, silver: 0, brass: 0 });
    partyRemoveHero(get, set, 'h1');
    const heir = get().party.find((h) => h.id === 'h2')!;
    expect(bourseOf(heir)).toEqual({ gold: 6, silver: 0, brass: 0 });
  });

  it('groupe vidé par le retrait (dernier membre) : repli documenté — rien à hériter, aucune casse', () => {
    const h1 = makeHero('h1');
    const { get, set } = makeHarness([h1]);
    addPossession(get, set, mule('h1'));
    creditBourse(get, set, 'h1', { gold: 3, silver: 0, brass: 0 });
    expect(() => partyRemoveHero(get, set, 'h1')).not.toThrow();
    expect(get().party).toHaveLength(0);
    // aucun héritier vivant : la possession du partant reste sur lui (pas d'orphelin fabriqué,
    // pas de perte silencieuse — le partant quitte le groupe avec son bien).
    expect(get().possessions[0].ownerId).toBe('h1');
  });

  it('l’héritier est le doyen VIVANT — un cadavre restant dans party n’hérite jamais (angle 4)', () => {
    const anna = { ...makeHero('anna'), dead: true };
    const bruno = makeHero('bruno');
    const victime = makeHero('victime');
    const { get, set } = makeHarness([anna, bruno, victime]);
    const uid = addPossession(get, set, mule('victime'));
    creditBourse(get, set, 'victime', { gold: 4, silver: 0, brass: 0 });
    partyRemoveHero(get, set, 'victime');
    expect(get().possessions.find((p) => p.uid === uid)?.ownerId).toBe('bruno');
    const heirBruno = get().party.find((h) => h.id === 'bruno')!;
    const morteAnna = get().party.find((h) => h.id === 'anna')!;
    expect(bourseOf(heirBruno)).toEqual({ gold: 4, silver: 0, brass: 0 });
    expect(bourseOf(morteAnna)).toEqual({ gold: 0, silver: 0, brass: 0 });
  });

  it('tout-morts restants : aucun vivant à hériter → repli, pas de crash', () => {
    const anna = { ...makeHero('anna'), dead: true };
    const victime = makeHero('victime');
    const { get, set } = makeHarness([anna, victime]);
    const uid = addPossession(get, set, mule('victime'));
    creditBourse(get, set, 'victime', { gold: 2, silver: 0, brass: 0 });
    expect(() => partyRemoveHero(get, set, 'victime')).not.toThrow();
    expect(get().possessions.find((p) => p.uid === uid)?.ownerId).toBe('victime');
  });
});
