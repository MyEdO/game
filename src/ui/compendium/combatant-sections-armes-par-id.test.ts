import { describe, it, expect } from 'vitest';
import { combatantSections, codexLookup, type CodexRow } from './registry';
import { pregen, PREGEN } from '../../data/pregens';
import { itemFromTrappingById, weaponFromItem, buildWeapon, unarmedWeapon } from '../../engine/items';
import type { Weapon } from '../../engine/types';

/** Rangées de la section « Armes » du statbloc d'un combattant portant `weapons`. */
function rangeesArmes(weapons: Weapon[]): CodexRow[] {
  const c = { ...pregen(PREGEN.soldat), weapons };
  return combatantSections(c).find((s) => s.title === 'Armes')?.rows ?? [];
}
const arme = (trappingId: string): Weapon => weaponFromItem(itemFromTrappingById(trappingId)!);

describe('combatantSections — une arme se lie au Codex par son id de catalogue', () => {
  it.each(['gaffe-2', 'couteau-2', 'baliste-ade2'])('%s : lien par `trappingId`, jamais par son libellé homonyme', (id) => {
    const w = arme(id);
    expect(w.trappingId).toBe(id);
    expect(codexLookup('trappings', w.label)?.id).not.toBe(id);
    const [row] = rangeesArmes([w]);
    expect(row).toMatchObject({ t: 'ref', category: 'trappings', id, show: w.label });
  });

  it('Mains nues : lien par son `builtinId` de catalogue', () => {
    const w = unarmedWeapon();
    expect(w.trappingId).toBeUndefined();
    const [row] = rangeesArmes([w]);
    expect(row).toMatchObject({ t: 'ref', category: 'trappings', id: w.builtinId });
  });

  it('arme sans id de catalogue : pastille nue, sans lien', () => {
    const w = buildWeapon({ label: 'Morsure', damage: { plusBF: true, flat: 2 }, natural: true });
    const [row] = rangeesArmes([w]);
    expect(row).toMatchObject({ t: 'chip', label: 'Morsure' });
  });
});
