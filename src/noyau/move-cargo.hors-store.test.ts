import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { carrierById, persistCarriersCargo } from './carriers';
import { t } from '../i18n';
import type { WorldMap } from './worldMap';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #327 lot C — transfert de cargaison entre porteurs CO-LOCALISÉS (`deplacerLaCargaison` → `transferCargo` du tronc).
 * Les porteurs du groupe partagent le Lieu courant (co-localisés) ; le transfert route par le tronc PUR et
 * RE-PERSISTE les deux `Possession.cargo` (SOCLE POSSESSIONS #617/#618). Refus (moved 0) si la cible est
 * pleine (plafond dur v1).
 */
const get = () => banc.getState();

// Place dont la scène EST la scène courante → tous les porteurs du groupe y sont co-localisés.
const map: WorldMap = { id: 'm', label: 'x', places: [{ id: 'P', label: 'Halte', pos: { x: 0, y: 0 }, scene: { id: 'halte' } }], routes: [] };

function setup(muleCargo: CargoLot[], cartCargo: CargoLot[]) {
  const party = tousLesHerosDeScenario(idsDeTest).slice(0, 1);
  const ownerId = party[0].id;
  const possessions: Possession[] = [
    { uid: 'mule', ownerId, nature: 'bete', ref: { id: 'mule' }, location: { kind: 'avec-le-groupe' }, items: [], cargo: muleCargo }, // encPortee 14
    { uid: 'cart', ownerId, nature: 'vehicule', vehicleId: 'charrette', location: { kind: 'avec-le-groupe' }, items: [], cargo: cartCargo }, // chargement 25
  ];
  banc.setState({
    party, vessel: null, worldMap: map, possessions,
    scene: { ...emptyScene('halte', 2, 2), label: 'Halte', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, journal: [],
  } as never);
}

const vin = (uid: string, enc: number, basePriceGold = 3): CargoLot => ({ uid, cargoId: 'vin-eau-de-vie', enc, basePriceGold });

describe('deplacerLaCargaison — transfert entre porteurs co-localisés', () => {
  beforeEach(() => setup([vin('lot-1', 10)], []));

  it('déplace du vrac d’un porteur à un autre et RE-PERSISTE les deux (source unique Possession.cargo)', () => {
    get().deplacerLaCargaison('lot-1', 'cart', 6);
    expect(carrierById(get(), 'mule')!.cargo).toEqual([vin('lot-1', 4)]);
    const [part] = carrierById(get(), 'cart')!.cargo;
    expect(part).toMatchObject({ cargoId: 'vin-eau-de-vie', enc: 6, basePriceGold: 3 });
    expect(part.uid, 'la part séparée naît avec son propre uid').not.toBe('lot-1');
  });

  it('deux lots du même bien : seul le lot désigné passe, l’autre et son prix restent', () => {
    setup([vin('lot-a', 4, 3), vin('lot-b', 5, 9)], []);
    get().deplacerLaCargaison('lot-b', 'cart', 5);
    expect(carrierById(get(), 'mule')!.cargo).toEqual([vin('lot-a', 4, 3)]);
    expect(carrierById(get(), 'cart')!.cargo).toEqual([vin('lot-b', 5, 9)]);
  });

  it('REFUSE (moved 0) si le porteur cible est plein — plafond dur', () => {
    setup([vin('lot-1', 10)], [{ uid: 'lot-2', cargoId: 'sel', enc: 25, basePriceGold: 1 }]); // charrette pleine (25/25)
    const refus = t('cg.ciblePleine', { porteur: carrierById(get(), 'cart')!.label });
    get().deplacerLaCargaison('lot-1', 'cart', 6);
    expect(carrierById(get(), 'mule')!.cargo).toEqual([vin('lot-1', 10)]); // inchangé
    expect(get().journal.some((l) => l.includes(refus)), 'la cible pleine est nommée').toBe(true);
  });

  it('porteur inconnu = no-op', () => {
    const before = carrierById(get(), 'mule')!.cargo;
    get().deplacerLaCargaison('lot-1', 'inconnu', 6);
    expect(carrierById(get(), 'mule')!.cargo).toEqual(before);
  });

  it('persistCarriersCargo n’écrit QUE les porteurs visés (les autres restent intacts)', () => {
    const patch = persistCarriersCargo(get(), [{ carrierId: 'mule', cargo: [] }]);
    expect(patch.possessions!.find((p) => p.uid === 'mule')!.cargo).toEqual([]);
    expect(patch.possessions!.find((p) => p.uid === 'cart')!.cargo).toEqual([]); // cargaison de départ (setup), inchangée
  });
});
