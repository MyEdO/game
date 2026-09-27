/**
 * #1017 — le chemin COMPLET d'un intent invité, joué chez l'HÔTE : allowlist (`GUEST_INTENTS`) →
 * possession (`intentAllowedFor`) → appel de l'action → EFFET (le pending est posé).
 *
 * Défaut mesuré avant le socle du siège AGISSANT (recette coop, scénario « Battement ») : l'invité
 * clique, l'hôte ACCEPTE l'intent… et rien ne se passe, sans journal ni erreur. La cause n'était pas
 * la route de possession (elle rendait `true`) mais la garde INTERNE de l'action : `battleBattement`
 * (comme les ~30 autres gestes de tour de `combatSlice`) exige `controlsCombatant`, bâti sur
 * `ownsLocally` — donc sur `net.mySeat`, qui vaut l'HÔTE pendant qu'il applique l'intent d'un AUTRE
 * siège. L'action refusait le geste d'un invité sur son PROPRE héros.
 *
 * Ce test exerce la chaîne telle que `netFlow.applyIntent` l'exécute (`withActingSeat`), sur DEUX
 * ouvreurs : `battleBattement` (exposé par #1017) et `battleDisengage` (exposé bien AVANT — il
 * souffrait du même mal, ce qui prouve que la CLASSE est fermée, pas un cas).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

const NET0 = useGame.getState().net;
const chars = { 'capacite-de-combat': 55, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, talents: { talentId: string }[] = []): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents,
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 }, resolve: 2, fortune: 2,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);

/** Arène coop : `h2` (héros du siège 1, Battement en poche) engagé avec `e1`, et c'est SON tour. */
function setup(net: Record<string, unknown> = {}) {
  seedBattleRng(7);
  const hero = mk('h2', 'hero', { x: 0, y: 0 }, [{ talentId: 'battement' }]);
  const enemy = mk('e1', 'enemy', { x: 1, y: 0 });
  (hero as unknown as { engagedWith: string[] }).engagedWith = ['e1'];
  (enemy as unknown as { engagedWith: string[] }).engagedWith = ['h2'];
  const battle: BattleState = {
    combatants: [hero, enemy], order: ['h2', 'e1'], baseOrder: ['h2', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingBattement: null, pendingDisengage: null, pendingCascade: null, pendingAttack: null,
    net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { h2: 1 }, slots: [1, 0, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' }, ...net },
  });
  return { hero, enemy };
}

/** REJOUE `netFlow.applyIntent` (allowlist côté transport + possession + appel AU NOM du siège). */
function applyIntent(seat: number, action: string, args: unknown[] = []): 'hors-allowlist' | 'refusé' | 'appliqué' {
  if (!GUEST_INTENTS.has(action)) return 'hors-allowlist';
  if (!intentAllowedFor(useGame.getState(), seat, action, args)) return 'refusé';
  const fn = (useGame.getState() as unknown as Record<string, unknown>)[action];
  if (typeof fn === 'function') withActingSeat(seat, () => (fn as (...a: unknown[]) => void)(...args));
  return 'appliqué';
}

describe('#1017 — chemin intent invité : l’action AGIT, pas seulement l’allowlist', () => {
  beforeEach(() => { useGame.setState({ net: NET0, battle: null, pendingBattement: null, pendingDisengage: null }); });

  it('battleBattement (ouvreur exposé par #1017) : le siège du héros OUVRE réellement le jet', () => {
    setup();
    expect(applyIntent(1, 'battleBattement', [])).toBe('appliqué');
    const pb = useGame.getState().pendingBattement;
    expect(pb, 'le pending est POSÉ (avant le socle : null, en silence)').toBeTruthy();
    expect(pb!.attackerId).toBe('h2');
    expect(pb!.foeId).toBe('e1');
  });

  it('battleDisengage (intent HISTORIQUE) : la classe entière est fermée, pas le seul Battement', () => {
    setup();
    expect(applyIntent(1, 'battleDisengage', [])).toBe('appliqué');
    expect(useGame.getState().pendingDisengage, 'le Désengagement s’ouvre aussi pour l’invité').toBeTruthy();
  });

  it('siège NON possesseur : l’intent est REFUSÉ en amont, et rien ne bouge', () => {
    setup();
    expect(applyIntent(2, 'battleBattement', [])).toBe('refusé');
    expect(useGame.getState().pendingBattement).toBeNull();
  });

  it('le contexte ne DÉBORDE pas : hors application d’intent, l’hôte ne joue pas le héros d’un invité', () => {
    setup();
    useGame.getState().battleBattement(); // appel DIRECT (clic de l'hôte sur son propre écran)
    expect(useGame.getState().pendingBattement, 'l’hôte n’ouvre pas le jet d’un héros distant').toBeNull();
    // …et le contexte est bien retombé après l'intent précédent (aucune fuite entre gestes).
    expect(applyIntent(1, 'battleBattement', [])).toBe('appliqué');
    expect(useGame.getState().pendingBattement).toBeTruthy();
    useGame.setState({ pendingBattement: null });
    useGame.getState().battleBattement();
    expect(useGame.getState().pendingBattement, 'après le finally, l’hôte est redevenu l’hôte').toBeNull();
  });

  it('NON-RÉGRESSION SOLO : sans coop, le joueur ouvre son Battement comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    useGame.getState().battleBattement();
    expect(useGame.getState().pendingBattement).toBeTruthy();
  });
});
