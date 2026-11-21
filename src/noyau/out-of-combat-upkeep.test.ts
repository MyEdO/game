import { describe, it, expect } from 'vitest';
import { hasCondition, stacks } from '../engine/conditions';
import { applyStopBleed } from '../engine/healing';
import { resolveCritique } from '../engine/critical';
import { dayIndex, MINUTES_PER_DAY } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { ouvrirLeBanc, type Banc, type EntreesDuBanc } from './banc.testkit';
import { avanceEtapeCascade, draineEtapes } from './cascade.testkit';
import { initialNet } from './etat';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './sieges';
import { applyCriticalToTarget } from './combatFlow';
import { battleRng } from './battleRng';

function espionneEffets(c: Combatant, effets: unknown[]): { lectures: number } {
  const sonde = { lectures: 0 };
  let valeur = effets;
  Object.defineProperty(c, 'activeEffects', {
    configurable: true,
    get() { sonde.lectures += 1; return valeur; },
    set(v) { valeur = v; },
  });
  return sonde;
}

function mk(opts: { id?: string; current?: number; conditions?: Combatant['conditions']; fate?: number; advantage?: number; endurance?: number } = {}): Combatant {
  return combattantDeTest({
    id: opts.id ?? 'h1', label: opts.id ?? 'Héroïne', kind: 'heros',
    characteristics: opts.endurance === undefined ? undefined : { endurance: opts.endurance },
    wounds: blessuresDeBase(10, opts.current ?? 10),
    advantage: opts.advantage ?? 0,
    conditions: opts.conditions ?? [],
    fate: opts.fate ?? 0,
  });
}

function decor(party: Combatant[], options: EntreesDuBanc = {}): Banc {
  return ouvrirLeBanc({ graine: 1, desFixes: true, ...options, etat: { ...options.etat, party } });
}

const avancer = (banc: Banc, rounds = 1) => banc.getState().avancerLeTemps(rounds * TIME_COST.combatRound);
const jouer = (banc: Banc, de: number) => avanceEtapeCascade(banc.getState, () => de);
const porteur = (banc: Banc, c: Combatant) => banc.getState().party.find((x) => x.id === c.id)!;

function testOuvert(banc: Banc, c: Combatant, skill: string) {
  const sequence = banc.getState().pendingCascade;
  expect(sequence, 'le Test doit s’ouvrir après le geste d’horloge').toBeTruthy();
  const etape = sequence!.participants[sequence!.cursor];
  expect(etape).toMatchObject({ kind: 'testDeclenche', actorId: c.id, skill: { id: skill } });
  expect(etape.result, 'le dé appartient encore au joueur').toBeFalsy();
  return etape;
}

describe('Entretien des États à l’horloge (LDB 13 l.45–47)', () => {
  it('Empoisonné : perd un PB et tout Avantage avant le Test, puis reprend chaque Round après validation', () => {
    const c = mk({ current: 8, advantage: 2, conditions: [{ id: 'empoisonne', value: 1 }] });
    const banc = decor([c]);
    avancer(banc, 3);
    for (const blessures of [7, 6, 5]) {
      testOuvert(banc, c, 'resistance');
      expect(porteur(banc, c).wounds.current).toBe(blessures);
      expect(porteur(banc, c).advantage).toBe(0);
      jouer(banc, 98);
    }
    expect(stacks(porteur(banc, c), 'empoisonne')).toBe(1);
  });

  it('Empoisonné : le Test prend la difficulté du poison et DR 1 retire deux pions avant de donner Exténué (LDB 16 l.70–78)', () => {
    const c = mk({ current: 8, endurance: 65, conditions: [{ id: 'empoisonne', value: 2, difficulte: 'difficile' }] });
    const banc = decor([c]);
    avancer(banc);
    expect(porteur(banc, c).wounds.current).toBe(6);
    expect(testOuvert(banc, c, 'resistance')).toMatchObject({ difficulty: 'difficile', target: 25 });
    jouer(banc, 15);
    expect(stacks(porteur(banc, c), 'empoisonne')).toBe(0);
    expect(stacks(porteur(banc, c), 'extenue')).toBe(1);
  });

  it('Inconscient et Empoisonné : le Test de récupération est porté par le héros (LDB 16 l.76)', () => {
    const c = mk({ current: 8, conditions: [{ id: 'empoisonne', value: 1 }, { id: 'inconscient', value: 1 }] });
    const banc = decor([c]);
    avancer(banc);
    testOuvert(banc, c, 'resistance');
    jouer(banc, 5);
    expect(hasCondition(porteur(banc, c), 'empoisonne')).toBe(false);
    expect(hasCondition(porteur(banc, c), 'extenue')).toBe(true);
  });

  it('Sonné isolé : la récupération ouvre Résistance, retire deux États et donne Exténué (LDB 16 l.127–129)', () => {
    const c = mk({ conditions: [{ id: 'sonne', value: 2 }] });
    const banc = decor([c]);
    avancer(banc);
    expect(testOuvert(banc, c, 'resistance').difficulty).toBe('intermediaire');
    jouer(banc, 5);
    expect(stacks(porteur(banc, c), 'sonne')).toBe(0);
    expect(stacks(porteur(banc, c), 'extenue')).toBe(1);
  });

  it('Épaule luxée : le Sonné d’Aide Médicale n’ouvre aucun Test à l’horloge (LDB 18 l.120)', () => {
    const c = mk({ endurance: 90 });
    const banc = decor([c]);
    const get = banc.getState;
    const h = porteur(banc, c);
    const prerolled = resolveCritique('ldb', h, 'brasG', battleRng(), { forcedRoll: 77 });
    expect(prerolled.entryId).toBe('epaule-luxee');
    applyCriticalToTarget(h, 'brasG', 0, [], banc.setState, { get, prerolled, suppressReveal: true });
    get().jetLancer('test');
    get().jetImposerLeResultat('test', 1);
    expect(get().pendingTest?.success).toBe(true);
    get().jetValider('test');

    const debut = get().gameTime;
    avancer(banc, 480);

    expect(get().gameTime).toBe(debut + 480 * TIME_COST.combatRound);
    expect(get().pendingTest).toBeNull();
    expect(get().pendingCascade).toBeNull();
    expect(porteur(banc, c).conditions).toContainEqual({ id: 'sonne', value: 1, unlockBy: 'medicalAid' });
  });

  it('Brisé isolé : hors de vue sans dissimulation, Calme est Intermédiaire et vide Brisé avant Exténué (LDB 16 l.54–58)', () => {
    const c = mk({ conditions: [{ id: 'brise', value: 1 }] });
    const banc = decor([c]);
    avancer(banc);
    expect(testOuvert(banc, c, 'calme').difficulty).toBe('intermediaire');
    jouer(banc, 5);
    expect(stacks(porteur(banc, c), 'brise')).toBe(0);
    expect(stacks(porteur(banc, c), 'extenue')).toBe(1);
  });

  it('reprend après sérialisation, dans l’ordre des États et des porteurs, avant le Round suivant', () => {
    const a = mk({ id: 'Alma', current: 8, conditions: [{ id: 'empoisonne', value: 1 }, { id: 'sonne', value: 1 }] });
    const b = mk({ id: 'Bruna', conditions: [{ id: 'brise', value: 1 }] });
    const banc = decor([a, b]);
    avancer(banc, 2);

    testOuvert(banc, a, 'resistance');
    expect(porteur(banc, a).wounds.current).toBe(7);
    banc.setState({ pendingCascade: JSON.parse(JSON.stringify(banc.getState().pendingCascade)) });
    jouer(banc, 98);
    expect(testOuvert(banc, a, 'resistance').label).toBe('Résistance au Sonné');
    expect(porteur(banc, a).wounds.current).toBe(7);
    jouer(banc, 5);
    testOuvert(banc, b, 'calme');
    expect(stacks(porteur(banc, a), 'sonne')).toBe(0);
    expect(stacks(porteur(banc, b), 'brise')).toBe(1);
    jouer(banc, 5);
    testOuvert(banc, a, 'resistance');
    expect(porteur(banc, a).wounds.current).toBe(6);
    expect(stacks(porteur(banc, b), 'brise')).toBe(0);
    jouer(banc, 5);
    expect(stacks(porteur(banc, a), 'empoisonne')).toBe(0);
    expect(porteur(banc, a).wounds.current).toBe(6);
  });

  it('le siège qui tient le héros reçoit la fenêtre d’entretien', () => {
    const c = mk({ conditions: [{ id: 'sonne', value: 1 }] });
    const net = { ...initialNet(), mode: 'hote' as const, mySeat: 0, ownership: { [c.id]: 1 }, slots: [0, 1, 0, 0] };
    const banc = decor([c], { etat: { net } });
    avancer(banc);
    testOuvert(banc, c, 'resistance');
    expect(modalOwnerOf(banc.getState())).toBe(c.id);
    expect(seatOwns(banc.getState(), 0, c.id)).toBe(false);
    expect(seatOwns(banc.getState(), 1, c.id)).toBe(true);
  });

  it('le changement de jour attend la résolution du Round et ne se rejoue pas', () => {
    const c = mk({ conditions: [{ id: 'empoisonne', value: 1 }] });
    const minuteAvant = MINUTES_PER_DAY - TIME_COST.combatRound;
    const banc = decor([c], { etat: { gameTime: minuteAvant, lastUpkeepDay: dayIndex(minuteAvant) } });
    avancer(banc);
    testOuvert(banc, c, 'resistance');
    expect(banc.getState().lastUpkeepDay).toBe(dayIndex(minuteAvant));
    jouer(banc, 5);
    expect(banc.getState().lastUpkeepDay).toBe(dayIndex(minuteAvant) + 1);
    draineEtapes(banc.getState, 10, () => 5);
    expect(banc.getState().lastUpkeepDay).toBe(dayIndex(minuteAvant) + 1);
  });

  it('sans État périodique ni 0 PB, le héros garde ses Blessures', () => {
    const c = mk({ current: 8 });
    const banc = decor([c]);
    avancer(banc, 10);
    expect(porteur(banc, c).wounds.current).toBe(8);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('Immunité (Feu) dispense de la boucle de dégâts périodiques (LDB 85 l.174)', () => {
    const immunise = mk({ id: 'Immune', conditions: [{ id: 'en-flammes', value: 1 }] });
    immunise.traits = [{ id: 'immunite', arg: 'feu' }];
    const sonde = espionneEffets(immunise, []);
    const banc = decor([immunise]);
    avancer(banc, 480);
    expect(porteur(banc, immunise).wounds.current).toBe(10);
    expect(sonde.lectures).toBeLessThan(10);

    const brule = mk({ id: 'Brûlé', conditions: [{ id: 'en-flammes', value: 1 }] });
    const sondeBrule = espionneEffets(brule, []);
    banc.setState({ party: [brule] });
    avancer(banc, 3);
    expect(sondeBrule.lectures).toBeGreaterThan(sonde.lectures);
    expect(porteur(banc, brule).wounds.current).toBeLessThan(10);
  });

  it('la présence d’un Test d’État ne déclenche pas la dissipation d’un autre État sur un héros sans péril', () => {
    const c = mk({ conditions: [{ id: 'sonne', value: 2 }, { id: 'aveugle', value: 1 }] });
    const banc = decor([c]);
    avancer(banc);
    testOuvert(banc, c, 'resistance');
    jouer(banc, 5);
    expect(stacks(porteur(banc, c), 'aveugle')).toBe(1);
    expect(porteur(banc, c).wounds.current).toBe(10);
  });

  it('un effet en attente de prolongation ignore les Rounds (LDB 47 l.311)', () => {
    const gele = { label: 'Bénédiction', bonus: 10, characteristic: 'capacite-de-combat', duration: { scale: 'rounds', left: 0 }, awaitingExtension: true };
    const c = mk({ current: 8 });
    const sonde = espionneEffets(c, [{ ...gele }]);
    const banc = decor([c]);
    sonde.lectures = 0;
    avancer(banc);
    const lecturesEnUnRound = sonde.lectures;
    sonde.lectures = 0;
    avancer(banc, 480);
    expect(sonde.lectures).toBe(lecturesEnUnRound);
    expect(porteur(banc, c).activeEffects).toEqual([gele]);

    const vif = mk({ id: 'Vif', current: 8 });
    const sondeVive = espionneEffets(vif, [{ ...gele, awaitingExtension: undefined, duration: { scale: 'rounds', left: 6 } }]);
    banc.setState({ party: [vif] });
    avancer(banc, 480);
    expect(sondeVive.lectures).toBeGreaterThan(sonde.lectures);
  });

  it('un effet de 6 Rounds expire à l’horloge sans dissiper un Aveuglé sans rapport', () => {
    const c = mk({ conditions: [{ id: 'aveugle', value: 2 }] });
    c.activeEffects = [{ label: 'Bénédiction', bonus: 10, characteristic: 'capacite-de-combat', duration: { scale: 'rounds', left: 6 } }];
    const banc = decor([c]);
    avancer(banc, 6);
    expect(porteur(banc, c).activeEffects).toHaveLength(0);
    expect(banc.getState().journal.filter((ligne) => ligne.includes('Bénédiction'))).toHaveLength(1);
    expect(stacks(porteur(banc, c), 'aveugle')).toBe(2);
  });

  it('tombe à 0 PB par poison, puis progresse vers l’Inconscience (LDB 18 l.15)', () => {
    const c = mk({ current: 2, conditions: [{ id: 'empoisonne', value: 1 }] });
    const banc = decor([c]);
    avancer(banc, 5);
    draineEtapes(banc.getState, 12, () => 98);
    expect(porteur(banc, c).wounds.current).toBe(0);
    expect(hasCondition(porteur(banc, c), 'a-terre')).toBe(true);
  });

  it.each([1, 0])('hémorragie mortelle : le sort du héros dépend de sa réserve de Destin (%s)', (fate) => {
    const c = mk({ current: 3, conditions: [{ id: 'hemorragique', value: 3 }], fate });
    const banc = decor([c], { graine: 7 });
    avancer(banc);
    const apres = porteur(banc, c);
    expect(Boolean(apres.dead)).toBe(fate === 0);
    expect(apres.fate).toBe(0);
    if (fate) expect(apres.wounds.current).toBeGreaterThanOrEqual(1);
  });

  it('des Premiers Secours retirent Hémorragique, évitant la mort (LDB 09 l.261 ; LDB 16 l.107–109)', () => {
    const c = mk({ current: 3, conditions: [{ id: 'hemorragique', value: 3 }] });
    applyStopBleed(c, 2, { test: 'guerison', bandages: false });
    const banc = decor([c], { graine: 7 });
    avancer(banc);
    expect(porteur(banc, c).dead).toBeFalsy();
    expect(porteur(banc, c).fate).toBe(0);
  });
});
