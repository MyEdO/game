import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resumeSuspendedAI } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Anti soft-lock : l'IA active meurt PENDANT sa propre attaque (ex. le chargeur tué par un critique
 * défensif — démembrement — du héros qui défend). La conséquence du critique est une cascade combat ;
 * à sa clôture, `resumeSuspendedAI` doit AVANCER le tour (l'acteur IA actif est hors-combat) au lieu de
 * ne rien faire — sinon la main n'est jamais rendue au héros (soft-lock observé en jeu).
 */
function setupBattle(nHeroes: number) {
  const party = Array.from({ length: nHeroes }, (_, i) =>
    createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }));
  banc.setState({ party });
  banc.getState().startScene(testScene());
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  return banc.getState().battle!;
}

describe('Soft-lock — l’IA active meurt pendant sa propre attaque (critique défensif)', () => {
  it('resumeSuspendedAI avance le tour quand l’IA active est hors-combat (au lieu de bloquer)', () => {
    const b = setupBattle(2);
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0]; // le chargeur, actif
    // E a chargé et agi, puis a été TUÉ par le critique défensif du héros. On garde ≥1 ennemi vivant
    // pour distinguer « avancer » de « finir le combat » (les deux prouvent l'absence de soft-lock).
    E.dead = true;
    const turn = b.order.indexOf(E.id);
    banc.setState({
      battle: { ...b, turn, acted: true, over: null },
      pendingCascade: null, pendingDefense: null, pendingAttack: null,
    });

    resumeSuspendedAI(banc.getState, banc.setState);

    const st = banc.getState().battle;
    const active = st ? st.combatants.find((c) => c.id === st.order[st.turn]) : undefined;
    // Aucun blocage : le combat a avancé au-delà de E, OU il s'est terminé.
    expect((st?.over != null) || active?.id !== E.id).toBe(true);
  });
});
