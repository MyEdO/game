import { describe, it, expect } from 'vitest';
import { spells } from '../../data';
import { pregenParty, PREGEN } from '../../data/pregens';
import { focusSkillFor } from '../../engine/magic';
import { hasWeaponGroupSkill } from '../../engine/combat';
import { ARC_DOMAINS, makeFlagellant, makeSorceress } from './_casters';

// LDB 09 l.245-250.
describe('makeSorceress — Focalisation par id de Domaine', () => {
  const sorc = makeSorceress('sorc', 'Sorcière', { x: 0, y: 0 });
  it.each(ARC_DOMAINS)('un Sort du Domaine « %s » trouve sa Focalisation spécialisée', (domaine) => {
    const sort = spells.find((s) => s.domainId === domaine)!;
    expect(sort, domaine).toBeDefined();
    expect(focusSkillFor(sorc, sort)?.spec).toBe(domaine);
  });
});

// LDB 62 l.138-139.
describe('makeFlagellant — Corps à corps (Armes d’hast) couvre la hache d’armes', () => {
  const f = makeFlagellant(pregenParty(PREGEN.pretre)[0], 'fl', 'Flagellant', 'ulric', {}, { x: 0, y: 0 });
  it('la Spécialisation posée par id est celle du Groupe de l’arme tenue', () => {
    const hache = f.weapons.find((w) => w.subType === 'armes-d-hast');
    expect(hache, f.weapons.map((w) => w.subType).join(',')).toBeDefined();
    expect(hasWeaponGroupSkill(f, hache!, 'melee')).toBe(true);
  });
});
