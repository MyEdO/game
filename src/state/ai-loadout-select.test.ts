/**
 * Sélection de LOADOUT par l'IA (héros auto + ennemis à plusieurs sets) — `aiSelectLoadout` (combatFlow),
 * appelée en tête de `runEnemyAI` AVANT `buildAiInput`. Un combattant qui porte un set À DISTANCE et un set
 * de MÊLÉE dégaine le bon : son arme à distance quand AUCUN adversaire ne l'engage (il tire/kite), son arme
 * de mêlée au contact. Sans ça, un Chasseur dont la fronde est en set 2 (épée active en set 1) ne tirait
 * JAMAIS (retour playtest 2026-06-27 : « le chasseur charge à l'arme simple alors qu'il a une fronde »).
 *
 * Le switch est SYNCHRONE en tête de `runEnemyAI` (avant tout timer) → on le lit juste après l'appel.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { makeShowcaseParty } from '../data/pregens';
import { scenario as embuscade } from '../scenes/test-scenarios/embuscade';
import { runEnemyAI } from './combatFlow';
const embuscadeConstruit = embuscade.construire();

describe('IA — sélection de loadout tir/mêlée (Chasseur fronde)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    useGame.setState({ party: makeShowcaseParty() });
    useGame.getState().startScene(embuscadeConstruit.scene);
    useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const ael = b.combatants.find((c) => /aelindra/i.test(c.label))!; // PREGEN.chasseur (fronde + arme simple)
    // Héros AUTO (cf. en-tête) : `runEnemyAI` ne joue QUE des combattants `aiDriven` — pour un héros,
    // c'est le drapeau `aiControlled` (ou l'Auto-combat). Sans lui, la fixture ferait jouer par l'IA un
    // héros piloté à la main, situation qu'aucun chemin réel ne produit (`maybeRunEnemyTurn`).
    ael.aiControlled = true;
    // donne le tour à Aelindra
    useGame.setState({ battle: { ...b, order: [ael.id, ...b.order.filter((id) => id !== ael.id)], turn: 0, action: null } });
    return ael.id;
  }
  const weaponsOf = (id: string) => (useGame.getState().battle!.combatants.find((c) => c.id === id)!.weapons ?? []).map((w) => w.type);

  it('aucun adversaire au contact → dégaine son arme À DISTANCE (la fronde), pas l’arme simple', () => {
    const id = setup();
    // état initial : loadout mêlée actif (arme simple)
    expect(weaponsOf(id)).toContain('melee');
    expect(weaponsOf(id)).not.toContain('ranged');
    runEnemyAI(useGame.getState, useGame.setState, id); // switch SYNCHRONE en tête
    const ranged = useGame.getState().battle!.combatants.find((c) => c.id === id)!.weapons!.find((w) => w.type === 'ranged');
    expect(ranged?.label).toMatch(/fronde/i); // a dégainé la fronde
  });

  it('un adversaire au CONTACT → garde/dégaine son arme de MÊLÉE (ne dégaine pas la fronde au corps à corps)', () => {
    const id = setup();
    // colle un ennemi adjacent à Aelindra
    const b = useGame.getState().battle!;
    const ael = b.combatants.find((c) => c.id === id)!;
    const foe = b.combatants.find((c) => c.kind === 'enemy' && !c.dead)!;
    foe.pos = { x: ael.pos!.x + 1, y: ael.pos!.y };
    useGame.setState({ battle: { ...b } });
    runEnemyAI(useGame.getState, useGame.setState, id);
    const w = useGame.getState().battle!.combatants.find((c) => c.id === id)!.weapons!;
    expect(w.some((x) => x.type === 'melee')).toBe(true); // arme de mêlée disponible au contact
    expect(w.find((x) => x.type === 'ranged')).toBeUndefined(); // pas la fronde au corps à corps
  });
});
