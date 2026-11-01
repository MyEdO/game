/**
 * Canal de notification ligne↔État (`OpsCtx.onCondition` / paramètre `emit`, #1330).
 *
 * PÉRIMÈTRE EXACT du canal aujourd'hui — les sites BRANCHÉS sont : `applyOps` (ops `condition` et
 * `removeCondition`), les verrous de Critique levés par un acte de soin (LDB 18), les expirations
 * d'État à durée de sort, et l'interprète inline des maladies. Ce n'est PAS tout le moteur : d'autres
 * émetteurs journalisent des États sans notifier (Exécuté/Inconscient de `conditions.ts`, `healing`,
 * `exposure`, `suffocation`, `travel`…). Ils seront branchés PAR FAMILLES en V8d-B/C ; leur reste à
 * faire se lit au cliquet `src/condition-event-counter.test.ts`. N'héritez donc AUCUN contrat total
 * de cette sonde.
 *
 * Ce qu'elle verrouille, sur ce périmètre :
 *  1. un site branché qui journalise un État nommé pose AUSSI son `stateId` — l'id voyage EN DONNÉE,
 *     à côté de la ligne, jamais dans son texte ;
 *  2. le canal est PUREMENT additif : branché ou non, les lignes rendues sont identiques au caractère
 *     près (aucune assertion de chaîne existante ne peut bouger à cause de lui) ;
 *  3. une ligne d'un site branché qui ne nomme AUCUN État ne notifie rien.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, ConditionChange } from './types';
import { applyOps } from './ops';
import { addCondition, hasCondition, releaseConditionLocks, tickDurations, endOfRound, COND } from './conditions';
import { contractDisease, tickDisease } from './disease';
import { MINUTES_PER_DAY } from './clock';
import type { RNG } from './dice';
import { desDuTest, desEnSuite } from './dice.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

const seq = (values: number[]): RNG => desEnSuite(values);

function hero(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 35 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], items: [], diseases: [],
    ...p,
  }) as Combatant;
}

/** Exécute `run` avec un espion branché ; rend les lignes ET les notifications reçues. */
function withSpy(run: (emit: (e: ConditionChange) => void) => string[]): { lines: string[]; seen: ConditionChange[] } {
  const seen: ConditionChange[] = [];
  const lines = run((e) => seen.push(e));
  return { lines, seen };
}

describe("op 'condition' → canal onCondition (l'id part avec la ligne)", () => {
  it('applique Sonné : la notification porte id + sens + porteur (aucun libellé)', () => {
    const c = hero();
    const { lines, seen } = withSpy((emit) => applyOps(c, [{ op: 'condition', id: COND.sonne }], { rng: desDuTest, onCondition: emit }));
    expect(seen).toEqual([{ stateId: COND.sonne, change: 'gain', targetId: 'h' }]);
    expect(lines).toHaveLength(1);
    expect(seen[0].stateId).not.toContain(' '); // un id, jamais « Sonné »
  });

  it('les QUATRE formes de pose (nue, Rounds, horloge, perRound) notifient chacune UNE fois', () => {
    const forms = [
      { op: 'condition' as const, id: COND.sonne },
      { op: 'condition' as const, id: COND.aveugle, durationRounds: 3 },
      { op: 'condition' as const, id: COND.empetre, durationMinutes: 30 },
      { op: 'condition' as const, id: COND.extenue, perRound: true },
    ];
    for (const o of forms) {
      const c = hero();
      const { lines, seen } = withSpy((emit) => applyOps(c, [o], { rng: desDuTest, onCondition: emit, now: 0 }));
      expect(lines, `forme ${JSON.stringify(o)}`).toHaveLength(1);
      expect(seen, `forme ${JSON.stringify(o)}`).toEqual([{ stateId: o.id, change: 'gain', targetId: 'h' }]);
    }
  });

  it("`perRound` notifie à l'ANNONCE, sans poser d'État : le canal appareille une LIGNE, pas un delta", () => {
    const c = hero();
    const { seen } = withSpy((emit) => applyOps(c, [{ op: 'condition', id: COND.extenue, perRound: true }], { rng: desDuTest, onCondition: emit }));
    expect(seen).toEqual([{ stateId: COND.extenue, change: 'gain', targetId: 'h' }]);
    // Le porteur ne porte RIEN encore : les poses réelles tomberont à chaque fin de Round (op re-jouée)
    // et notifieront chacune la leur. Un consommateur qui compterait les `gain` double-compterait.
    expect(c.conditions.find((x) => x.id === COND.extenue)).toBeUndefined();
  });

  it("op 'removeCondition' notifie une PERTE du même id", () => {
    const c = hero();
    addCondition(c, COND.extenue, 2);
    const { seen } = withSpy((emit) => applyOps(c, [{ op: 'removeCondition', id: COND.extenue }], { rng: desDuTest, onCondition: emit }));
    expect(seen).toEqual([{ stateId: COND.extenue, change: 'loss', targetId: 'h' }]);
  });

  // LDB 16 l.76 : la demande de retrait peut excéder les pions portés — ligne et canal suivent le retrait EFFECTIF.
  it("op 'removeCondition' de valeur 2 sur UN seul pion : la ligne dit 1, et une seule perte sort", () => {
    const c = hero();
    addCondition(c, COND.empoisonne, 1);
    const { lines, seen } = withSpy((emit) => applyOps(c, [{ op: 'removeCondition', id: COND.empoisonne, value: 2 }], { rng: desDuTest, onCondition: emit }));
    expect(lines).toEqual(['Cobaye retire 1 État Empoisonné.']);
    expect(seen).toEqual([{ stateId: COND.empoisonne, change: 'loss', targetId: 'h' }]);
    expect(hasCondition(c, COND.empoisonne)).toBe(false);
  });

  // Un État VERROUILLÉ (LDB 18) ne part pas : l'op ne peut ni l'annoncer au journal ni notifier une
  // perte qui n'a pas eu lieu — le canal suit le RETRAIT EFFECTIF, mesuré aux pions.
  it("op 'removeCondition' sur un État VERROUILLÉ : ni ligne, ni perte", () => {
    const c = hero({ wounds: blessuresDeBase(12, 0) });
    addCondition(c, COND.aTerre, 1); // verrou de TYPE : 0 Blessure (LDB 18 l.15)
    const { lines, seen } = withSpy((emit) => applyOps(c, [{ op: 'removeCondition', id: COND.aTerre }], { rng: desDuTest, onCondition: emit }));
    expect(hasCondition(c, COND.aTerre), 'la sonde ne mesurerait rien si le verrou ne tenait pas').toBe(true);
    expect(lines, 'le journal annonce un retrait qui n’a pas eu lieu').toEqual([]);
    expect(seen, 'le canal notifie une perte qui n’a pas eu lieu').toEqual([]);

    // TÉMOIN — le même État, verrou TOMBÉ (1 Blessure) : la ligne ET la perte sortent.
    c.wounds.current = 1;
    const ok = withSpy((emit) => applyOps(c, [{ op: 'removeCondition', id: COND.aTerre }], { rng: desDuTest, onCondition: emit }));
    expect(hasCondition(c, COND.aTerre)).toBe(false);
    expect(ok.lines).toHaveLength(1);
    expect(ok.seen).toEqual([{ stateId: COND.aTerre, change: 'loss', targetId: 'h' }]);
  });

  it("removeCondition SANS État à retirer : sans objet, ni ligne ni notification", () => {
    const c = hero();
    const { lines, seen } = withSpy((emit) => applyOps(c, [{ op: 'removeCondition' }], { rng: desDuTest, onCondition: emit }));
    expect(lines).toEqual([]);
    expect(seen).toEqual([]);
  });

  it("une op SANS État (wounds) ne notifie rien", () => {
    const c = hero();
    const { seen } = withSpy((emit) => applyOps(c, [{ op: 'wounds', amount: 2 }], { rng: desDuTest, onCondition: emit }));
    expect(seen).toEqual([]);
  });
});

describe('PARITÉ STRICTE des lignes — le canal est additif, il ne touche à aucun texte', () => {
  const OPS = [
    [{ op: 'condition' as const, id: COND.sonne, value: 2 }],
    [{ op: 'condition' as const, id: COND.aveugle, durationRounds: 3 }],
    [{ op: 'condition' as const, id: COND.empetre, durationMinutes: 30 }],
    [{ op: 'condition' as const, id: COND.extenue, perRound: true }],
    [{ op: 'removeCondition' as const, id: COND.extenue }],
    [{ op: 'removeCondition' as const }],
  ];

  it('mêmes ops, avec et sans canal → lignes identiques au caractère près', () => {
    for (const ops of OPS) {
      const prep = () => { const c = hero(); addCondition(c, COND.extenue, 2); return c; };
      const sans = applyOps(prep(), ops, { rng: desDuTest, now: 0 });
      const avec = applyOps(prep(), ops, { rng: desDuTest, now: 0, onCondition: () => {} });
      expect(avec, `ops ${JSON.stringify(ops)}`).toEqual(sans);
    }
  });

  it("l'ÉTAT du combattant est lui aussi identique (le canal n'applique rien)", () => {
    const sans = hero(); applyOps(sans, [{ op: 'condition', id: COND.sonne, value: 2 }], { rng: desDuTest });
    const avec = hero(); applyOps(avec, [{ op: 'condition', id: COND.sonne, value: 2 }], { rng: desDuTest, onCondition: () => {} });
    expect(avec.conditions).toEqual(sans.conditions);
  });
});

describe('sites HORS applyOps — paramètre `emit` (LDB 18 verrous, durées de sort, maladies)', () => {
  it('releaseConditionLocks : un verrou levé notifie la PERTE de son État', () => {
    const c = hero();
    addCondition(c, COND.hemorragique, 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    const { lines, seen } = withSpy((emit) => releaseConditionLocks(c, 'medicalAid', emit));
    expect(lines).toHaveLength(1);
    expect(seen).toEqual([{ stateId: COND.hemorragique, change: 'loss', targetId: 'h' }]);
  });

  it('tickDurations : un État de sort qui expire notifie sa PERTE', () => {
    const c = hero();
    c.conditions = [{ id: COND.aveugle, value: 1, roundsLeft: 1 }];
    const { lines, seen } = withSpy((emit) => tickDurations(c, emit));
    expect(lines).toHaveLength(1);
    expect(seen).toEqual([{ stateId: COND.aveugle, change: 'loss', targetId: 'h' }]);
    expect(c.conditions).toEqual([]);
  });

  it('endOfRound RELAIE le canal jusqu’à tickDurations (le fil ne se coupe pas en chemin)', () => {
    const c = hero();
    c.conditions = [{ id: COND.aveugle, value: 1, roundsLeft: 1 }];
    const { seen } = withSpy((emit) => endOfRound(c, seq([]), emit));
    expect(seen).toEqual([{ stateId: COND.aveugle, change: 'loss', targetId: 'h' }]);
  });

  it('tickDisease : l’éclatement du Vers du Reik (MSRC 16 l.142) notifie le gain de Sonné', () => {
    const c = hero({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 0 })!] });
    for (let d = 0; d < 6; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), () => {});
    const { seen } = withSpy((emit) => tickDisease(c, MINUTES_PER_DAY, seq([]), () => {}, 4, emit));
    expect(c.conditions.find((x) => x.id === COND.sonne)?.value).toBe(1); // le geste a bien eu lieu
    expect(seen).toEqual([{ stateId: COND.sonne, change: 'gain', targetId: 'h' }]);
  });
});

describe('moteur PUR (aucun canal branché)', () => {
  it('tous les sites restent silencieux et fonctionnels sans hook', () => {
    const c = hero();
    expect(applyOps(c, [{ op: 'condition', id: COND.sonne }], { rng: desDuTest })).toHaveLength(1);
    expect(c.conditions.find((x) => x.id === COND.sonne)?.value).toBe(1);
    expect(() => releaseConditionLocks(c, 'magic')).not.toThrow();
    expect(() => tickDurations(c)).not.toThrow();
  });
});
