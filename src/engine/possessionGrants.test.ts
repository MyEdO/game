import { describe, it, expect } from 'vitest';
import { possessionGrantsFromRefs } from './possessionGrants';
import type { TrappingRef } from '../data';
import { makeRNG } from './dice';

describe('possessionGrantsFromRefs (#617/#618 SOCLE POSSESSIONS Lot 1)', () => {
  it('{id, type: vehicle} → grant vehicule avec-le-groupe, owner = ownerId', () => {
    const refs: TrappingRef[] = [{ id: 'barque-fluviale', type: 'vehicle' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-1', makeRNG(1));
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ nature: 'vehicule', vehicleId: 'barque-fluviale', ownerId: 'hero-1', location: { kind: 'avec-le-groupe' }, items: [] });
  });

  it('{id, type: creature} → grant bete (ref.id), avec-le-groupe, owner = ownerId', () => {
    const refs: TrappingRef[] = [{ id: 'mule', type: 'creature' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-2', makeRNG(1));
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ nature: 'bete', ref: { id: 'mule' }, ownerId: 'hero-2', location: { kind: 'avec-le-groupe' }, items: [] });
  });

  it('count.fixed > 1 → autant de grants DISTINCTS (aucun aliasing d\'objet/items/location)', () => {
    const refs: TrappingRef[] = [{ id: 'mule', type: 'creature', count: { fixed: 3 } }];
    const grants = possessionGrantsFromRefs(refs, 'h', makeRNG(1));
    expect(grants).toHaveLength(3);
    expect(grants[0]).not.toBe(grants[1]);
    expect(grants[1]).not.toBe(grants[2]);
    expect(grants[0].items).not.toBe(grants[1].items);
    expect(grants[0].location).not.toBe(grants[1].location);
  });

  it('{id} (objet de sac) et {text} (flavor) ignorés — pas des possessions', () => {
    const refs: TrappingRef[] = [{ id: 'baril' }, { text: 'Réseau d\'informateurs' }];
    expect(possessionGrantsFromRefs(refs, 'h', makeRNG(1))).toHaveLength(0);
  });

  it('mix de refs — seules les dotations de possession produisent, dans l\'ordre', () => {
    const refs: TrappingRef[] = [{ id: 'baril' }, { id: 'chariot-leger', type: 'vehicle' }, { id: 'mule', type: 'creature' }, { text: 'flavor' }];
    const grants = possessionGrantsFromRefs(refs, 'h', makeRNG(1));
    expect(grants.map((g) => g.nature)).toEqual(['vehicule', 'bete']);
  });

  it('{id, type: creature, label} → le label propre de la dotation est transporté sur la PossessionInput', () => {
    const refs: TrappingRef[] = [{ id: 'blaireau', type: 'creature', label: 'Gros blaireau apprivoisé' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-3', makeRNG(1));
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ nature: 'bete', ref: { id: 'blaireau' }, label: 'Gros blaireau apprivoisé' });
  });

  it('{id, type: creature} SANS label → aucun `label` posé (repli sur le libellé de créature via possessionLabel)', () => {
    const refs: TrappingRef[] = [{ id: 'mule', type: 'creature' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-4', makeRNG(1));
    expect(grants[0]).not.toHaveProperty('label');
  });

  it('{id, type: vehicle, label} → le label propre de la dotation est transporté sur la PossessionInput', () => {
    const refs: TrappingRef[] = [{ id: 'barque-fluviale', type: 'vehicle', label: 'La Perle Grise' }];
    const grants = possessionGrantsFromRefs(refs, 'hero-5', makeRNG(1));
    expect(grants[0]).toMatchObject({ nature: 'vehicule', vehicleId: 'barque-fluviale', label: 'La Perle Grise' });
  });

  it('count.roll (1d10) → N tiré via le rouleur canonique, déterministe par seed', () => {
    const refs: TrappingRef[] = [{ id: 'bateau-de-patrouille', type: 'vehicle', count: { roll: { n: 1, sides: 10 } } }];
    const grantsA = possessionGrantsFromRefs(refs, 'h', makeRNG(1));
    const grantsB = possessionGrantsFromRefs(refs, 'h', makeRNG(1));
    const grantsC = possessionGrantsFromRefs(refs, 'h', makeRNG(2));
    expect(grantsA).toHaveLength(grantsB.length);
    expect(grantsA.length).toBeGreaterThanOrEqual(1);
    expect(grantsA.length).toBeLessThanOrEqual(10);
    expect(grantsA.length).not.toBe(grantsC.length);
    expect(grantsA.every((g) => g.nature === 'vehicule' && g.vehicleId === 'bateau-de-patrouille')).toBe(true);
  });

  it('sans count → 1 grant', () => {
    const refs: TrappingRef[] = [{ id: 'barque-fluviale', type: 'vehicle' }];
    expect(possessionGrantsFromRefs(refs, 'h', makeRNG(1))).toHaveLength(1);
  });
});
