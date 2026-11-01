import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import type { Combatant } from '../engine/types';
import { setRule, resetRule } from '../engine/policy';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/** Action de combat « Dissiper » (LDB 46 l.158-162) : ouverture du pending (Soutien même Domaine),
 *  cumul du DR sur `caster.dispel`, dissipation au NI. Calque la Focalisation. */
describe('Dissipation permanente — Action de combat', () => {
  beforeEach(() => { vi.clearAllTimers(); useGame.setState({ battle: null, pendingDispel: null }); });

  const langue = { id: 'langue', spec: 'magick', characteristic: 'intelligence' as const, advances: 20 };
  const mk = (id: string, spells: string[], extra: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
    id, name: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [langue], talents: [], spells, pos: { x: 1, y: 1 },
    ...extra,
  }) as unknown as Combatant);

  function setup() {
    // Deux lanceurs du MÊME Domaine (Bête) avec Langue (Magick) + une cible portant un sort durable.
    const mage = mk('mage', ['forme-bestiale']); // ids STABLES (subType Bête)
    const allie = mk('allie', ['incarnation-de-wyssan'], { pos: { x: 2, y: 1 } }); // subType Bête → même Domaine
    const cible: Combatant = mk('cible', [], {
      kind: 'enemy', pos: { x: 5, y: 5 },
      activeEffects: [{ label: 'Malédiction', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 2, casterId: 'ennemi', label: 'Maléfice' } }],
    } as unknown as Combatant) as Combatant;
    const battle = { combatants: [mage, allie, cible], order: ['mage', 'allie', 'cible'], turn: 0, round: 1, acted: false, over: false, log: [] } as unknown as BattleState;
    useGame.setState({ battle });
    return { mage, allie, cible };
  }

  it('ouvre le pending avec le NI du sort + Soutien « même Domaine »', () => {
    setup();
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    expect(pd).toBeTruthy();
    expect(pd.ni).toBe(2);
    expect(pd.support?.count).toBe(1); // allie (même Domaine Bête, Langue Magick) assiste
    expect(pd.support?.bonus).toBe(10);
    expect(pd.value).toBe(60 + 10); // Int 40 + 20 avances Langue = 60, + Soutien 10
  });

  it('cumule le DR et dissipe le sort quand le DR cumulé atteint le NI', () => {
    const { cible } = setup();
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    // Round 1 : DR +1 (cumul 1/2) → sort toujours actif, progression persistée.
    useGame.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
    useGame.getState().dispelConfirm();
    const mage1 = useGame.getState().battle!.combatants.find((c) => c.id === 'mage')!;
    expect(mage1.dispel).toEqual({ spellId: 'malefice', spellCasterId: 'ennemi', total: 1 });
    expect((useGame.getState().battle!.combatants.find((c) => c.id === 'cible')!.activeEffects ?? []).length).toBe(1); // toujours là

    // Round 2 : re-Dissiper, DR +1 (cumul 2/2) → dissipé.
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false } as BattleState });
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd2 = useGame.getState().pendingDispel!;
    useGame.setState({ pendingDispel: { ...pd2, result: { roll: 10, target: pd2.value, sl: 1, success: true } } });
    useGame.getState().dispelConfirm();
    const cibleAfter = useGame.getState().battle!.combatants.find((c) => c.id === 'cible')!;
    expect((cibleAfter.activeEffects ?? []).some((e) => e.spell?.spellId === 'malefice')).toBe(false); // dissipé
    const mage2 = useGame.getState().battle!.combatants.find((c) => c.id === 'mage')!;
    expect(mage2.dispel).toBeUndefined(); // accumulateur effacé
    void cible;
  });

  // Adjacence du Soutien (LDB 12 l.196, #467) : câblée sur le Soutien « même Domaine » de Dissipation via la
  // MÊME primitive `combatDistance` que `openSkillTest` (patron `support-adjacency-gate.test.ts`).
  it('Soutien « même Domaine », adjacent (l.196) : compte', () => {
    setup();
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    expect(pd.support?.count).toBe(1);
    expect(pd.value).toBe(60 + 10);
  });

  it('Soutien « même Domaine », ÉLOIGNÉ (dispersé en combat) : écarté', () => {
    const mage = mk('mage', ['forme-bestiale']);
    const allie = mk('allie', ['incarnation-de-wyssan'], { pos: { x: 20, y: 20 } }); // même Domaine mais hors de portée
    const cible: Combatant = mk('cible', [], {
      kind: 'enemy', pos: { x: 5, y: 5 },
      activeEffects: [{ label: 'Malédiction', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 2, casterId: 'ennemi', label: 'Maléfice' } }],
    } as unknown as Combatant) as Combatant;
    const battle = { combatants: [mage, allie, cible], order: ['mage', 'allie', 'cible'], turn: 0, round: 1, acted: false, over: false, log: [] } as unknown as BattleState;
    useGame.setState({ battle });
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    expect(pd.support).toBeUndefined();
    expect(pd.value).toBe(60); // Int 40 + 20 avances Langue, pas de Soutien (allie hors de portée)
  });

  // Dissiper son PROPRE Sort (`VDM 02 l.186`) : mesuré OFF puis ON sur un jet IDENTIQUE — le bonus
  // est un DR (`caster.dispel.total`, l'accumulateur RÉEL), jamais la cible du Test (`pendingDispel.value`,
  // en points de pourcentage — un DR vaut une dizaine, `tests.ts:98`). Le volet OFF reste au Livre de
  // base (`LDB 46 l.154-162`, aucun bonus) ; le volet ON rougit si `dispelOwnSpellDR` se débranche.
  it('dissipe son propre Sort : +1 DR CUMULÉ seulement sous `magic-vdm-incantation`', () => {
    const freshMage = () => mk('mage', ['forme-bestiale'], {
      activeEffects: [{ label: 'Malédiction', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 3, casterId: 'mage', label: 'Maléfice' } }],
    });
    const roundDR = (rule: boolean) => {
      const mage = freshMage();
      const battle = { combatants: [mage], order: ['mage'], turn: 0, round: 1, acted: false, over: false, log: [] } as unknown as BattleState;
      useGame.setState({ battle, pendingDispel: null });
      if (rule) setRule('magic-vdm-incantation', true);
      useGame.getState().battleDispelSpell('malefice', 'mage');
      const pd = useGame.getState().pendingDispel!;
      useGame.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
      useGame.getState().dispelConfirm();
      const total = useGame.getState().battle!.combatants.find((c) => c.id === 'mage')!.dispel!.total;
      if (rule) resetRule('magic-vdm-incantation');
      return total;
    };
    expect(roundDR(false)).toBe(1); // OFF (LDB 46 l.154-162) : le DR du jet seul (sl:1), aucun bonus.
    expect(roundDR(true)).toBe(2); // ON (VDM 02 l.186) : +1 DR cumulé de plus sur le MÊME jet.
  });
});
