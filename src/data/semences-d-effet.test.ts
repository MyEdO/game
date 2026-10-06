/**
 * #1882, #2404 — ce qu'un effet NEUF sème avant tout choix d'auteur (`creatureSemee`, `vehiculeSeme`,
 * `navireSeme`, lus par `state/combatEffects.ts` et `ui/editor/EffectList.tsx`) : la PREMIÈRE entrée
 * offerte par son catalogue, et une entrée qui y EXISTE.
 */
import { describe, expect, it } from 'vitest';
import { creatureSemee, vehiculeSeme, navireSeme, creatures, vehicles, findCreatureById, findVehicleById } from './index';

describe('semences d’effet — la réf. semée est la PREMIÈRE offerte par le catalogue (#1882)', () => {
  it('créature : la première du catalogue des créatures, qui y existe', () => {
    expect(creatureSemee()).toBe(creatures[0].id);
    expect(findCreatureById(creatureSemee())?.id).toBe(creatureSemee());
  });

  it('véhicule : le premier du catalogue des véhicules, qui y existe', () => {
    expect(vehiculeSeme()).toBe(vehicles[0].id);
    expect(findVehicleById(vehiculeSeme())?.id).toBe(vehiculeSeme());
  });

  it('navire : le premier véhicule `ship` du catalogue, qui y existe et EST un navire', () => {
    expect(navireSeme()).toBe(vehicles.find((v) => v.ship)!.id);
    expect(findVehicleById(navireSeme())?.ship).toBeTruthy();
  });
});
