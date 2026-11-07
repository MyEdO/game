import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { applyEffects, jouerFlowEntier, runFlow } from './combatEffects';
import { buildSeaPlan, finalizePortArrivalTo, runSeaDay } from './seaVoyageFlow';
import { avanceEtapeCascade } from './cascade.testkit';
import { setDataset, resetData } from '../data/overrides';
import { BOARD_EVENTS, PORT_EVENTS } from '../engine/seaVoyage';
import type { Flow } from '../engine/flowCore';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const carte: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois-mer'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function etatFrais(): void {
  seedBattleRng(1);
  set({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: carte, lieu: 'A', travelPlan: null, pendingCascade: null, suspendedCascades: [],
    flags: {}, journal: [],
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
  });
}

const drapeau = (flag: string): Flow => ({ kind: 'do', effect: { type: 'setFlag', flag, value: true } as Effect as never });

describe('runFlow — nœud `choice` (#1652 G1)', () => {
  beforeEach(etatFrais);

  const flux: Flow = {
    kind: 'seq',
    steps: [{ kind: 'choice', prompt: 'Payer', yes: drapeau('oui'), no: drapeau('non') }, drapeau('suite')],
  };

  it('ouvre une décision au meneur ; la suite attend la décision', () => {
    jouerFlowEntier(runFlow(get, set, flux, 'Décision'));
    const etape = get().pendingCascade?.participants[0];
    expect(etape?.kind).toBe('flowChoice');
    expect(etape?.actorId).toBe(get().party[0].id);
    expect(get().flags).toEqual({});
  });

  it.each([['yes', 'oui', 'non'], ['no', 'non', 'oui']])('« %s » joue sa branche, puis la suite du Flow', (cle, joue, ecarte) => {
    jouerFlowEntier(runFlow(get, set, flux, 'Décision'));
    avanceEtapeCascade(get, undefined, () => cle);
    expect(get().pendingCascade).toBeNull();
    expect(get().flags[joue]).toBe(true);
    expect(get().flags[ecarte]).toBeUndefined();
    expect(get().flags.suite).toBe(true);
  });

  it('un coût d’Avantage n’est pas offert hors combat (LDB 14 l.219) : la branche « non » se joue', () => {
    jouerFlowEntier(runFlow(get, set, { kind: 'choice', prompt: 'Payer', advantageCost: 1, yes: drapeau('oui'), no: drapeau('non') }, 'Décision'));
    expect(get().pendingCascade).toBeNull();
    expect(get().flags).toEqual({ non: true });
  });
});

describe('cible `navire` d’un EffectOp (#1652 G2 — MDG 15 l.83-125, l.152-153)', () => {
  beforeEach(etatFrais);

  const surLeNavire = (ops: unknown[]): Effect => ({ type: 'ops', on: 'navire', ops } as never);

  it('à quai : Blessures, Moral et Coup critique sur le navire de campagne, persistés sur `vessel`', () => {
    applyEffects(get, set, [surLeNavire([
      { op: 'wounds', amount: 5 },
      { op: 'shipMorale', delta: { sign: -1, dice: { n: 0, sides: 10, plus: 3 } } },
      { op: 'manann', delta: { sign: 1, dice: { n: 0, sides: 10, plus: 4 } } },
      { op: 'shipCritical', location: 'coque', count: 1 },
    ])]);
    const v = get().vessel!;
    expect(v.wounds!.max - v.wounds!.current).toBe(5);
    expect(v.morale.score).toBe(72);
    expect(v.manann!.score).toBe(4);
    expect(v.criticals).toHaveLength(1);
  });

  it('en voyage : la coque de TRAJET subit, et `vessel.wounds` la suit', () => {
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0])! });
    const avant = (get().travelPlan!.vehicle as Combatant).wounds.current;
    applyEffects(get, set, [surLeNavire([{ op: 'wounds', amount: 4 }])]);
    expect((get().travelPlan!.vehicle as Combatant).wounds.current).toBe(avant - 4);
    expect(get().vessel!.wounds!.current).toBe(avant - 4);
  });

  it('une op de navire hors de la cible `navire` lève, nommée', () => {
    expect(() => applyEffects(get, set, [{ type: 'ops', on: 'party', ops: [{ op: 'shipMorale', delta: { sign: 1, dice: { n: 1, sides: 10 } } }] } as never]))
      .toThrow(/shipMorale ne vise que le navire/);
  });
});

describe('Présages divins : seul un Prêtre ou une Nonne de Manann prie (MDG 15 l.197-198, l.230-232)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  function jour(evenement: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: evenement } } });
    runSeaDay(get, set);
  }
  const prier = (talents: Combatant['talents']): void => {
    const [h, ...reste] = get().party;
    set({ party: [{ ...h, skills: [...(h.skills ?? []), { id: 'priere', characteristic: 'sociabilite', advances: 20 }], talents: [...h.talents, ...talents] }, ...reste] });
  };
  const etapeDePriere = () => get().pendingCascade?.participants.find((s) => s.stake && 'key' in s.stake && s.stake.key?.kind === 'sea-priere');

  it('albatros, sans Prêtre de Manann (Prière seule) : aucun Test, l’Humeur et le Moral tombent', () => {
    prier([]);
    jour('presage-divin-albatros');
    expect(etapeDePriere()).toBeUndefined();
    expect(get().vessel!.manann!.score).toBeLessThan(0);
    expect(get().vessel!.morale.score).toBeLessThan(75);
  });

  it('albatros, avec un Prêtre de Manann (Béni (Manann)) : le Test de Prière s’ouvre, rien n’est encore appliqué', () => {
    prier([{ talentId: 'beni', spec: 'manann', times: 1 }]);
    jour('presage-divin-albatros');
    expect(etapeDePriere()).toBeDefined();
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().vessel!.morale.score).toBe(75);
  });

  it('feu bleu, sans Prêtre de Manann : rien ne change', () => {
    prier([{ talentId: 'beni', spec: 'sigmar', times: 1 }]);
    jour('presage-divin-feu-bleu');
    expect(etapeDePriere()).toBeUndefined();
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().vessel!.morale.score).toBe(75);
  });

  it('la donnée porte la RAW : albatros −2d10 / −1d10, feu bleu +2d10 / +1d10, Prière Complexe', () => {
    const ops = (id: string) => JSON.stringify(BOARD_EVENTS.find((e) => e.id === id)?.consequence);
    expect(ops('presage-divin-albatros')).toContain('"difficulty":"complexe"');
    expect(ops('presage-divin-albatros')).toContain('{"op":"manann","delta":{"sign":-1,"dice":{"n":2,"sides":10}}}');
    expect(ops('presage-divin-albatros')).toContain('{"op":"shipMorale","delta":{"sign":-1,"dice":{"n":1,"sides":10}}}');
    expect(ops('presage-divin-feu-bleu')).toContain('{"op":"manann","delta":{"sign":1,"dice":{"n":2,"sides":10}}}');
    expect(ops('presage-divin-feu-bleu')).toContain('{"op":"shipMorale","delta":{"sign":1,"dice":{"n":1,"sides":10}}}');
  });
});

describe('Escale : une `consequence` qui suspend reprend AVANT l’arrivée au lieu (#1652 §7)', () => {
  beforeEach(etatFrais);
  afterEach(() => resetData());

  it('le choix de l’événement se tranche, PUIS le groupe arrive au port', () => {
    const choix: Flow = { kind: 'choice', prompt: 'Payer', yes: drapeau('paye') };
    setDataset('seaPortEvents', PORT_EVENTS.map(({ min, max, id, label, desc }) => ({ min, max, id, label, desc, consequence: choix })) as never);
    finalizePortArrivalTo(get, set, carte.places[1], true);
    expect(get().pendingCascade?.participants[0].kind).toBe('flowChoice');
    expect(get().lieu).toBe('A');
    avanceEtapeCascade(get, undefined, () => 'yes');
    expect(get().flags.paye).toBe(true);
    expect(get().lieu).toBe('B');
  });
});
