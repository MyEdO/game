import { describe, it, expect, beforeEach } from 'vitest';
import { setRule, resetRule } from '../engine/policy';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { RULE_REF } from '../engine/ruleRefs';
import type { PendingDispel } from './pendings';

/** La ligne de Soutien de la ligne figée au pending (LDB 46 l.162). */
const soutienDe = (pd: PendingDispel) => pd.ligne.mods.find((m) => m.ref === RULE_REF.soutien);
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Dissipation HORS COMBAT (couture D, #461, LDB 46 l.160-162) : « pour votre Action » n'est pas
 *  bornée au combat — calque `focaliserLeSort`, réutilise `dispel.ts`/`jetValider('dissipation')` tels quels. */
describe('Dissipation permanente — hors combat (couture D, #461)', () => {
  const langue = { id: 'langue', spec: 'magick', characteristic: 'intelligence' as const, advances: 20 };
  const mk = (id: string, spells: string[], extra: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
    id, name: id, kind: 'heros',
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
      activeEffects: [{ label: 'Malédiction', characteristic: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 1, casterId: 'ennemi', label: 'Maléfice' } }],
    });
    banc.setState({ party: [mage, allie, cible] });
    return { mage, allie, cible };
  }

  it('ouvre le pending hors combat, Soutien « même Domaine » compté sans géométrie (l.162)', () => {
    setup();
    banc.getState().dissiperLeSort('mage', 'malefice', 'ennemi');
    const pd = banc.getState().pendingDispel!;
    expect(pd).toBeTruthy();
    expect(pd.ni).toBe(1);
    expect(soutienDe(pd), 'allie (même Domaine Bête, Langue Magick) assiste — pas de portée hors combat').toMatchObject({ value: 10, by: [{ id: 'allie' }] });
    expect(pd.value).toBe(60 + 10); // Int 40 + 20 avances Langue = 60, + Soutien 10
  });

  it('Test résolu (Round unique DR≥NI) dissipe le sort permanent sur la cible du groupe', () => {
    const { cible } = setup();
    banc.getState().dissiperLeSort('mage', 'malefice', 'ennemi');
    const pd = banc.getState().pendingDispel!;
    banc.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
    banc.getState().jetValider('dissipation');
    const cibleAfter = banc.getState().party.find((c) => c.id === cible.id)!;
    expect((cibleAfter.activeEffects ?? []).some((e) => e.spell?.spellId === 'malefice')).toBe(false);
    const mageAfter = banc.getState().party.find((c) => c.id === 'mage')!;
    expect(mageAfter.dispel).toBeUndefined();
    expect(banc.getState().pendingDispel).toBeNull();
  });

  // Dissiper son PROPRE Sort (`VDM 02 l.186`), hors combat — mesuré OFF puis ON sur un jet IDENTIQUE :
  // le bonus est un DR (`caster.dispel.total`, l'accumulateur RÉEL), jamais la cible du Test
  // (`pendingDispel.value`, en points — un DR vaut une dizaine, `tests.ts:98`).
  it('dissipe son propre Sort hors combat : +1 DR CUMULÉ seulement sous `magie-vdm-incantation`', () => {
    const freshMage = () => mk('mage', ['forme-bestiale'], {
      activeEffects: [{ label: 'Malédiction', characteristic: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 3, casterId: 'mage', label: 'Maléfice' } }],
    });
    const roundDR = (rule: boolean) => {
      banc.setState({ party: [freshMage()], pendingDispel: null });
      if (rule) setRule('magie-vdm-incantation', true);
      banc.getState().dissiperLeSort('mage', 'malefice', 'mage');
      const pd = banc.getState().pendingDispel!;
      banc.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
      banc.getState().jetValider('dissipation');
      const total = banc.getState().party.find((c) => c.id === 'mage')!.dispel!.total;
      if (rule) resetRule('magie-vdm-incantation');
      return total;
    };
    expect(roundDR(false)).toBe(1); // OFF (LDB 46 l.154-162) : le DR du jet seul (sl:1), aucun bonus.
    expect(roundDR(true)).toBe(2); // ON (VDM 02 l.186) : +1 DR cumulé de plus sur le MÊME jet.
  });

  it('sans la compétence Langue (Magick) : refus journalisé, aucun pending', () => {
    const mage = mk('mage', ['forme-bestiale'], { skills: [] });
    const cible = mk('cible', [], {
      activeEffects: [{ label: 'Malédiction', characteristic: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 1, casterId: 'ennemi', label: 'Maléfice' } }],
    });
    banc.setState({ party: [mage, cible] });
    banc.getState().dissiperLeSort('mage', 'malefice', 'ennemi');
    expect(banc.getState().pendingDispel).toBeNull();
  });

  it('aucun sort dissipable ne matche : no-op', () => {
    setup();
    banc.getState().dissiperLeSort('mage', 'introuvable', 'ennemi');
    expect(banc.getState().pendingDispel).toBeNull();
  });
});
