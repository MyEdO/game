/**
 * Effet d'auteur `castSpell` (#98) : lancer scripté depuis un dialogue/trigger. EN COMBAT, route par
 * le flux d'incantation STANDARD (`castSpell`, combatFlow) — même chemin que l'IA. HORS COMBAT, un
 * héros du groupe route par `oocCastSpell` (couture D, jet réel) ; un PNJ hors combat (pas de
 * Combatant) est refusé — pas de pseudo-combat inventé. `mode:'forceSuccess'` (arbitrage d'auteur)
 * applique directement les effets du sort, sans jet, en combat comme hors combat.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

describe('Effet castSpell (#98)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null, pendingLogQueue: [] });
  });

  describe('EN COMBAT', () => {
    function setup() {
      const wiz = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
      const ally = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(13) });
      useGame.setState({ party: [wiz, ally] });
      useGame.getState().startScene(testScene);
      useGame.getState().startCombat('enc-mutants');
      useGame.getState().confirmRoundStart();
      vi.clearAllTimers();
      const b = useGame.getState().battle!;
      const W = b.combatants.find((c) => c.kind === 'hero' && c.label === 'W')!;
      const A = b.combatants.find((c) => c.kind === 'hero' && c.label === 'A')!;
      const enemies = b.combatants.filter((c) => c.kind === 'enemy');
      enemies.slice(1).forEach((e) => (e.dead = true));
      const E = enemies[0];
      W.pos = { x: 10, y: 10 }; A.pos = { x: 11, y: 10 }; E.pos = { x: 12, y: 10 };
      useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
      return { W, A, E };
    }

    it('route par le MÊME flux standard que `castSpell` direct (héros manuel → `pendingCast` ouvert, jet non résolu)', () => {
      const { W, A } = setup();
      applyEffects(useGame.getState, useGame.setState, [{ type: 'castSpell', casterId: W.id, spellId: 'chute', targetId: A.id }]);
      const pc = useGame.getState().pendingCast;
      expect(pc).not.toBeNull();
      expect(pc!.casterId).toBe(W.id);
      expect(pc!.targetId).toBe(A.id);
      expect(pc!.spellId).toBe('chute');
      expect(pc!.result).toBeNull(); // jet DIFFÉRÉ (modale influençable) — jamais un jet silencieux
    });

    it('lanceur introuvable → refus journalisé, aucun `pendingCast`', () => {
      const { A } = setup();
      applyEffects(useGame.getState, useGame.setState, [{ type: 'castSpell', casterId: 'inconnu', spellId: 'chute', targetId: A.id }]);
      expect(useGame.getState().pendingCast).toBeNull();
      expect(useGame.getState().journal.some((l) => /introuvable/i.test(l))).toBe(true);
    });

    it('lanceur ENNEMI (IA) : le jet est auto-roulé (`pendingCast.result` posé), comme un cast d’IA normal', () => {
      const { E, A } = setup();
      applyEffects(useGame.getState, useGame.setState, [{ type: 'castSpell', casterId: E.id, spellId: 'chute', targetId: A.id }]);
      const pc = useGame.getState().pendingCast;
      expect(pc).not.toBeNull();
      expect(pc!.casterId).toBe(E.id);
      expect(pc!.result).not.toBeNull(); // IA : `castRoll` auto-roulé (même branche que `castSpell` direct, combatFlow)
    });

    it('mode "forceSuccess" EN COMBAT : applique les effets du sort SANS jet, aucun `pendingCast` ouvert', () => {
      const { W, A } = setup();
      const before = A.wounds.current;
      A.wounds.current = Math.max(0, before - 3);
      const wounded = useGame.getState().battle!.combatants.find((c) => c.id === A.id)!.wounds.current;
      applyEffects(useGame.getState, useGame.setState, [
        { type: 'castSpell', casterId: W.id, spellId: 'benediction-de-guerison', targetId: A.id, mode: 'forceSuccess' },
      ]);
      expect(useGame.getState().pendingCast).toBeNull();
      const after = useGame.getState().battle!.combatants.find((c) => c.id === A.id)!;
      expect(after.wounds.current).toBe(wounded + 1); // « Bénédiction de Guérison » : +1 PB — appliqué directement (op `heal`)
    });
  });

  describe('HORS COMBAT (couture D)', () => {
    it('un héros du groupe route par `oocCastSpell` (jet réel, `pendingCast` ouvert)', () => {
      const wiz = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
      useGame.setState({ party: [wiz], battle: null, pendingCast: null });
      applyEffects(useGame.getState, useGame.setState, [{ type: 'castSpell', casterId: wiz.id, spellId: 'chute' }]);
      const pc = useGame.getState().pendingCast;
      expect(pc).not.toBeNull();
      expect(pc!.casterId).toBe(wiz.id);
      expect(pc!.targetId).toBe(wiz.id); // pas de cible fournie → le lanceur (soi)
    });

    it('un PNJ (pas un héros du groupe, pas en combat) est refusé — pas de pseudo-combat inventé', () => {
      const wiz = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
      useGame.setState({ party: [wiz], battle: null, pendingCast: null, journal: [] });
      applyEffects(useGame.getState, useGame.setState, [{ type: 'castSpell', casterId: 'pnj-rituel', spellId: 'chute' }]);
      expect(useGame.getState().pendingCast).toBeNull();
      expect(useGame.getState().journal.some((l) => /introuvable/i.test(l))).toBe(true);
    });

    it('mode "forceSuccess" HORS COMBAT : applique les effets du sort directement (aucun `pendingCast`)', () => {
      const wiz = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
      const ally = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(13) });
      ally.wounds.current = Math.max(0, ally.wounds.current - 3);
      const before = ally.wounds.current;
      useGame.setState({ party: [wiz, ally], battle: null, pendingCast: null, journal: [] });
      applyEffects(useGame.getState, useGame.setState, [
        { type: 'castSpell', casterId: wiz.id, spellId: 'benediction-de-guerison', targetId: ally.id, mode: 'forceSuccess' },
      ]);
      expect(useGame.getState().pendingCast).toBeNull();
      const after = useGame.getState().party.find((h) => h.id === ally.id)!;
      expect(after.wounds.current).toBe(before + 1);
    });
  });

  it('sort introuvable → refus journalisé', () => {
    const wiz = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
    useGame.setState({ party: [wiz], battle: null, pendingCast: null, journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'castSpell', casterId: wiz.id, spellId: 'inexistant' }]);
    expect(useGame.getState().journal.some((l) => /introuvable/i.test(l))).toBe(true);
  });
});
