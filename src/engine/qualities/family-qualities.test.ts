import { describe, it, expect } from 'vitest';
import { itemFromTrappingById } from '../items';
import { resolveQualities } from './dispatch';
import { idNeufDeBanc } from '../../lib/entityId.testkit';

describe('resolveQualities — qualités de FAMILLE (WeaponGroupData.qualities) mergées avec les qualités propres', () => {
  it('rapière (subType escrime) : Rapide+Empaleuse viennent de la famille (absentes de ses qualités propres)', () => {
    const rapiere = itemFromTrappingById('rapiere', idNeufDeBanc)!;
    expect(rapiere.qualities.map((q) => q.id)).not.toContain('rapide');
    expect(rapiere.qualities.map((q) => q.id)).not.toContain('empaleuse');
    const ids = resolveQualities(rapiere).map((r) => r.id).sort();
    expect(ids).toEqual(['empaleuse', 'rapide'].sort());
  });

  it('fleuret (escrime, qualités propres Pointue+Inoffensive en plus) : union sans doublon', () => {
    const fleuret = itemFromTrappingById('fleuret', idNeufDeBanc)!;
    const ids = resolveQualities(fleuret).map((r) => r.id).sort();
    expect(ids).toEqual(['empaleuse', 'inoffensive', 'pointue', 'rapide'].sort());
    expect(new Set(ids).size).toBe(ids.length); // pas de doublon
  });

  it('conflit : la qualité PROPRE de l’arme l’emporte sur celle de la famille (même id, value distincte)', () => {
    const synth = { subType: 'escrime', qualities: [{ id: 'empaleuse', value: 2 }] };
    const resolved = resolveQualities(synth);
    const empaleuses = resolved.filter((r) => r.id === 'empaleuse');
    expect(empaleuses).toHaveLength(1);
    expect(empaleuses[0].indice).toBe(2);
    expect(resolved.map((r) => r.id)).toContain('rapide'); // famille toujours ajoutée pour l'id absent
  });

  it('groupe SANS qualités de famille (base) : résolu = qualités propres seules', () => {
    const synth = { subType: 'base', qualities: [{ id: 'precise' }] };
    expect(resolveQualities(synth).map((r) => r.id)).toEqual(['precise']);
  });
});
