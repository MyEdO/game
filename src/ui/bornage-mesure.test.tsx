// @vitest-environment jsdom
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from '../noyau/monde/scene';
import { RunModal } from './RunModal';
import { ApproachModal } from './ApproachModal';
import { WardModal } from './WardModal';
import { BargainModalView } from './BargainModal';
import { CorruptionModal } from './CorruptionModal';
import { StateRecoveryModal } from './StateRecoveryModal';
import { CascadeBody } from './CascadeModal';
import { openCombatEndCascade } from '../noyau/combatFlow';
import { RollLine, ANONYMES } from './RollLine';
import { opposedLines } from './breakdown';
import { testDeRegle } from '../engine/reglesChiffrees';
import { testValue } from '../engine/skills';
import { cibleBrute, cibleDuTest, clampTarget, forcedTR } from '../engine/tests';
import { combattantDeModale } from './combattantDeModale.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { poserFicheDeTest, restaurerFiche } from '../engine/ficheDeTest.testkit';
import type { Combatant } from '../engine/types';
import type { PendingBargain } from '../noyau/pendings';

/**
 * Le bornage d'une cible se MESURE là où naît le `TestResult` (`evaluateTest`, `forcedTR`,
 * `engine/tests.ts`) : chaque route d'un jet — tiré, forcé, rangé, reconstruit — en garde la mesure
 * (`cibleBrute` du jet rangé = la cible du constructeur), et sa ligne NOMME l'écrêtage (« plafond » /
 * « plancher »), jamais « autres » (`RollLine.reconciled`). Matrice plafond (donnée réelle) / plancher
 * (fiche posée au seam), sur le vrai flux de chaque modale.
 */
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
let host: HTMLDivElement; let root: Root;
beforeEach(() => { vi.useFakeTimers(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); ANONYMES.count = 0; });
afterEach(() => {
  act(() => root.unmount()); host.remove(); restaurerFiche(); vi.clearAllTimers(); vi.useRealTimers();
  useGame.setState({ battle: null, pendingRun: null, pendingApproach: null, pendingWard: null, pendingCorruption: null, pendingStateRecovery: null, pendingBargain: null, pendingFall: null, pendingCascade: null, party: [], mode: 'exploration' } as never);
});
const g = () => useGame.getState();
/** Les chips de la PREMIÈRE ligne de jet rendue. */
const chips = () => Array.from(host.querySelector('.rm-roll-block')?.querySelectorAll('.rm-mod') ?? []).map((c) => c.textContent ?? '');
/** Le calcul (`base ± mods = cible`) de la PREMIÈRE ligne de jet rendue. */
const calcul = () => host.querySelector('.rm-roll-block')?.querySelector('.rm-roll-calc')?.textContent;
/** La ligne nomme l'écrêtage `sens` et rien n'y reste anonyme. */
function nommeLEcretage(sens: 'plafond' | 'plancher', cible: number): void {
  expect(chips().filter((c) => c.endsWith(`${sens} ${cible}`)), chips().join(' | ')).toHaveLength(1);
  expect(ANONYMES.count, chips().join(' | ')).toBe(0);
}
/** Le jet rangé porte la mesure de son constructeur : cible bornée, et sa cible brute retrouvée. */
function porteLaMesure(jet: { target?: number; clamped?: number } | null | undefined, brute: number): void {
  expect(jet?.target).toBe(clampTarget(brute).target);
  expect(cibleBrute({ target: jet!.target!, clamped: jet!.clamped })).toBe(brute);
}

function heroCoureur(): Combatant {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  hero.characteristics = { ...hero.characteristics, agilite: 95 };
  useGame.setState({ party: [hero] });
  g().lancerLaScene(testScene()); g().lancerLeCombat('enc-mutants'); g().fenetreValider('debutDuRound'); vi.clearAllTimers();
  const b = g().battle!; const H = b.combatants.find((c) => c.kind === 'heros')!;
  H.pos = { x: 10, y: 10 }; H.engagedWith = [];
  useGame.setState({ screen: 'campaign', battle: { ...b, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0 }, pendingRun: null });
  g().ensemencerLeTirage(2);
  g().ouvrirLaCourse({ x: 16, y: 10 });
  return H;
}

describe('bornage mesuré au constructeur — les routes des modales', () => {
  it('Course jetée (`runFromTest`) : plafond nommé', () => {
    const H = heroCoureur();
    act(() => root.render(createElement(RunModal)));
    act(() => { g().jetLancer('course'); });
    const p = g().pendingRun!;
    porteLaMesure(p.result, cibleDuTest(testValue(H, p.test), p.test.difficulty));
    nommeLEcretage('plafond', p.result!.target);
  });

  it('Course forcée AVANT le jet (Résilience) : plafond nommé', () => {
    const H = heroCoureur();
    act(() => root.render(createElement(RunModal)));
    act(() => { g().jetForcerLaReussite('course'); });
    const p = g().pendingRun!;
    porteLaMesure(p.result, cibleDuTest(testValue(H, p.test), p.test.difficulty));
    nommeLEcretage('plafond', p.result!.target);
  });

  it('Approche (`simpleRoll` sous `result`) : plancher nommé', () => {
    poserFicheDeTest();
    const H = combattantDeModale('H'); (H.characteristics as Record<string, number>).sociabilite = 5;
    const test = testDeRegle('calme-d-approche', 'se-rapprocher');
    useGame.setState({
      battle: { combatants: [H, combattantDeModale('Ogre', 'ennemi')], log: [] },
      pendingApproach: { combatantId: 'H', test, sourceId: 'Ogre', intent: { kind: 'tile', pt: { x: 1, y: 0 } }, result: null },
    } as never);
    act(() => root.render(createElement(ApproachModal)));
    act(() => { g().jetLancer('approche'); });
    porteLaMesure(g().pendingApproach!.result, cibleDuTest(testValue(H, test), test.difficulty));
    nommeLEcretage('plancher', 1);
  });

  it('Corruption (`simpleRoll` à plat) : plancher nommé', () => {
    poserFicheDeTest();
    const H = combattantDeModale('H'); (H.characteristics as Record<string, number>).intelligence = 10;
    const test = testDeRegle('influences-corruptrices', 'physique');
    useGame.setState({ party: [H], battle: null, pendingCorruption: { heroId: 'H', kind: 'exposition', level: 'mineure', nature: 'physique', natureFixee: true, test } } as never);
    act(() => root.render(createElement(CorruptionModal)));
    act(() => { g().jetLancer('corruption'); });
    porteLaMesure(g().pendingCorruption, cibleDuTest(testValue(H, test), test.difficulty));
    nommeLEcretage('plancher', 1);
  });

  it('Se rouler au sol : jet posé puis forcé (Résilience), plancher nommé aux deux', () => {
    const H = combattantDeModale('H');
    useGame.setState({ battle: { combatants: [H], log: [], order: ['H'], turn: 0, round: 1 },
      pendingStateRecovery: { actorId: 'H', state: 'en-flammes', skillLabel: 'Athlétisme', skillValue: 5, skillBase: 5, difficulty: 'tresDifficile', stacks: 1, roll: null, opponentRoll: null, netSL: 0, success: false } } as never);
    act(() => root.render(createElement(StateRecoveryModal)));
    act(() => { g().jetLancer('recuperation'); });
    porteLaMesure(g().pendingStateRecovery!.roll, cibleDuTest(5, 'tresDifficile'));
    nommeLEcretage('plancher', 1);
    act(() => { g().jetForcerLaReussite('recuperation'); });
    porteLaMesure(g().pendingStateRecovery!.roll, cibleDuTest(5, 'tresDifficile'));
    nommeLEcretage('plancher', 1);
  });
});

describe('Résilience AVANT le jet, voie binaire : le jet forcé affronte la cible annoncée (LDB 17 l.68)', () => {
  /** La pré-ligne annonce une cible ; la ligne du jet forcé la reprend telle quelle, sans « autres ». */
  function forceAvantLeJet(force: () => void): void {
    const pre = calcul();
    act(force);
    expect(calcul()).toBe(pre);
    expect(ANONYMES.count, chips().join(' | ')).toBe(0);
  }

  it('Bénédiction de Protection (Accessible, donnée réelle)', () => {
    const A = combattantDeModale('A'); A.resilience = 2;
    useGame.setState({ battle: { combatants: [A, combattantDeModale('Cible', 'ennemi')], log: [] }, pendingWard: { attackerId: 'A', targetId: 'Cible', result: null } } as never);
    act(() => root.render(createElement(WardModal)));
    forceAvantLeJet(() => g().jetForcerLaReussite('protection'));
    porteLaMesure(g().pendingWard!.result, cibleDuTest(testValue(A, { characteristic: 'force-mentale' }), 'accessible'));
  });

  for (const fiche of ['reelle', 'posee'] as const) it(`Approche (fiche ${fiche === 'posee' ? 'posée au seam' : 'réelle'})`, () => {
    if (fiche === 'posee') poserFicheDeTest();
    const H = combattantDeModale('H'); H.resilience = 2;
    const test = testDeRegle('calme-d-approche', 'se-rapprocher');
    useGame.setState({ battle: { combatants: [H, combattantDeModale('Ogre', 'ennemi')], log: [] },
      pendingApproach: { combatantId: 'H', test, sourceId: 'Ogre', intent: { kind: 'tile', pt: { x: 1, y: 0 } }, result: null } } as never);
    act(() => root.render(createElement(ApproachModal)));
    forceAvantLeJet(() => g().jetForcerLaReussite('approche'));
    porteLaMesure(g().pendingApproach!.result, cibleDuTest(testValue(H, test), test.difficulty));
  });
});

describe('rangée de bande à cible au-delà du plafond : l’écrêtage mesuré se nomme sans autre poste', () => {
  it('Exposition à la Corruption de fin de combat, Résistance 100 : « −1 plafond 99 » avant, après le jet et au bilan', () => {
    const H = { ...combattantDeModale('H'), characteristics: { ...combattantDeModale('H').characteristics, endurance: 95 }, skills: [{ id: 'resistance', advances: 5, characteristic: 'endurance' }] } as Combatant;
    const bete = { ...combattantDeModale('Bete', 'ennemi'), dead: true, traits: [{ id: 'corruption', arg: 'mineure' }] } as Combatant;
    useGame.setState({
      mode: 'battle', party: [H], pendingCascade: null, suspendedCascades: [],
      net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
      battle: { combatants: [H, bete], order: ['H', 'Bete'], baseOrder: ['H', 'Bete'], turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false, log: [], over: null },
    } as never);
    openCombatEndCascade(g, useGame.setState);
    const rangee = () => g().pendingCascade!.participants.find((st) => st.kind === 'corruptionDeFinDeCombat')!.participants!.find((r) => r.id === 'H')!;
    expect(rangee().target).toBe(clampTarget(cibleDuTest(testValue(H, { skill: { id: 'resistance' } }))).target);
    act(() => root.render(createElement(CascadeBody)));
    nommeLEcretage('plafond', 99);
    act(() => { g().jetLancer('cascadeEnBande', 'H'); });
    nommeLEcretage('plafond', 99);
    // Bilan (« Tout lancer ») : la rangée témoin du pas validé garde sa mesure.
    act(() => { g().jetLancer('cascade'); });
    expect(host.textContent).toContain('Bilan');
    nommeLEcretage('plafond', 99);
  });
});

describe('pré-ligne d’un Test opposé : la cible annoncée est celle que le dé affrontera', () => {
  it('Marchandage soutenu au-delà du plafond : « = 99 », écrêtage nommé', () => {
    const H = combattantDeModale('H');
    useGame.setState({ party: [H] } as never);
    const noop = () => {};
    const pb = { playerId: 'H', playerName: 'H', contrepartie: {}, opposant: { valeur: 40 }, playerSkill: 125, support: { count: 3, bonus: 30 }, playerBase: 95, negotiator: false, roll: null, merchantRoll: null, result: null };
    act(() => root.render(createElement(BargainModalView, { pb: pb as PendingBargain, actor: H, fortune: 0, onRoll: noop, onReroll: noop, onBonusSL: noop, onConfirm: noop, onCancel: noop })));
    expect(calcul()).toMatch(/= 99$/);
    nommeLEcretage('plafond', 99);
  });
});

describe('bornage mesuré au constructeur — routes sans modale montée', () => {
  it('Marchandage forcé AVANT le jet : la cible du joueur est bornée et mesurée', () => {
    const hero = combattantDeTest({ id: 'H', label: 'H', kind: 'heros', resilience: 5, fortune: 0, items: [] });
    useGame.setState({ party: [hero], pendingBargain: { playerId: 'H', merchantId: 'm', playerSkill: 125, merchantRoll: { roll: 20, target: 50, sl: 3, success: true, isDouble: false }, roll: null } } as never);
    g().jetForcerLaReussite('marchandage');
    porteLaMesure(g().pendingBargain!.roll, cibleDuTest(125));
  });

  it('Chute volontaire forcée AVANT le jet : la cible est bornée et mesurée', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.characteristics = { ...hero.characteristics, agilite: 150 };
    const s = emptyScene('scene-test', 4, 4); const h = new Array(16).fill(0) as number[]; h[2] = 4; s.layers[0].height = h;
    useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: { x: 2, y: 0 }, scene: s, pendingFall: null, pendingCascade: null });
    g().franchirLArete({ x: 2, y: 1 });
    g().jetRegler('chute', 'tenter', true, hero.id);
    g().jetForcerLaReussite('chute', hero.id);
    const p = g().pendingFall!;
    porteLaMesure(p.participants.find((x) => x.id === hero.id)!.result, cibleDuTest(testValue(hero, p.test), p.test.difficulty));
  });

  it('forcedTR construit d’une VALEUR au-delà du plafond : ligne sans « autres »', () => {
    for (const valeur of [115, 105]) {
      const force = forcedTR(1, valeur, 3);
      porteLaMesure(force, valeur);
      const [ligne] = opposedLines([{ label: 'X', base: valeur, r: force }]);
      const h = document.createElement('div'); document.body.appendChild(h); const r = createRoot(h);
      act(() => r.render(createElement(RollLine, { d: ligne.d! })));
      expect(ANONYMES.count, h.textContent ?? '').toBe(0);
      act(() => r.unmount()); h.remove();
    }
  });
});
