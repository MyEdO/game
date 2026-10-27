import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { addPossession, stablePossession } from '../noyau/possessionsFlow';
import { snapshotSave, lireSave, type SaveGame } from '../noyau/persistance/save';
import { possessionTotalEnc } from '../engine/possession';
import type { Possession } from '../engine/possession';

type VehiculePossession = Extract<Possession, { nature: 'vehicule' }>;
type BetePossession = Extract<Possession, { nature: 'bete' }>;

const vehicule = (vehicleId: string, cargo: VehiculePossession['cargo']): Omit<VehiculePossession, 'uid'> => ({
  nature: 'vehicule', ownerId: 'h1', location: { kind: 'avec-le-groupe' }, items: [], vehicleId, cargo,
});

const bete = (creatureId: string, cargo: BetePossession['cargo']): Omit<BetePossession, 'uid'> => ({
  nature: 'bete', ownerId: 'h1', location: { kind: 'avec-le-groupe' }, items: [], ref: { creatureId }, cargo,
});

/**
 * Scénario-étalon TERRESTRE (§5 spec, T1-c2, #616) : une charrette déposée à l'écurie (`au-lieu`) +
 * une mule chargée voyageant `avec-le-groupe` — porteurs terrestres seuls, aucune embarquée (récursion
 * triviale). Vérifie la CONSERVATION de `possessionTotalEnc` à travers un round-trip de sauvegarde
 * (snapshotSave → lireSave) — l'invariant de contenance survit la sérialisation.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

describe('scénario-étalon possessions — charrette + mule chargée (terrestre, §5)', () => {
  it('possessionTotalEnc survit à un round-trip snapshotSave → lireSave', () => {
    const charretteUid = addPossession(get, set, vehicule('charrette', [{ cargoId: 'grain', enc: 15, basePriceGold: 3 }]));
    stablePossession(get, set, charretteUid, 'ecurie');
    const muleUid = addPossession(get, set, bete('mule', [{ cargoId: 'vin', enc: 4, basePriceGold: 8 }]));

    const before = get().possessions;
    const charretteBefore = before.find((p) => p.uid === charretteUid)!;
    const muleBefore = before.find((p) => p.uid === muleUid)!;
    const encCharretteBefore = possessionTotalEnc(charretteBefore, before);
    const encMuleBefore = possessionTotalEnc(muleBefore, before);
    expect(encCharretteBefore).toBe(25); // 10 (own, catalogue) + 15 (cargo) + 0 (items)
    expect(encMuleBefore).toBe(10); // 6 (own, Taille Moyenne, MDG 12 l.25-33) + 4 (cargo) + 0 (items)

    const save = snapshotSave(get(), '2512-01-01');
    const migrated = lireSave(JSON.stringify(save)) as SaveGame;
    const after = migrated.data.possessions as Possession[];
    const charretteAfter = after.find((p) => p.uid === charretteUid)!;
    const muleAfter = after.find((p) => p.uid === muleUid)!;

    expect(possessionTotalEnc(charretteAfter, after)).toBe(encCharretteBefore);
    expect(possessionTotalEnc(muleAfter, after)).toBe(encMuleBefore);
    expect(charretteAfter.location).toEqual({ kind: 'au-lieu', placeId: 'ecurie' });
    expect(muleAfter.location).toEqual({ kind: 'avec-le-groupe' });
  });
});
