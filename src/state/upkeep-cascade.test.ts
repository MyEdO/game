import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { contractDisease } from '../engine/disease';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import type { HitLocation } from '../engine/types';
const tk = (k: 'dechirure' | 'fracture', s: 'mineur' | 'majeur', loc: HitLocation, opts?: { be?: number; d10?: number }) => traumaById(dechirureFractureFicheId(k, s, loc), opts, loc);
import { MINUTES_PER_DAY } from '../engine/clock';
import { applyOps } from '../engine/ops';
import type { Combatant } from '../engine/types';
import { objetDeTest } from '../engine/objetDeTest.testkit';

/**
 * #T3 — Cascade RAW d'horloge (`state/upkeep.ts`) : ce que le passage du temps déclenche sur les
 * franchissements de jour, QUEL QUE SOIT le chemin (advanceTime, repos, voyage) :
 *  - maladies (LDB 20) : incubation/durée en jours CALENDAIRES — progressent SANS repos ;
 *  - convalescence des Blessures critiques (LDB 18 l.222 : « un nombre de jours égal à 30 – votre Bonus d'Endurance ») ;
 *  - purge des contrecoups d'incantation à durée d'horloge (LDB 46/40) sur TOUS les chemins ;
 *  - anti-double-comptage : une journée n'est jamais décomptée deux fois (repos compris).
 */
const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: ['r1', 'r2', 'r3'].map((uid) => (objetDeTest({ uid, trappingId: 'ration' }))),
    ...p,
  } as Combatant);

describe('#T3 — cascade d’horloge (maladies/convalescence/purge sur franchissement de jour)', () => {
  beforeEach(() => {
    seedBattleRng(1);
    useGame.setState({ battle: null, mode: 'exploration', journal: [], travelPlan: null });
  });

  it('une maladie en incubation progresse quand le temps passe SANS repos (advanceTime)', () => {
    const c = hero({ diseases: [contractDisease('infection-mineure', { int: () => 1 }, { incubation: 2, duration: 5 })!] });
    useGame.setState({ party: [c], gameTime: 0, lastUpkeepDay: 0 });
    useGame.getState().advanceTime(2 * MINUTES_PER_DAY); // 2 jours d'aventure, personne ne dort
    const dz = useGame.getState().party[0].diseases![0];
    expect(dz.phase).toBe('active'); // l'incubation (2 j) s'est écoulée — calendaire, pas « au repos »
  });

  it('le bilan d’entretien d’advanceTime est VISIBLE et INFLUENÇABLE : le Test de Faim ouvre une cascade (#253), jamais un témoin pré-résolu', () => {
    const c = hero({ items: [], hunger: { days: 1, tests: 0, failures: 0 } }); // affamé, sans rations → Test de Faim ce jour
    useGame.setState({ party: [c], gameTime: 0, lastUpkeepDay: 0, pendingCascade: null });
    useGame.getState().advanceTime(MINUTES_PER_DAY);
    // Le jet d'entretien passe par la SURFACE influençable (cascade), pas un reveal pré-résolu (LDB 17 : Chance sur tout Test raté).
    const p = useGame.getState().pendingCascade;
    expect(p).toBeTruthy();
    expect(p!.purpose).toBe('upkeep');
    expect(p!.participants.some((s) => s.kind === 'faim')).toBe(true);
    expect(p!.participants.some((s) => s.kind === 'round')).toBe(false); // plus de témoin quand un jet est différé
    useGame.setState({ pendingCascade: null }); // ne pas geler l'IA des tests suivants (piège connu)
  });

  it('la convalescence d’un trauma décompte les jours CALENDAIRES (LDB 18 l.222), repos ou pas', () => {
    const c = hero({ traumas: [tk('dechirure', 'mineur', 'jambeD', { be: 28 })] }); // 30−28 = 2 jours
    useGame.setState({ party: [c], gameTime: 0, lastUpkeepDay: 0 });
    useGame.getState().advanceTime(2 * MINUTES_PER_DAY);
    expect(useGame.getState().party[0].traumas!.length).toBe(0); // guéri sans avoir « dormi »
  });

  it('anti-double-comptage : une nuit de repos = UN seul jour de maladie décompté', () => {
    const c = hero({ diseases: [contractDisease('infection-mineure', { int: () => 1 }, { incubation: 0, duration: 6 })!] });
    useGame.setState({ party: [c], gameTime: 12 * 60, lastUpkeepDay: 0 });
    useGame.getState().restParty(); // dort jusqu'à l'aube → 1 franchissement de jour
    expect(useGame.getState().party[0].diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY); // 6 − 1 jour, PAS − 2
  });

  it('un contrecoup d’incantation à durée d’horloge expiré est purgé par le REPOS (bug A1)', () => {
    const t0 = 12 * 60;
    const c = hero({ castPenalties: [{ label: 'Pensez à vos actes', skill: 'priere', maxZeroDR: true, untilTime: t0 + 60 }] });
    useGame.setState({ party: [c], gameTime: t0, lastUpkeepDay: 0 });
    useGame.getState().restParty(); // le repos pose gameTime directement (pas advanceTime)
    expect(useGame.getState().party[0].castPenalties ?? []).toHaveLength(0);
    expect(useGame.getState().journal.join(' ')).toMatch(/Pensez à vos actes se dissipe/);
  });

  it('un buff de sort à durée d’HORLOGE (« 1 heure ») expire à son échéance, pas à 9999 Rounds (A4)', () => {
    const t0 = 12 * 60;
    const c = hero({});
    // Buff posé comme le ferait applyCast pour une durée « 1 heure » : durée d horloge (untilTime, sans sentinelle).
    applyOps(c, [{ op: 'charMod', char: 'force', mod: 10 }], {
      label: 'Tour de force', defaultUntilTime: t0 + 60,
    });
    useGame.setState({ party: [c], gameTime: t0, lastUpkeepDay: 0 });
    useGame.getState().advanceTime(30); // 30 min : toujours actif
    expect(useGame.getState().party[0].activeEffects).toHaveLength(1);
    useGame.getState().advanceTime(31); // 61 min : échéance dépassée → dissipé
    expect(useGame.getState().party[0].activeEffects ?? []).toHaveLength(0);
    expect(useGame.getState().journal.join(' ')).toMatch(/Tour de force se dissipe/);
  });
});
