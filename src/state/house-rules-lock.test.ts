import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { setHouseRule, resetHouseRule, houseRulesMutability } from './houseRules';
import { rule, resetRule, setRule, OPTIONAL_RULES } from '../engine/policy';
import { setPreference, resetPreference } from './preferences';
import { cadence } from '../engine/cadence';
import { resolveRoundBoundary } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';

/**
 * VERROU des règles optionnelles pendant un combat (#564, #1049) — garde d'INGÉNIERIE : elle ne dit
 * rien des règles du jeu, elle empêche des états applicatifs incohérents.
 *
 * Le moteur lit `rule(id)` EN DIRECT : muter une entrée alors qu'une bataille est en cours rétroagit
 * sur un état déjà construit à l'ouverture. Cas mesuré (#564) : activer « Avantage de groupe » en plein
 * combat faisait naître la réserve de camp À ZÉRO au premier `poolsOf`, et `mirrorPools` écrasait
 * l'Avantage individuel de TOUS les combattants. La porte vit au point d'ÉCRITURE joueur
 * (`state/houseRules`), pas dans l'UI, et vaut pour la CLASSE entière (aucun id nommé).
 */

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

function startFixtureCombat() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene());
  seedBattleRng(777);
  useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
  return useGame.getState().battle!;
}

describe('Règles optionnelles — verrouillées tant qu’un combat est en cours', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    useGame.setState({ battle: null, pendingCascade: null, pendingRoundStart: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    useGame.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('hors combat : l’écriture passe (aucune régression du panneau)', () => {
    expect(houseRulesMutability().mutable).toBe(true);
    setHouseRule('combat-aa-avantage-groupe', true);
    expect(rule('combat-aa-avantage-groupe')).toBe(true);
    resetHouseRule('combat-aa-avantage-groupe');
    expect(rule('combat-aa-avantage-groupe')).toBe(false);
  });

  it('en combat : `setHouseRule` REFUSE la mutation et porte sa raison en texte', () => {
    startFixtureCombat();
    const gate = houseRulesMutability();
    expect(gate.mutable).toBe(false);
    expect(gate.reason).toMatch(/combat/i);
    setHouseRule('combat-aa-avantage-groupe', true);
    expect(rule('combat-aa-avantage-groupe')).toBe(false); // la règle n’a pas bougé
  });

  it('en combat : `resetHouseRule` refuse aussi (le retour au défaut RAW est une mutation)', () => {
    setHouseRule('combat-aa-avantage-groupe', true); // choisie AVANT le combat
    startFixtureCombat();
    resetHouseRule('combat-aa-avantage-groupe');
    expect(rule('combat-aa-avantage-groupe')).toBe(true); // le combat garde le modèle sous lequel il s’est ouvert
  });

  it('le verrou vaut pour TOUTE la classe, SANS exception : aucune entrée du registre n’est mutable en combat', () => {
    startFixtureCombat();
    const mutables = OPTIONAL_RULES.filter(() => houseRulesMutability().mutable).map((r) => r.id);
    expect(mutables).toEqual([]);
  });

  it('le CONFORT n’est pas une exemption du registre : il n’y est PAS — la Cadence reste réglable en plein combat (#839)', () => {
    startFixtureCombat();
    expect(OPTIONAL_RULES.some((r) => r.id === 'combat-cadence')).toBe(false);
    setPreference('combat-cadence', 'auto');
    expect(cadence()).toBe('auto');
    resetPreference('combat-cadence');
    expect(cadence()).toBe('manuel');
  });

  it('combat ouvert le combat fini : la porte se rouvre', () => {
    const battle = startFixtureCombat();
    useGame.setState({ battle: { ...battle, over: 'victory' } });
    expect(houseRulesMutability().mutable).toBe(true);
  });

  it('#564 — activer « Avantage de groupe » en plein combat ne détruit plus l’Avantage accumulé', () => {
    const battle = startFixtureCombat();
    expect(battle.advantagePools).toBeUndefined(); // combat ouvert sous le modèle du Livre de base
    const hero = battle.combatants.find((c) => c.kind === 'hero')!;
    const foe = battle.combatants.find((c) => c.kind === 'enemy')!;
    hero.advantage = 4;
    foe.advantage = 2;
    setHouseRule('combat-aa-avantage-groupe', true); // le joueur bascule au menu système, en plein combat
    resolveRoundBoundary(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!;
    expect(after.advantagePools).toBeUndefined(); // aucune réserve née à zéro
    expect(after.combatants.find((c) => c.id === hero.id)!.advantage).toBe(3); // décroissance LDB 14 l.219, pas un écrasement
    expect(after.combatants.find((c) => c.id === foe.id)!.advantage).toBe(1);
  });
});

/** Contre-preuve : la MÊME bascule, forcée sous le registre du moteur (chemin que la porte ferme au
 *  joueur), détruit bien l'Avantage — c'est le bug que le verrou rend inatteignable. */
describe('#564 — le bug, sans la porte (écriture directe du registre moteur)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null, pendingCascade: null, pendingRoundStart: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    useGame.setState({ battle: null });
    for (const r of OPTIONAL_RULES) resetRule(r.id);
  });

  it('réserve née à zéro → l’Avantage de tous les combattants est écrasé', () => {
    const battle = startFixtureCombat();
    const hero = battle.combatants.find((c) => c.kind === 'hero')!;
    hero.advantage = 4;
    setRule('combat-aa-avantage-groupe', true); // primitive PURE du moteur : ne connaît pas la partie
    resolveRoundBoundary(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!.advantage).toBe(0);
  });
});
