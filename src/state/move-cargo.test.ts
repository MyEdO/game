import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from '../noyau/monde/scene';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { carrierById, persistCarriersCargo } from '../noyau/carriers';
import type { WorldMap } from '../noyau/worldMap';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

/**
 * #327 lot C — transfert de cargaison entre porteurs CO-LOCALISÉS (`moveCargo` → `transferCargo` du tronc).
 * Les porteurs du groupe partagent le Lieu courant (co-localisés) ; le transfert route par le tronc PUR et
 * RE-PERSISTE les deux `Possession.cargo` (SOCLE POSSESSIONS #617/#618). Refus (moved 0) si la cible est
 * pleine (plafond dur v1).
 */
const get = useGame.getState.bind(useGame);

// Place dont la scène EST la scène courante → tous les porteurs du groupe y sont co-localisés.
const map: WorldMap = { id: 'm', label: 'x', places: [{ id: 'P', label: 'Halte', pos: { x: 0, y: 0 }, scene: 'halte' }], routes: [] };

function setup(muleCargo: CargoLot[], cartCargo: CargoLot[]) {
  const party = makePregens().slice(0, 1);
  const ownerId = party[0].id;
  const possessions: Possession[] = [
    { uid: 'mule', ownerId, nature: 'bete', ref: { creatureId: 'mule' }, location: { kind: 'avec-le-groupe' }, items: [], cargo: muleCargo }, // encPortee 14
    { uid: 'cart', ownerId, nature: 'vehicule', vehicleId: 'charrette', location: { kind: 'avec-le-groupe' }, items: [], cargo: cartCargo }, // chargement 25
  ];
  useGame.setState({
    party, vessel: null, worldMap: map, possessions,
    scene: { ...emptyScene(2, 2), id: 'halte', label: 'Halte', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, journal: [],
  } as never);
}

describe('moveCargo — transfert entre porteurs co-localisés', () => {
  beforeEach(() => setup([{ cargoId: 'vin', enc: 10, basePriceGold: 3 }], []));

  it('déplace du vrac d’un porteur à un autre et RE-PERSISTE les deux (source unique Possession.cargo)', () => {
    get().moveCargo('mule', 'cart', 'vin', 6);
    expect(carrierById(get(), 'mule')!.cargo).toEqual([{ cargoId: 'vin', enc: 4, basePriceGold: 3 }]);
    expect(carrierById(get(), 'cart')!.cargo).toEqual([{ cargoId: 'vin', enc: 6, basePriceGold: 3 }]);
  });

  it('REFUSE (moved 0) si le porteur cible est plein — plafond dur', () => {
    setup([{ cargoId: 'vin', enc: 10, basePriceGold: 3 }], [{ cargoId: 'sel', enc: 25, basePriceGold: 1 }]); // charrette pleine (25/25)
    get().moveCargo('mule', 'cart', 'vin', 6);
    expect(carrierById(get(), 'mule')!.cargo).toEqual([{ cargoId: 'vin', enc: 10, basePriceGold: 3 }]); // inchangé
    expect(get().journal.some((l) => /Transfert impossible/.test(l))).toBe(true);
  });

  it('porteur inconnu = no-op', () => {
    const before = carrierById(get(), 'mule')!.cargo;
    get().moveCargo('mule', 'inconnu', 'vin', 6);
    expect(carrierById(get(), 'mule')!.cargo).toEqual(before);
  });

  it('persistCarriersCargo n’écrit QUE les porteurs visés (les autres restent intacts)', () => {
    const patch = persistCarriersCargo(get(), [{ carrierId: 'mule', cargo: [] }]);
    expect(patch.possessions!.find((p) => p.uid === 'mule')!.cargo).toEqual([]);
    expect(patch.possessions!.find((p) => p.uid === 'cart')!.cargo).toEqual([]); // cargaison de départ (setup), inchangée
  });
});
