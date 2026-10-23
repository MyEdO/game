import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { chooseEnemyAction } from '../noyau/monde/ai';
import { runEnemyAI, aiTurnLog, clearAiTurnLog, buildAiInput } from '../noyau/combatFlow';
import { spawnEnemy } from '../noyau/monde/spawn';
import { engagesEnAction } from '../noyau/monde/combatants';
import { pregen, PREGEN } from '../data/pregens';
import { stacks } from '../engine/conditions';
import { chebyshev } from '../engine/grid';
import { battleRng, seedBattleRng } from '../noyau/battleRng';
import type { Combatant } from '../engine/types';

/**
 * IA : un acteur VERROUILLÉ (`restrictsAction`, ex. Brisé) dépense PROACTIVEMENT sa Détermination
 * pour se RESSAISIR (retirer l'État, LDB 17 l.57-61) au lieu de fuir/subir tout le combat. GÉNÉRIQUE et
 * data-driven (aucun nom d'État en dur) : la décision PURE vit dans `chooseEnemyAction` (`spendResource`),
 * l'exécution dans `runEnemyAI` (dépense via l'action store `spendResolveCondition`, puis vraie action).
 * Sans Détermination, l'Engagé que sa fuite oblige à partir (Brisé LDB 16 l.52, Bestial LDB 85 l.59) se
 * Désengage d'abord par le flux du joueur (LDB 15 l.47-49).
 */
const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 12, h: 12 }, layers: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const sword = [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }];

const CHARS = { 'capacite-de-combat': 35, 'capacite-de-tir': 35, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
/** Ennemi minimal pour la DÉCISION pure : pos + arme de mêlée + caracs + États/Détermination paramétrés.
 *  (Les caracs servent au cœur de scoring atteint quand l'ennemi n'est PAS verrouillé — `pickDoctrine`.) */
function foe(over: Partial<Combatant>): Combatant {
  return { id: 'e', kind: 'enemy', name: 'E', pos: { x: 5, y: 5 }, weapons: sword, characteristics: CHARS, skills: [], conditions: [], wounds: { current: 10, max: 10 }, advantage: 0, traits: [], size: 'moyenne', engagedWith: [], psychState: [], ...over } as unknown as Combatant;
}
const hero = (x: number, y: number): Combatant => ({ id: 'h', kind: 'hero', name: 'H', pos: { x, y }, wounds: { current: 10, max: 10 }, conditions: [], characteristics: CHARS, traits: [], size: 'moyenne', advantage: 0, weapons: [], armour: {} } as unknown as Combatant);
const decide = (enemy: Combatant, heroes: Combatant[]) =>
  chooseEnemyAction({ enemy, heroes, scene: scene(), blocked: new Set<string>(), movement: 4 } as never);

describe('IA Brisé — dépense PROACTIVE de Détermination (LDB 17 l.57-61), data-driven', () => {
  it('Engagé + Détermination suffisante → se RESSAISIT (spendResource resolve→removeCondition brise)', () => {
    const enemy = foe({ conditions: [{ id: 'brise', value: 1 }], resolve: 1, engagedWith: ['h'] });
    const action = decide(enemy, [hero(6, 5)]); // héros adjacent
    expect(action).toEqual({ kind: 'spendResource', resource: 'resolve', via: 'removeCondition', id: 'brise' });
    expect(enemy.resolve).toBe(1); // décision PURE : ne dépense rien (l'exécution est dans le store)
  });

  it('anti-gaspi : Détermination INSUFFISANTE pour nettoyer entièrement → PAS de dépense', () => {
    const enemy = foe({ conditions: [{ id: 'brise', value: 2 }], resolve: 1 }); // non Engagé, héros loin
    const action = decide(enemy, [hero(11, 5)]);
    expect(action.kind).not.toBe('spendResource'); // clear partiel inutile → on ne gaspille pas
    expect(action.kind).toBe('move'); // → fuite (Brisé non Engagé)
    expect(enemy.resolve).toBe(1); // pool intact
  });

  it('pool absent (Détermination 0) → comportement inchangé (fuite), aucune dépense', () => {
    const enemy = foe({ conditions: [{ id: 'brise', value: 1 }], resolve: 0 });
    const action = decide(enemy, [hero(11, 5)]);
    expect(action.kind).toBe('move');
  });

  it('non-régression : un ennemi NON verrouillé ne propose JAMAIS spendResource', () => {
    const enemy = foe({ conditions: [], resolve: 2, engagedWith: ['h'] });
    const action = decide(enemy, [hero(6, 5)]);
    expect(action.kind).not.toBe('spendResource');
  });
});

describe('IA Brisé — dispatch : la dépense retire l\'État puis une vraie action suit le MÊME tour', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); clearAiTurnLog(); useGame.setState({ battle: null, party: [] }); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ennemi Brisé+Détermination, Engagé → spendResolveCondition retire le Brisé (−1 Détermination), action réelle dispatchée', () => {
    const e = spawnEnemy({ ref: 'brigand' }, 'e', { x: 5, y: 5 });
    e.kind = 'enemy';
    e.conditions = [{ id: 'brise', value: 1 }];
    e.resolve = 1;
    e.engagedWith = ['h'];
    e.movement = 4;
    const h = pregen(PREGEN.sorcier);
    h.id = 'h'; h.pos = { x: 6, y: 5 }; h.wounds = { ...h.wounds, max: 30, current: 30 }; // adjacent → mêlée après déverrouillage
    const battle = {
      combatants: [e, h], order: ['e', 'h'], baseOrder: ['e', 'h'], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, scene: scene(), party: [], partyPos: { x: 0, y: 0 } });

    runEnemyAI(useGame.getState, useGame.setState, e.id);

    // La boucle de dépense est SYNCHRONE (avant le télégraphe différé) : le Brisé est retiré, la Détermination consommée.
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'e')!;
    expect(stacks(after, 'brise')).toBe(0);
    expect(after.resolve).toBe(0);
    // La trace enregistre la VRAIE action choisie après déverrouillage (pas une dépense).
    const log = aiTurnLog();
    const last = log[log.length - 1];
    expect(last?.action.startsWith('spend')).toBe(false);
  });
});

describe('IA Engagée : la fuite obligée passe par le Désengagement (LDB 15 l.47-49)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); clearAiTurnLog(); useGame.setState({ battle: null, party: [], pendingDisengage: null, pendingCascade: null }); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** `e` (brigand) Engagé au contact du héros `h` ; `de` : les d100 du combat, dans l'ordre (jet figé de
   *  l'adversaire, puis Esquive de `e`), 50 ensuite. */
  function poser(e: Partial<Combatant>, des: number[] = []) {
    const ennemi = spawnEnemy({ ref: 'brigand' }, 'e', { x: 5, y: 5 });
    Object.assign(ennemi, { kind: 'enemy', engagedWith: ['h'], movement: 4, resolve: 0 }, e);
    const heros = pregen(PREGEN.sorcier);
    heros.id = 'h'; heros.pos = { x: 6, y: 5 }; heros.engagedWith = ['e']; heros.wounds = { ...heros.wounds, max: 30, current: 30 };
    const battle = {
      combatants: [ennemi, heros], order: ['e', 'h'], baseOrder: ['e', 'h'], turn: 0, round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, scene: scene(), party: [], partyPos: { x: 0, y: 0 } });
    const file = [...des];
    battleRng().int = () => file.shift() ?? 50;
    return { ennemi, heros };
  }
  const journal = (): string[] => useGame.getState().battle!.log.map((l) => l.text);
  const jouer = () => { runEnemyAI(useGame.getState, useGame.setState, 'e'); vi.runOnlyPendingTimers(); vi.runOnlyPendingTimers(); };
  const BRISE = { conditions: [{ id: 'brise', value: 1 }] } as Partial<Combatant>;
  const BESTIAL_BLESSE = { traits: [{ id: 'bestial' }], wounds: { current: 4, max: 10 } } as Partial<Combatant>;

  it('Brisé Engagé, Avantage supérieur : il le sacrifie (l.47), puis fuit hors du contact', () => {
    const { ennemi, heros } = poser({ ...BRISE, advantage: 2 });
    jouer();
    expect(journal()).toContain(`${ennemi.label} se désengage en sacrifiant son Avantage.`);
    expect(ennemi.engagedWith).toEqual([]);
    expect(chebyshev(ennemi.pos!, heros.pos!)).toBeGreaterThan(1);
    expect(useGame.getState().pendingDisengage).toBeNull();
  });

  it('Brisé Engagé : Esquive réussie (l.49), il fuit sur son seul Mouvement, ni Course ni attaque', () => {
    const { ennemi, heros } = poser(BRISE, [99, 5]);
    jouer();
    expect(journal()).toContain(`${ennemi.label} se désengage (Esquive réussie, +1 Avantage).`);
    expect(journal().some((l) => l.startsWith(`${ennemi.label} prend sa Course`))).toBe(false);
    expect(ennemi.engagedWith).toEqual([]);
    expect(chebyshev(ennemi.pos!, heros.pos!)).toBeGreaterThan(1);
    expect(useGame.getState().pendingDefense ?? null).toBeNull();
  });

  it('Brisé Engagé : Esquive manquée, il reste Engagé à sa place et ne frappe pas', () => {
    const { ennemi, heros } = poser(BRISE, [5, 99]);
    jouer();
    expect(journal()).toContain(`${ennemi.label} échoue à se désengager ; ${heros.label} gagne +1 Avantage.`);
    expect(ennemi.engagedWith).toEqual(['h']);
    expect(ennemi.pos).toEqual({ x: 5, y: 5 });
    expect(aiTurnLog()[aiTurnLog().length - 1]?.action).toBe('disengage');
    expect(useGame.getState().pendingDefense ?? null).toBeNull();
  });

  it('Bestial blessé Engagé, non acculé : il se Désengage puis fuit (LDB 85 l.59)', () => {
    const { ennemi, heros } = poser({ ...BESTIAL_BLESSE, advantage: 2 });
    jouer();
    expect(journal()).toContain(`${ennemi.label} se désengage en sacrifiant son Avantage.`);
    expect(chebyshev(ennemi.pos!, heros.pos!)).toBeGreaterThan(1);
  });

  it('Bestial blessé Engagé : Esquive manquée, il reste Engagé', () => {
    const { ennemi } = poser(BESTIAL_BLESSE, [5, 99]);
    jouer();
    expect(ennemi.engagedWith).toEqual(['h']);
    expect(ennemi.pos).toEqual({ x: 5, y: 5 });
  });

  it('les Engagés qui clouent l’IA sont ceux que quitte son déplacement (`engagesEnAction`), camp compris', () => {
    const { ennemi, heros } = poser({ engagedWith: ['a'] });
    heros.engagedWith = []; heros.pos = { x: 10, y: 10 };
    const allie = spawnEnemy({ ref: 'brigand' }, 'a', { x: 5, y: 6 });
    Object.assign(allie, { kind: 'enemy', engagedWith: ['e'] });
    useGame.getState().battle!.combatants.push(allie);
    const entree = buildAiInput(ennemi, useGame.getState);
    expect(entree.engages).toEqual(engagesEnAction(useGame.getState().battle, ennemi));
    expect(entree.engages?.map((c) => c.id)).toEqual(['a']);
    expect(chooseEnemyAction(entree).kind).not.toBe('move');
    allie.dead = true;
    allie.wounds = { ...allie.wounds, current: 0 };
    expect(buildAiInput(ennemi, useGame.getState).engages).toEqual([]);
  });

  it('départ libre (Nuée, LDB 85 l.253) : les liens ne se lèvent, journalisés, que pour le contact quitté', () => {
    const fuite = poser({ ...BRISE, swarm: true });
    jouer();
    expect(chebyshev(fuite.ennemi.pos!, fuite.heros.pos!)).toBeGreaterThan(1);
    expect(fuite.ennemi.engagedWith).toEqual([]);
    expect(journal()).toContain(`${fuite.ennemi.label} quitte librement le corps à corps.`);

    const reste = poser({ swarm: true }, [99]);
    reste.heros.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, duration: { scale: 'rounds', left: 6 }, attackWardFM: true }];
    const autre = pregen(PREGEN.sorcier);
    autre.id = 'b'; autre.pos = { x: 7, y: 6 };
    useGame.getState().battle!.combatants.push(autre);
    jouer();
    expect(aiTurnLog()[aiTurnLog().length - 1]?.action.startsWith('move→b')).toBe(true);
    expect(chebyshev(reste.ennemi.pos!, reste.heros.pos!)).toBe(1);
    expect(reste.ennemi.engagedWith).toEqual(['h']);
    expect(journal()).not.toContain(`${reste.ennemi.label} quitte librement le corps à corps.`);
  });

  it('la ligne de Détermination survit au déplacement qui la suit (état du combat relu)', () => {
    const { ennemi, heros } = poser({ ...BRISE, engagedWith: [], resolve: 1 });
    heros.engagedWith = []; heros.pos = { x: 8, y: 5 };
    jouer();
    expect(journal().some((l) => l.startsWith(`${ennemi.label} puise dans sa Détermination`))).toBe(true);
  });
});
