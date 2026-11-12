/**
 * Effet d'auteur `castSpell` (#98) : lancer scripté depuis un dialogue/trigger. EN COMBAT, route par
 * le flux d'incantation STANDARD (`castSpell`, combatFlow) — même chemin que l'IA. HORS COMBAT, un
 * héros du groupe route par `incanterLeSort` (couture D, jet réel) ; un PNJ hors combat (pas de
 * Combatant) est refusé — pas de pseudo-combat inventé. `mode:'forcerLaReussite'` (arbitrage d'auteur)
 * joue le Flow du sort à DR = NI, sans jet, en combat comme hors combat.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Effet castSpell (#98)', () => {
  describe('EN COMBAT', () => {
    function setup() {
      const wiz = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
      const ally = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 13 });
      banc.setState({ party: [wiz, ally] });
      banc.getState().lancerLaScene(testScene());
      banc.getState().lancerLeCombat('enc-mutants');
      banc.getState().fenetreValider('debutDuRound');
      const b = banc.getState().battle!;
      const W = b.combatants.find((c) => c.kind === 'heros' && c.label === 'W')!;
      const A = b.combatants.find((c) => c.kind === 'heros' && c.label === 'A')!;
      const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
      enemies.slice(1).forEach((e) => (e.dead = true));
      const E = enemies[0];
      W.pos = { x: 10, y: 10 }; A.pos = { x: 11, y: 10 }; E.pos = { x: 12, y: 10 };
      banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
      return { W, A, E };
    }

    it('route par le MÊME flux standard que `castSpell` direct (héros manuel → `pendingCast` ouvert, jet non résolu)', () => {
      const { W, A } = setup();
      applyEffects(banc.getState, banc.setState, [{ type: 'castSpell', casterId: W.id, spellId: 'chute', targetId: A.id }]);
      const pc = banc.getState().pendingCast;
      expect(pc).not.toBeNull();
      expect(pc!.casterId).toBe(W.id);
      expect(pc!.targetId).toBe(A.id);
      expect(pc!.spellId).toBe('chute');
      expect(pc!.result).toBeNull(); // jet DIFFÉRÉ (modale influençable) — jamais un jet silencieux
    });

    it('lanceur introuvable → refus journalisé, aucun `pendingCast`', () => {
      const { A } = setup();
      applyEffects(banc.getState, banc.setState, [{ type: 'castSpell', casterId: 'inconnu', spellId: 'chute', targetId: A.id }]);
      expect(banc.getState().pendingCast).toBeNull();
      expect(banc.getState().journal.some((l) => /introuvable/i.test(l))).toBe(true);
    });

    it('lanceur ENNEMI (IA) : le jet est auto-roulé (`pendingCast.result` posé), comme un cast d’IA normal', () => {
      const { E, A } = setup();
      applyEffects(banc.getState, banc.setState, [{ type: 'castSpell', casterId: E.id, spellId: 'chute', targetId: A.id }]);
      const pc = banc.getState().pendingCast;
      expect(pc).not.toBeNull();
      expect(pc!.casterId).toBe(E.id);
      expect(pc!.result).not.toBeNull(); // IA : `jetLancer('incantation')` auto-roulé (même branche que `castSpell` direct, combatFlow)
    });

    it('mode "forcerLaReussite" EN COMBAT : applique les effets du sort SANS jet, aucun `pendingCast` ouvert', () => {
      const { W, A } = setup();
      const before = A.wounds.current;
      A.wounds.current = Math.max(0, before - 3);
      const wounded = banc.getState().battle!.combatants.find((c) => c.id === A.id)!.wounds.current;
      applyEffects(banc.getState, banc.setState, [
        { type: 'castSpell', casterId: W.id, spellId: 'benediction-de-guerison', targetId: A.id, mode: 'forcerLaReussite' },
      ]);
      expect(banc.getState().pendingCast).toBeNull();
      const after = banc.getState().battle!.combatants.find((c) => c.id === A.id)!;
      expect(after.wounds.current).toBe(wounded + 1); // « Bénédiction de Guérison » : +1 PB — appliqué directement (op `heal`)
    });
  });

  describe('HORS COMBAT (couture D)', () => {
    it('un héros du groupe route par `incanterLeSort` (jet réel, `pendingCast` ouvert)', () => {
      const wiz = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
      banc.setState({ party: [wiz], battle: null, pendingCast: null });
      applyEffects(banc.getState, banc.setState, [{ type: 'castSpell', casterId: wiz.id, spellId: 'chute' }]);
      const pc = banc.getState().pendingCast;
      expect(pc).not.toBeNull();
      expect(pc!.casterId).toBe(wiz.id);
      expect(pc!.targetId).toBe(wiz.id); // pas de cible fournie → le lanceur (soi)
    });

    it('un PNJ (pas un héros du groupe, pas en combat) est refusé — pas de pseudo-combat inventé', () => {
      const wiz = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
      banc.setState({ party: [wiz], battle: null, pendingCast: null, journal: [] });
      applyEffects(banc.getState, banc.setState, [{ type: 'castSpell', casterId: 'pnj-rituel', spellId: 'chute' }]);
      expect(banc.getState().pendingCast).toBeNull();
      expect(banc.getState().journal.some((l) => /introuvable/i.test(l))).toBe(true);
    });

    it('mode "forcerLaReussite" HORS COMBAT : applique les effets du sort directement (aucun `pendingCast`)', () => {
      const wiz = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
      const ally = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 13 });
      ally.wounds.current = Math.max(0, ally.wounds.current - 3);
      const before = ally.wounds.current;
      banc.setState({ party: [wiz, ally], battle: null, pendingCast: null, journal: [] });
      applyEffects(banc.getState, banc.setState, [
        { type: 'castSpell', casterId: wiz.id, spellId: 'benediction-de-guerison', targetId: ally.id, mode: 'forcerLaReussite' },
      ]);
      expect(banc.getState().pendingCast).toBeNull();
      const after = banc.getState().party.find((h) => h.id === ally.id)!;
      expect(after.wounds.current).toBe(before + 1);
    });
  });

  it('sort introuvable → refus journalisé', () => {
    const wiz = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, seed: 707 });
    banc.setState({ party: [wiz], battle: null, pendingCast: null, journal: [] });
    applyEffects(banc.getState, banc.setState, [{ type: 'castSpell', casterId: wiz.id, spellId: 'inexistant' }]);
    expect(banc.getState().journal.some((l) => /introuvable/i.test(l))).toBe(true);
  });
});
