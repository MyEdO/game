/**
 * « Petites Prières » (LDB 25 l.22-24) — câblage effet de scène : un NON-Béni qui prie sur un site
 * sacré peut être exaucé (1d100 secret, seuil relevé par la Compétence Prière) ; exaucé → la récompense
 * authorée (Flow) s'applique. Gaté par l'option `priere-petites`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { flowFromEffects } from './monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { hasTalent } from '../engine/magic';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const reward = flowFromEffects([{ type: 'giveXp', amount: 50 }]);

/** Un héros NON-Béni auquel on garantit d'être « entendu » (Prière avancée → seuil très haut). */
function laypersonSurePray(): Combatant {
  const p = tousLesHerosDeScenario(idsDeTest).find((h) => !hasTalent(h as Combatant, 'beni'))! as Combatant;
  const sk = p.skills.find((s) => s.id === 'priere');
  if (sk) sk.advances = 200; else p.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 200 } as never);
  p.xp = 0;
  return p;
}


describe('Petites Prières (LDB 25) — effet de scène', () => {
  it('option active + non-Béni entendu : la récompense authorée s’applique', () => {
    setRule('priere-petites', true);
    const p = laypersonSurePray();
    banc.setState({ party: [p], journal: [] });
    banc.getState().ensemencerLeTirage(1);
    applyEffects(banc.getState, banc.setState, [{ type: 'petitePriere', heroId: p.id, reward }]);
    expect(banc.getState().party[0].xp).toBe(50); // reward (giveXp) exécuté
    expect(banc.getState().journal.join('\n')).toMatch(/entendent/);
  });

  it('option désactivée : aucun effet (rien n’est joué)', () => {
    setRule('priere-petites', false);
    const p = laypersonSurePray();
    banc.setState({ party: [p], journal: [] });
    applyEffects(banc.getState, banc.setState, [{ type: 'petitePriere', heroId: p.id, reward }]);
    expect(banc.getState().party[0].xp).toBe(0);
    expect(banc.getState().journal).toHaveLength(0);
  });

  it('un Béni est renvoyé à la prière normale (pas de Petite Prière)', () => {
    setRule('priere-petites', true);
    const beni = tousLesHerosDeScenario(idsDeTest).find((h) => hasTalent(h as Combatant, 'beni')) as Combatant | undefined;
    if (!beni) return; // aucun Béni dans les pregens → cas non applicable
    beni.xp = 0;
    banc.setState({ party: [beni], journal: [] });
    applyEffects(banc.getState, banc.setState, [{ type: 'petitePriere', heroId: beni.id, reward: EMPTY_FLOW }]);
    expect(banc.getState().party[0].xp).toBe(0);
    expect(banc.getState().journal.join('\n')).toMatch(/est Béni/);
  });
});
