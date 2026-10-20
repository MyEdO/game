/**
 * CÂBLAGE de la nature RITUEL (`VDM 02 l.363` / `l.377-393`) jusqu'aux modificateurs de NI.
 *
 * Un Rituel est un Sort ; il ne s'en distingue que par un TAG (`SpellData.isRitual`), lu pour
 * composer le `CastingNumberSubject.kind` que les portées `kinds:['sort'|'rituel']` départagent.
 * Deux modificateurs curés en dépendent :
 *  - grimoire — `GRIMOIRE_NI_MODS` (`src/noyau/combatFlow.ts`), `VDM 12 l.646-647` ;
 *  - complexe Cairnapan — `arcane-phenomena.json`, `VDM 14 l.489`.
 *
 * Le piège que ce test ferme : le tag vivait dans l'interface TS SANS exister au `strictObject` du
 * schéma, donc aucune donnée ne pouvait le porter et les deux portées `rituel` étaient MORTES. La
 * chaîne se prouve donc du SCHÉMA (la donnée valide) jusqu'au NI (la portée mord).
 */
import { describe, it, expect } from 'vitest';
import { schema as spellsSchema } from './schemas/defs/spells';
import { spells } from './index';
import { arcanePhenomena } from './arcanePhenomena';
import { castingNumberOf } from '../engine/magic';
import { effectiveCastingNumber, type CastingNumberMod } from '../engine/castingNumber';
import { GRIMOIRE_NI_MODS } from '../noyau/combatFlow';

/** Entrée de sort RÉELLE (Caresse de Laniph), re-taguée Rituel — même forme que la donnée committée. */
const asRituel = () => {
  const e = JSON.parse(JSON.stringify(spells.find((s) => s.id === 'caresse-de-laniph')));
  delete e.variants; // le tag n'est pas un champ résolu de variante : on éprouve l'entrée de base
  e.id = 'rituel-temoin';
  e.isRitual = true;
  return e;
};

describe('schéma — `isRitual` est un champ ADMIS de `spells.json`', () => {
  it('une entrée portant `isRitual: true` valide', () => {
    const parsed = spellsSchema.safeParse([asRituel()]);
    expect(parsed.error?.message ?? 'ok').toBe('ok');
    expect(parsed.success).toBe(true);
  });

  it('le champ reste BOOLÉEN et le `strictObject` refuse toujours un voisin inventé', () => {
    const mauvaisType = { ...asRituel(), isRitual: 'oui' };
    expect(spellsSchema.safeParse([mauvaisType]).success).toBe(false);
    const inconnu = { ...asRituel(), estUnRituel: true };
    expect(spellsSchema.safeParse([inconnu]).success).toBe(false);
  });
});

describe('NI — une portée `kinds:[\'rituel\']` MORD sur une entrée taguée', () => {
  const sort = () => ({ ...asRituel(), isRitual: false });

  it('grimoire (`VDM 12 l.646-647`) : ×2 pour un Sort, ×4 pour un Rituel', () => {
    const base = asRituel().cn as number;
    expect(castingNumberOf(sort(), false, {}, GRIMOIRE_NI_MODS)).toBe(base * 2);
    expect(castingNumberOf(asRituel(), false, {}, GRIMOIRE_NI_MODS)).toBe(base * 4);
  });

  it('complexe Cairnapan (`VDM 14 l.489`) : le NI des Rituels de Ghyran est divisé, celui des Sorts NON', () => {
    const site = arcanePhenomena.find((p) => p.id === 'complexe-cairnapan')!;
    const mods = site.niMods as CastingNumberMod[];
    expect(mods.some((m) => m.scope?.kinds?.includes('rituel'))).toBe(true);
    const rituelGhyran = { id: 'r', domainId: 'vie', kind: 'rituel' as const };
    const sortGhyran = { id: 's', domainId: 'vie', kind: 'sort' as const };
    expect(effectiveCastingNumber(9, rituelGhyran, mods)).toBe(4);
    expect(effectiveCastingNumber(9, sortGhyran, mods)).toBe(9);
  });
});
