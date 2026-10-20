// @vitest-environment jsdom
/**
 * Un porteur d'État sur chaque modale de Test : AVANT et APRÈS le jet, la ligne nomme la pénalité
 * d'État (LDB 16 l.125), la somme des termes du calcul égale sa cible, et cette cible est celle de la
 * valeur de Test (`valeurDuTest`, bornée par `clampTarget`) que le jet affronte.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { emptyScene } from '../noyau/monde/scene';
import { heroFaceAUnEnnemi } from '../state/combatDeTest.testkit';
import { openAttackCascade } from '../noyau/combatFlow';
import { WardModal } from './WardModal';
import { FrenzyModal } from './FrenzyModal';
import { ApproachModal } from './ApproachModal';
import { RunModal } from './RunModal';
import { CorruptionModal } from './CorruptionModal';
import { FallModal } from './FallModal';
import { DisengageModal } from './DisengageModal';
import { HandGateModal } from './HandGateModal';
import { ANONYMES } from './RollLine';
import { testBreakdown } from './breakdown';
import { testDeRegle } from '../engine/reglesChiffrees';
import { valeurDuTest, type TestDesigne } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { cibleDuTest, clampTarget } from '../engine/tests';
import { refLabel } from '../data';
import { combattantDeModale } from './combattantDeModale.testkit';
import { fleeTouche } from '../noyau/pendings';
import type { Combatant, Difficulty } from '../engine/types';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
let host: HTMLDivElement; let root: Root;
const g = () => useGame.getState();
beforeEach(() => { vi.useFakeTimers(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); ANONYMES.count = 0; });
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers();
  useGame.setState({ battle: null, party: [], pendingWard: null, pendingApproach: null, pendingRun: null, pendingFrenzy: null, pendingCorruption: null, pendingFall: null, pendingDisengage: null, pendingHandGate: null, pendingAttack: null, pendingCascade: null } as never);
});

const num = (s: string) => Number(s.replace('−', '-').replace('+', ''));
/** Chips, somme des termes et cible du calcul de la ligne de jet (la première, ou celle qui porte `label`). */
function ligne(label?: string) {
  const blocs = [...host.querySelectorAll('.rm-roll-block')];
  const b = label ? blocs.find((x) => (x.textContent ?? '').includes(label)) : blocs[0];
  const [gauche, droite] = (b?.querySelector('.rm-roll-calc')?.textContent ?? '').split('=');
  const termes = (gauche ?? '').trim().split(/\s+/).filter(Boolean).map(num);
  return {
    chips: Array.from(b?.querySelectorAll('.rm-mod') ?? []).map((c) => c.textContent ?? ''),
    somme: termes.reduce((a, x) => a + x, 0),
    cible: droite != null ? num(droite.trim()) : termes[0],
  };
}
function nommeLEtat(quand: string, attendue: number, label?: string, chip = '−30 Sonné'): void {
  const l = ligne(label);
  expect(l.chips, quand).toContain(chip);
  expect(l.somme, `${quand} : somme des termes`).toBe(l.cible);
  expect(l.cible, `${quand} : cible`).toBe(attendue);
  expect(ANONYMES.count, `${quand} : ${l.chips.join(' | ')}`).toBe(0);
}
const sonne = <T extends Combatant>(c: T): T => { c.conditions = [{ id: 'sonne', value: 3 }]; return c; };
const cible = (c: Combatant, test: TestDesigne, d: Difficulty) => clampTarget(cibleDuTest(valeurDuTest(c, test), d)).target;
const FM: TestDesigne = { char: 'force-mentale' };

describe('chip d’État sur les modales de Test, avant et après le jet (LDB 16 l.125)', () => {
  it('Bénédiction de Protection', () => {
    const A = sonne(combattantDeModale('A'));
    const att = cible(A, FM, 'accessible');
    expect(att, 'Sonné ×3 : −30').toBe(clampTarget(cibleDuTest(effectiveChar(A, 'force-mentale') - 30, 'accessible')).target);
    useGame.setState({ battle: { combatants: [A, combattantDeModale('Cible', 'enemy')], log: [] }, pendingWard: { attackerId: 'A', targetId: 'Cible', targetName: 'Cible', result: null } } as never);
    act(() => root.render(createElement(WardModal)));
    nommeLEtat('avant', att);
    act(() => { g().wardRoll(); });
    expect(g().pendingWard!.result!.target).toBe(att);
    nommeLEtat('après', att);
  });

  it('Frénésie', () => {
    const { H } = heroFaceAUnEnnemi(); sonne(H); H.traits = [{ id: 'frenesie' }];
    g().battleFrenzy();
    const att = cible(H, FM, 'intermediaire');
    act(() => root.render(createElement(FrenzyModal)));
    nommeLEtat('avant', att);
    act(() => { g().frenzyRoll(); });
    expect(g().pendingFrenzy!.result!.target).toBe(att);
    nommeLEtat('après', att);
  });

  it('Main ensanglantée', () => {
    const { H, E } = heroFaceAUnEnnemi(); sonne(H); H.handGates = ['main'];
    openAttackCascade(g, useGame.setState, { attackerId: H.id, targetId: E.id, location: null, result: null }, 'Attaque', 'action/attack');
    const att = cible(H, { char: 'dexterite' }, 'accessible');
    act(() => root.render(createElement(HandGateModal)));
    nommeLEtat('avant', att);
    act(() => { g().handGateRoll(); });
    expect(g().pendingHandGate!.target).toBe(att);
    nommeLEtat('après', att);
  });

  it('Approche', () => {
    const H = sonne(combattantDeModale('H'));
    const test = testDeRegle('calme-d-approche', 'se-rapprocher');
    const att = cible(H, test, test.difficulty);
    useGame.setState({ battle: { combatants: [H, combattantDeModale('Ogre', 'enemy')], log: [] },
      pendingApproach: { combatantId: 'H', test, sourceId: 'Ogre', sourceName: 'Ogre', intent: { kind: 'tile', pt: { x: 1, y: 0 } }, result: null } } as never);
    act(() => root.render(createElement(ApproachModal)));
    nommeLEtat('avant', att);
    act(() => { g().approachRoll(); });
    expect(g().pendingApproach!.result!.target).toBe(att);
    nommeLEtat('après', att);
  });

  it('Course (Exténué ×3)', () => {
    const { H } = heroFaceAUnEnnemi(); H.conditions = [{ id: 'extenue', value: 3 }];
    g().battleRun({ x: 16, y: 10 });
    const p = g().pendingRun!;
    const att = cible(H, p.test, p.test.difficulty);
    act(() => root.render(createElement(RunModal)));
    nommeLEtat('avant', att, undefined, '−30 Exténué');
    act(() => { g().runRoll(); });
    expect(g().pendingRun!.result!.target).toBe(att);
    nommeLEtat('après', att, undefined, '−30 Exténué');
  });

  it('Corruption', () => {
    const H = sonne(combattantDeModale('H'));
    const test = testDeRegle('influences-corruptrices', 'physique');
    const att = cible(H, test, test.difficulty);
    useGame.setState({ party: [H], battle: null, pendingCorruption: { heroId: 'H', kind: 'exposition', level: 'mineure', nature: 'physique', natureFixee: true, test } } as never);
    act(() => root.render(createElement(CorruptionModal)));
    nommeLEtat('avant', att);
    act(() => { g().corruptionRoll(); });
    expect(g().pendingCorruption!.target).toBe(att);
    nommeLEtat('après', att);
  });

  it('Chute', () => {
    const hero = sonne(createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 }));
    const s = emptyScene(4, 4); s.layers[0].height = Array.from({ length: 16 }, (_, i) => (i === 2 ? 4 : 0));
    useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: { x: 2, y: 0 }, scene: s, pendingFall: null, pendingCascade: null } as never);
    g().fallAcross({ x: 2, y: 0 }, { x: 2, y: 1 });
    g().fallChoose(hero.id, true);
    const p = g().pendingFall!;
    const att = cible(hero, p.test, p.test.difficulty);
    const lab = refLabel('skills', p.test.skill);
    act(() => root.render(createElement(FallModal)));
    nommeLEtat('avant', att, lab);
    act(() => { g().fallRoll(hero.id); });
    expect(g().pendingFall!.participants[0].result!.target).toBe(att);
    nommeLEtat('après', att, lab);
  });

  it('Fuite (Test du fuyard)', () => {
    const test = testDeRegle('fuite', 'touche-en-fuyant');
    const F = sonne(combattantDeModale('Héros'));
    const att = cible(F, test, test.difficulty);
    useGame.setState({ battle: { combatants: [F, combattantDeModale('Brute', 'enemy')], log: [], order: ['Héros', 'Brute'], turn: 0, round: 1 } as never,
      pendingDisengage: { moverId: 'Héros', foeId: 'Brute', canSacrifice: false, canEsquive: true, phase: 'fuir', atk: null, def: null, result: null,
        fuir: { participants: [
          { id: 'Brute', kind: 'backstab', interactive: true, result: { hit: true, woundsLost: 3, attackerDetail: testBreakdown('Corps à corps', 65, { roll: 20, target: 65, sl: 4, success: true }) } },
          { id: 'Héros', kind: 'touche', interactive: true, test, jet: null },
        ] } } } as never);
    const lab = refLabel('skills', test.skill);
    act(() => root.render(createElement(DisengageModal)));
    nommeLEtat('avant', att, lab);
    act(() => { g().fleeRoll('Héros'); });
    expect(fleeTouche(g().pendingDisengage!)!.jet!.target).toBe(att);
    nommeLEtat('après', att, lab);
  });
});
