/**
 * engine/dispel — Dissipation de sorts permanents (LDB 46 l.158-162), partie PURE.
 * Énumération (regroupée par sort+lanceur) et retrait propre des effets marqués à l'incantation (Stage 1).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { applyOps } from './ops';
import { dispellableSpellsOn, dissipateSpell } from './dispel';
import { desDuTest } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

function mk(id: string, p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  }) as Combatant;
}

// Pose un sort durable (charMod) sur une cible, marqué à l'incantation (OpsCtx.sourceSpell).
function cast(target: Combatant, spell: { spellId: string; ni: number; casterId: string; label: string }, char: 'force-mentale' | 'force' = 'force-mentale', mod = 10) {
  applyOps(target, [{ op: 'charMod', char, mod }], { rng: desDuTest, label: spell.label, defaultDurationRounds: 5, sourceSpell: spell });
}

describe('dispel — énumération des sorts permanents actifs', () => {
  it("regroupe par (sort, lanceur) : un sort de zone sur 2 cibles = 1 entrée, 2 porteurs", () => {
    const a = mk('a'), b = mk('b');
    const ecorce = { spellId: 'ecorce', ni: 4, casterId: 'mage', label: 'Écorce' };
    cast(a, ecorce); cast(b, ecorce);
    const list = dispellableSpellsOn([a, b]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ spellId: 'ecorce', ni: 4, casterId: 'mage', label: 'Écorce' });
    expect(list[0].carriers.sort()).toEqual(['a', 'b']);
  });

  it('distingue deux sorts/lanceurs différents avec leur NI propre', () => {
    const a = mk('a');
    cast(a, { spellId: 'ecorce', ni: 4, casterId: 'mage1', label: 'Écorce' });
    cast(a, { spellId: 'haine', ni: 7, casterId: 'mage2', label: 'Vol' }, 'force-mentale', -10);
    const list = dispellableSpellsOn([a]);
    expect(list).toHaveLength(2);
    expect(list.map((d) => d.ni).sort()).toEqual([4, 7]);
  });

  it('ignore les effets non magiques (sans marque de sort)', () => {
    const a = mk('a', { activeEffects: [{ label: 'Drogue', char: 'force', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(dispellableSpellsOn([a])).toHaveLength(0);
  });
});

describe('dispel — retrait à la dissipation', () => {
  it('retire les effets du sort dissipé sur TOUS les porteurs, laisse les autres intacts', () => {
    const a = mk('a'), b = mk('b');
    const ecorce = { spellId: 'ecorce', ni: 4, casterId: 'mage', label: 'Écorce' };
    cast(a, ecorce); cast(b, ecorce);
    cast(a, { spellId: 'benediction', ni: 0, casterId: 'pretre', label: 'Bénédiction' }, 'force', 20); // autre sort sur a (carac F ≠ FM → coexiste)
    const cleaned = dissipateSpell([a, b], 'ecorce', 'mage');
    expect(cleaned).toBe(2); // a et b nettoyés
    expect((a.activeEffects ?? []).some((e) => e.spell?.spellId === 'ecorce')).toBe(false);
    expect((b.activeEffects ?? []).length).toBe(0);
    expect((a.activeEffects ?? []).some((e) => e.spell?.spellId === 'benediction')).toBe(true); // l'autre sort survit
  });
});
