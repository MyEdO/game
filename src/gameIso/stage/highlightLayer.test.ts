import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from '../../state/scene';
import { useGame, type GameState, type BattleState } from '../../state/store';
import { makePregens } from '../../data/pregens';
import { spawnEnemy } from '../../state/spawn';
import { Combatant } from '../../engine/types';
import { combatHighlightsView } from './highlightLayer';

describe('combatHighlightsView — survol d’une entité SANS arme (#203 régression écran noir)', () => {
  it('ne lève pas, et ne produit AUCUNE bande de portée : une structure (porte, weapons: []) n’en a pas', () => {
    const door = { id: 'structure-5-4-N-0', name: 'Porte', kind: 'structure', pos: { x: 5, y: 4 }, size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, weapons: [] } as unknown as Combatant;
    const battle = { combatants: [door], order: [], turn: 0, zones: [], acted: false, action: null } as unknown as BattleState;
    const get = (() => ({ battle, scene: emptyScene(6, 6) })) as unknown as () => GameState;

    const view = combatHighlightsView(get, battle, {
      myTurn: false,
      pendingAttack: null,
      pendingCleave: null,
      pendingDualStrike: null,
      pendingCast: null,
      localIntent: null,
      hovered: 'structure-5-4-N-0', // le survol arrive par le CONTEXTE, comme l'hôte le fournit
    });
    expect(view.rangeBandSource).toBeNull();
  });
});

/**
 * ANNEAUX DE CANDIDATS — la TEINTE vient du MODE, pas d'un id lu au vol. Un mode de ciblage déclare
 * `anneauCandidats` (`state/targetingModes`) : le Soin cible un allié → anneau AMI (vert) ; les flux
 * différés ciblent un adversaire → anneau hostile. Un mode qui ne le déclare pas ne peint AUCUN
 * anneau de candidat (mode neutre : ses anneaux sont ceux des cibles éligibles ; Dissiper : aucun).
 */
describe('combatHighlightsView — anneaux de CANDIDATS, teinte déclarée par le mode', () => {
  /** Combat réel : héros actif (h1) + allié BLESSÉ adjacent (h2), deux ennemis. `over` patche `battle`. */
  function combat(over: Record<string, unknown> = {}) {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
    ally.wounds = { ...ally.wounds, current: ally.wounds.max - 3 }; // seul un blessé est soignable
    const e1 = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 7, y: 6 });
    const battle = {
      combatants: [hero, ally, e1], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
    } as unknown as BattleState;
    const w = 16, h = 12;
    const scene = { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [hero, ally], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null, localIntent: null });
    return battle;
  }

  const vue = (battle: BattleState) =>
    combatHighlightsView(useGame.getState, battle, {
      myTurn: true, pendingAttack: null, pendingCleave: null, pendingDualStrike: null,
      pendingCast: null, localIntent: null, hovered: null,
    });

  beforeEach(() => { useGame.setState({ battle: null, party: [], localIntent: null }); });

  it('mode SOIN armé : l’allié blessé porte un anneau, et il est AMI', () => {
    const battle = combat({ action: 'heal' });
    const cand = vue(battle).candidates;
    expect(cand, 'le mode Soin peint ses candidats').not.toBeNull();
    expect(cand!.ids, 'seul le blessé adjacent est soignable').toEqual(['h2']);
    expect(cand!.friendly, 'soigner un allié = anneau AMI (vert)').toBe(true);
  });

  it('mode NEUTRE : aucun anneau de candidat (les anneaux d’attaque en sont une autre source)', () => {
    expect(vue(combat()).candidates).toBeNull();
  });

  it('mode DISSIPER : aucun anneau de candidat — le mode ne le déclare pas', () => {
    expect(vue(combat({ action: 'dispel' })).candidates).toBeNull();
  });
});
