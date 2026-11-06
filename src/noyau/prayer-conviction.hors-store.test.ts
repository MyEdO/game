/**
 * « Prêchez, ma sœur ! » (LDB 40 l.40-42) — câblage cast : une Prière murmurée (`discreet`) subit une
 * Difficulté d'un cran plus dure quand l'option `prayer-conviction` est active.
 */
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { pregen, PREGEN } from '../data/pregens';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function priest(): Combatant {
  const p = pregen(PREGEN.pretre);
  const sk = p.skills.find((s) => s.id === 'priere');
  if (sk) sk.advances = Math.max(sk.advances, 5);
  else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 } as never);
  return p as Combatant;
}

/** Cible du Test d'une Prière (à voix haute vs discrète), option `prayer-conviction` supposée réglée. */
function castTarget(discreet: boolean): number {
  const p = priest();
  banc.setState({ battle: null, party: [p], journal: [], pendingCast: null, pendingCascade: null, gameTime: 8 * 60 });
  banc.getState().seedRng(5);
  banc.getState().incanterLeSort(p.id, 'benediction-de-guerison', p.id);
  if (discreet) banc.getState().jetRegler('cast', 'discret', true);
  banc.getState().jetRoll('cast');
  return banc.getState().pendingCast!.result!.target;
}


describe('Prêchez, ma sœur ! (LDB 40 l.42)', () => {
  it('option active : Prière discrète = Difficulté d’un cran plus dure (−10 à la cible)', () => {
    setRule('prayer-conviction', true);
    const aloud = castTarget(false);
    const whispered = castTarget(true);
    expect(whispered).toBe(aloud - 10); // Intermédiaire (+0) → Complexe (−10)
  });

  it('option désactivée : la discrétion demandée reste sans effet', () => {
    setRule('prayer-conviction', false);
    expect(castTarget(true)).toBe(castTarget(false));
  });
});
