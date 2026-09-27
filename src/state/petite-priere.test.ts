/**
 * « Petites Prières » (LDB 25 l.22-24) — câblage effet de scène : un NON-Béni qui prie sur un site
 * sacré peut être exaucé (1d100 secret, seuil relevé par la Compétence Prière) ; exaucé → la récompense
 * authorée (Flow) s'applique. Gaté par l'option `prayer-petites`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatEffects';
import { flowFromEffects, EMPTY_FLOW } from './flow';
import { makePregens } from '../data/pregens';
import { hasTalent } from '../engine/magic';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

const reward = flowFromEffects([{ type: 'giveXp', amount: 50 }]);

/** Un héros NON-Béni auquel on garantit d'être « entendu » (Prière avancée → seuil très haut). */
function laypersonSurePray(): Combatant {
  const p = makePregens().find((h) => !hasTalent(h as Combatant, 'beni'))! as Combatant;
  const sk = p.skills.find((s) => s.id === 'priere');
  if (sk) sk.advances = 200; else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 200 } as never);
  p.xp = 0;
  return p;
}

afterEach(() => resetRule('prayer-petites'));

describe('Petites Prières (LDB 25) — effet de scène', () => {
  it('option active + non-Béni entendu : la récompense authorée s’applique', () => {
    setRule('prayer-petites', true);
    const p = laypersonSurePray();
    useGame.setState({ party: [p], journal: [] });
    useGame.getState().seedRng(1);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'petitePriere', heroId: p.id, reward }]);
    expect(useGame.getState().party[0].xp).toBe(50); // reward (giveXp) exécuté
    expect(useGame.getState().journal.join('\n')).toMatch(/entendent/);
  });

  it('option désactivée : aucun effet (rien n’est joué)', () => {
    setRule('prayer-petites', false);
    const p = laypersonSurePray();
    useGame.setState({ party: [p], journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'petitePriere', heroId: p.id, reward }]);
    expect(useGame.getState().party[0].xp).toBe(0);
    expect(useGame.getState().journal).toHaveLength(0);
  });

  it('un Béni est renvoyé à la prière normale (pas de Petite Prière)', () => {
    setRule('prayer-petites', true);
    const beni = makePregens().find((h) => hasTalent(h as Combatant, 'beni')) as Combatant | undefined;
    if (!beni) return; // aucun Béni dans les pregens → cas non applicable
    beni.xp = 0;
    useGame.setState({ party: [beni], journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'petitePriere', heroId: beni.id, reward: EMPTY_FLOW }]);
    expect(useGame.getState().party[0].xp).toBe(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/est Béni/);
  });
});
