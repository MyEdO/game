import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setRule, resetRule } from '../engine/policy';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/** Dissipation HORS COMBAT (couture D, #461, LDB 46 l.160-162) : « pour votre Action » n'est pas
 *  bornée au combat — calque `oocFocusSpell`, réutilise `dispel.ts`/`dispelConfirm` tels quels. */
describe('Dissipation permanente — hors combat (couture D, #461)', () => {
  beforeEach(() => { vi.clearAllTimers(); useGame.setState({ battle: null, pendingDispel: null }); });

  const langue = { id: 'langue', spec: 'magick', characteristic: 'intelligence' as const, advances: 20 };
  const mk = (id: string, spells: string[], extra: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
    id, name: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [langue], talents: [], spells,
    ...extra,
  }) as unknown as Combatant);

  function setup() {
    // Deux lanceurs du MÊME Domaine (Bête), sans `pos` (hors combat) + une cible du groupe porteuse
    // d'un sort durable.
    const mage = mk('mage', ['forme-bestiale']);
    const allie = mk('allie', ['incarnation-de-wyssan']);
    const cible = mk('cible', [], {
      activeEffects: [{ label: 'Malédiction', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 1, casterId: 'ennemi', label: 'Maléfice' } }],
    });
    useGame.setState({ party: [mage, allie, cible] });
    return { mage, allie, cible };
  }

  it('n’ouvre rien EN combat : oocDispelSpell est un no-op (battle ouvert = action de combat)', () => {
    const { mage } = setup();
    useGame.setState({ battle: { combatants: [mage], order: ['mage'], turn: 0, round: 1, acted: false, over: false, log: [] } as never });
    useGame.getState().oocDispelSpell('mage', 'malefice', 'ennemi');
    expect(useGame.getState().pendingDispel).toBeNull();
  });

  it('ouvre le pending hors combat, Soutien « même Domaine » compté sans géométrie (l.162)', () => {
    setup();
    useGame.getState().oocDispelSpell('mage', 'malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    expect(pd).toBeTruthy();
    expect(pd.ni).toBe(1);
    expect(pd.support?.count).toBe(1); // allie (même Domaine Bête, Langue Magick) assiste — pas de portée hors combat
    expect(pd.support?.bonus).toBe(10);
    expect(pd.value).toBe(60 + 10); // Int 40 + 20 avances Langue = 60, + Soutien 10
  });

  it('Test résolu (Round unique DR≥NI) dissipe le sort permanent sur la cible du groupe', () => {
    const { cible } = setup();
    useGame.getState().oocDispelSpell('mage', 'malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    useGame.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
    useGame.getState().dispelConfirm();
    const cibleAfter = useGame.getState().party.find((c) => c.id === cible.id)!;
    expect((cibleAfter.activeEffects ?? []).some((e) => e.spell?.spellId === 'malefice')).toBe(false);
    const mageAfter = useGame.getState().party.find((c) => c.id === 'mage')!;
    expect(mageAfter.dispel).toBeUndefined();
    expect(useGame.getState().pendingDispel).toBeNull();
  });

  // Dissiper son PROPRE Sort (`VDM 02 l.186`), hors combat — mesuré OFF puis ON sur un jet IDENTIQUE :
  // le bonus est un DR (`caster.dispel.total`, l'accumulateur RÉEL), jamais la cible du Test
  // (`pendingDispel.value`, en points — un DR vaut une dizaine, `tests.ts:98`).
  it('dissipe son propre Sort hors combat : +1 DR CUMULÉ seulement sous `magic-vdm-incantation`', () => {
    const freshMage = () => mk('mage', ['forme-bestiale'], {
      activeEffects: [{ label: 'Malédiction', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 3, casterId: 'mage', label: 'Maléfice' } }],
    });
    const roundDR = (rule: boolean) => {
      useGame.setState({ party: [freshMage()], pendingDispel: null });
      if (rule) setRule('magic-vdm-incantation', true);
      useGame.getState().oocDispelSpell('mage', 'malefice', 'mage');
      const pd = useGame.getState().pendingDispel!;
      useGame.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
      useGame.getState().dispelConfirm();
      const total = useGame.getState().party.find((c) => c.id === 'mage')!.dispel!.total;
      if (rule) resetRule('magic-vdm-incantation');
      return total;
    };
    expect(roundDR(false)).toBe(1); // OFF (LDB 46 l.154-162) : le DR du jet seul (sl:1), aucun bonus.
    expect(roundDR(true)).toBe(2); // ON (VDM 02 l.186) : +1 DR cumulé de plus sur le MÊME jet.
  });

  it('sans la compétence Langue (Magick) : refus journalisé, aucun pending', () => {
    const mage = mk('mage', ['forme-bestiale'], { skills: [] });
    const cible = mk('cible', [], {
      activeEffects: [{ label: 'Malédiction', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 1, casterId: 'ennemi', label: 'Maléfice' } }],
    });
    useGame.setState({ party: [mage, cible] });
    useGame.getState().oocDispelSpell('mage', 'malefice', 'ennemi');
    expect(useGame.getState().pendingDispel).toBeNull();
  });

  it('aucun sort dissipable ne matche : no-op', () => {
    setup();
    useGame.getState().oocDispelSpell('mage', 'introuvable', 'ennemi');
    expect(useGame.getState().pendingDispel).toBeNull();
  });
});
