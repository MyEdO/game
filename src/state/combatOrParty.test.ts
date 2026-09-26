import { describe, it, expect, beforeEach } from 'vitest';
import { touchActors, combatantClickActs } from './combatOrParty';
import { actorIn } from './combatants';
import { useGame } from './store';
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';

const c = (id: string): Combatant => ({ id, name: id } as unknown as Combatant);
const state = (over: Partial<GameState>): GameState => ({ party: [], battle: null, ...over } as unknown as GameState);

/** Arène d'herbe minimale (combatantClickActs dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, levels: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

describe('combatOrParty — base des actions joueur combat ⇄ hors combat', () => {
  describe('actorIn : résout l’acteur dans le bon ensemble', () => {
    it('EN COMBAT → file de combat (battle.combatants), pas le groupe', () => {
      const inBattle = c('x');
      const inParty = c('x'); // même id, objet DIFFÉRENT côté groupe
      const s = state({ battle: { combatants: [inBattle] } as never, party: [inParty] });
      expect(actorIn(s, 'x')).toBe(inBattle); // la file prime
    });
    it('HORS COMBAT (battle null) → le groupe', () => {
      const inParty = c('y');
      expect(actorIn(state({ party: [inParty] }), 'y')).toBe(inParty);
    });
    it('id inconnu → undefined', () => {
      expect(actorIn(state({ party: [c('a')] }), 'zzz')).toBeUndefined();
    });
  });

  describe('combatantClickActs : décideur PARTAGÉ carte ⇄ frise/curseur — DÉRIVÉ du mode courant', () => {
    beforeEach(() => { useGame.setState({ battle: null, party: [], inspectEnabled: false }); }); // mode ACTION (Inspection OFF) par défaut
    function combat(over: Record<string, unknown> = {}) {
      const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
      const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
      const enemy = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 7, y: 6 }); // adjacent au héros
      const battle = {
        combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
        turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
        movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
      } as never;
      useGame.setState({ battle, scene: arena(), party: [hero, ally] });
      return { hero, ally, enemy };
    }

    it('ennemi en mode NEUTRE → action (attaque)', () => {
      const { enemy } = combat();
      expect(combatantClickActs(useGame.getState, enemy)).toBe(true);
    });
    it('MODE INSPECTION (Inspection ON) → aucun combattant n’agit (cliquer inspecte, jamais attaquer)', () => {
      const { enemy, ally } = combat();
      useGame.setState({ inspectEnabled: true });
      expect(combatantClickActs(useGame.getState, enemy)).toBe(false); // même un ennemi attaquable
      expect(combatantClickActs(useGame.getState, ally)).toBe(false);
    });
    it('allié en mode NEUTRE → pas d’action (→ inspection)', () => {
      const { ally } = combat();
      expect(combatantClickActs(useGame.getState, ally)).toBe(false);
    });
    it('allié blessé en mode SOIN → action (le mode cible les alliés soignables)', () => {
      const { ally } = combat({ action: 'heal' });
      ally.wounds.current = Math.max(0, ally.wounds.max - 3); // soignable
      useGame.setState({ battle: { ...useGame.getState().battle! } });
      expect(combatantClickActs(useGame.getState, ally)).toBe(true);
    });
    it('allié sain en mode SOIN → pas d’action (rien à soigner)', () => {
      const { ally } = combat({ action: 'heal' });
      expect(combatantClickActs(useGame.getState, ally)).toBe(false);
    });
    it('battle absent → pas d’action', () => {
      useGame.setState({ battle: null });
      expect(combatantClickActs(useGame.getState, c('z'))).toBe(false);
    });

    it('COQUE ennemie en mode INSPECTION (#240) → n’agit pas : le clic INSPECTE, jamais un ciblage', () => {
      combat();
      const hull = { id: 'hull1', name: 'Le Serpent de Sel', kind: 'npc', bodyShape: 'vehicule' } as unknown as Combatant;
      useGame.setState({ battle: { ...useGame.getState().battle!, combatants: [...useGame.getState().battle!.combatants, hull] }, inspectEnabled: true });
      expect(combatantClickActs(useGame.getState, hull)).toBe(false); // route vers setInspectId, pas battleClickEntity
    });
  });

  describe('touchActors : patch de re-rendu selon le contexte', () => {
    it('EN COMBAT → nouveau battle (référence fraîche), pas de party', () => {
      const battle = { combatants: [], log: [] } as never;
      const patch = touchActors(state({ battle }));
      expect(patch.battle).not.toBe(battle); // shallow-clone → re-render
      expect(patch.battle).toEqual(battle);
      expect(patch.party).toBeUndefined();
    });
    it('HORS COMBAT → nouveau party (référence fraîche), pas de battle', () => {
      const party = [c('a')];
      const patch = touchActors(state({ party }));
      expect(patch.party).not.toBe(party); // nouvelle liste → re-render
      expect(patch.party).toEqual(party);
      expect(patch.battle).toBeUndefined();
    });
  });
});
