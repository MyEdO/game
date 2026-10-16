import { describe, it, expect } from 'vitest';
import { VEHICLES_LIST } from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
import { shipHitLocation } from '../engine/combat';
import { rigDuNavire } from '../engine/shipBuild';
import { shipCritSet, SHIP_CRIT_SET_IDS } from './shipCriticals';

// MDG 12 = navires MARITIMES (18). Les bateaux FLUVIAUX MSRC (propulsion:'fluvial') ont aussi une
// facette `ship` mais relèvent de leur propre table (MSRC 7) — couverts par `16-embuscade-fluviale`.
const ships = VEHICLES_LIST.filter((v) => v.ship && v.hull?.propulsion === 'maritime');

describe('Navires MDG (ch.12) — profils en donnée', () => {
  it('18 navires (table EXEMPLES DE BATEAUX complète), chacun avec coque (E/B) + facette ship complète', () => {
    expect(ships.length).toBe(18);
    for (const s of ships) {
      expect(s.hull?.char.endurance).toBeGreaterThan(0);
      expect(s.hull?.char.B).toBeGreaterThan(0);
      expect(s.hull?.propulsion).toBe('maritime');
      expect(s.ship!.crew).toBeGreaterThan(0);
      expect(s.ship!.sail || s.ship!.oars).toBeTruthy(); // au moins un mode de propulsion
    }
  });

  it('gréement dérivé de la propulsion (avirons/voile/mixte)', () => {
    const by = (id: string) => ships.find((s) => s.id === id)!;
    expect(rigDuNavire(by('coracle').ship!)).toBe('avirons'); // avirons seuls
    expect(rigDuNavire(by('caraque').ship!)).toBe('voile'); // voiles seules
    expect(rigDuNavire(by('langskip').ship!)).toBe('mixte'); // voiles + avirons
  });

  it('valeurs verbatim (Caraque E55/B90, Croiseur B275)', () => {
    expect(ships.find((s) => s.id === 'caraque')!.hull!.char).toEqual({ endurance: 55, B: 90 });
    expect(ships.find((s) => s.id === 'croiseur')!.hull!.char.B).toBe(275);
  });

  it('Bateau-trésor cathayen : ligne verbatim de la table (MDG 12 l.103)', () => {
    const bt = ships.find((s) => s.id === 'bateau-tresor-cathayen')!;
    expect(bt.purchase!.price.gold).toBe(10000);
    expect(bt.hull!.char).toEqual({ endurance: 50, B: 400 });
    expect(rigDuNavire(bt.ship!)).toBe('voile');
    expect(bt.ship!).toMatchObject({ crew: 220, manoeuvre: 0, lengthM: 130, capacity: 4000, sail: { m: 9, crew: 200 } });
  });

  it("un navire devient un Combattant à coque, frappé via la localisation de son gréement", () => {
    const cogue = VEHICLES_LIST.find((v) => v.id === 'cogue')!; // voile, E45/B50
    const c = vehicleCombatant(cogue)!;
    expect(c.bodyShape).toBe('vehicule');
    expect(c.wounds.max).toBe(50);
    expect(c.characteristics.endurance).toBe(45);
    // un coup à d100=15 sur un voilier touche le Gréement (MDG 13)
    expect(shipHitLocation(rigDuNavire(cogue.ship!)!, 15)).toBe('greement');
  });
});

describe('Table de Localisation d’une COQUE — vocabulaire fermé, résolution fail-fast', () => {
  const hulls = VEHICLES_LIST.filter((v) => v.hull);

  it('les 29 coques ne portent qu’un id de table CONNU (absent = `navire` MDG 13, seule autre valeur `navire-fluvial` MSRC 7)', () => {
    expect(hulls.length).toBe(29);
    const distinct = [...new Set(hulls.map((v) => v.hull!.locationTable).filter((t) => t != null))];
    expect(distinct).toEqual(['navire-fluvial']);
    for (const v of hulls) {
      expect(() => shipHitLocation(rigDuNavire(v.ship ?? {}) ?? 'voile', 50, v.hull!.locationTable ?? 'navire'), v.id).not.toThrow();
    }
  });

  it('un id de table INCONNU LÈVE au lieu de retomber en silence sur la table maritime', () => {
    expect(() => shipHitLocation('voile', 50, 'navire-fluvail')).toThrow(/navire-fluvail/);
  });
});

describe('Jeu de Critiques d’une COQUE — vocabulaire fermé, résolution fail-fast', () => {
  const hulls = VEHICLES_LIST.filter((v) => v.hull);

  it('les coques ne portent qu’un id de jeu CHARGÉ (absent = `ship-criticals` MDG 13, seule autre valeur `river-criticals`)', () => {
    expect(SHIP_CRIT_SET_IDS).toEqual(['ship-criticals', 'river-criticals']);
    const distinct = [...new Set(hulls.map((v) => v.hull!.criticalTable).filter((t) => t != null))];
    expect(distinct).toEqual(['river-criticals']);
    for (const v of hulls) expect(() => shipCritSet(v.hull!.criticalTable), v.id).not.toThrow();
    expect(shipCritSet(undefined).id).toBe('ship-criticals');
    expect(shipCritSet('river-criticals').id).toBe('river-criticals');
  });

  it('un id de jeu INCONNU LÈVE au lieu de retomber en silence sur les tables maritimes', () => {
    expect(() => shipCritSet('critiques-fluviaux')).toThrow(/critiques-fluviaux/);
  });
});
