import { describe, it, expect, beforeEach } from 'vitest';
import { touchActors, combatantClickActs } from './combatOrParty';
import { actorIn } from './monde/combatants';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import type { Combatant } from '../engine/types';
import { poserLeCombat } from './combatOrParty.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const c = (id: string): Combatant => combattantDeTest({ id, label: id });
const state = (over: Partial<Jeu>): Jeu => ({ party: [], battle: null, ...over } as unknown as Jeu);

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
    const combat = (over?: Record<string, unknown>) => poserLeCombat(banc.setState, over);

    it('ennemi en mode NEUTRE → action (attaque)', () => {
      const { enemy } = combat();
      expect(combatantClickActs(banc.getState, enemy)).toBe(true);
    });
    it('allié en mode NEUTRE → pas d’action (son inspection est le geste secondaire)', () => {
      const { ally } = combat();
      expect(combatantClickActs(banc.getState, ally)).toBe(false);
    });
    it('allié blessé en mode SOIN → action (le mode cible les alliés soignables)', () => {
      const { ally } = combat({ action: 'soins' });
      ally.wounds.current = Math.max(0, ally.wounds.max - 3); // soignable
      banc.setState({ battle: { ...banc.getState().battle! } });
      expect(combatantClickActs(banc.getState, ally)).toBe(true);
    });
    it('allié sain en mode SOIN → pas d’action (rien à soigner)', () => {
      const { ally } = combat({ action: 'soins' });
      expect(combatantClickActs(banc.getState, ally)).toBe(false);
    });
    it('battle absent → pas d’action', () => {
      banc.setState({ battle: null });
      expect(combatantClickActs(banc.getState, c('z'))).toBe(false);
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
