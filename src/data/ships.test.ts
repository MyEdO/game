import { describe, it, expect } from 'vitest';
import { findVehicleById, vehicles } from './index';
import { schema as schemaDesVehicules } from './schemas/defs/vehicles';
import { vehicleCombatant } from '../engine/vehicle';
import { shipHitLocation } from '../engine/combat';
import { rigDuNavire } from '../engine/shipBuild';
import { shipCritSet, shipCritSetIds } from './shipCriticals';

/** MDG 12 l.86-103 */
const EXEMPLES_DE_BATEAUX = [
  'coracle', 'barque-fluviale', 'esquif', 'barge-fluviale', 'grande-barge', 'bateau-de-patrouille', 'knarr', 'langskip', 'cogue',
  'caraque', 'galere-de-guerre', 'loup-imperial', 'croiseur', 'galion-bretonnien', 'caravelle-tileenne',
  'chebec-arabien', 'boutre-d-inja', 'bateau-tresor-cathayen',
];
const ships = vehicles.filter((v) => v.ship && EXEMPLES_DE_BATEAUX.includes(v.id));

describe('Navires MDG (ch.12) — profils en donnée', () => {
  it('table EXEMPLES DE BATEAUX complète (MDG 12 l.86-103), chaque navire avec coque (E/B) + facette ship complète', () => {
    expect(EXEMPLES_DE_BATEAUX.filter((id) => !ships.some((s) => s.id === id)), 'navire de la table absent').toEqual([]);
    for (const s of ships) {
      expect(s.hull?.char.endurance).toBeGreaterThan(0);
      expect(s.hull?.char.B).toBeGreaterThan(0);
      expect(['fluvial', 'maritime']).toContain(s.hull?.propulsion);
      expect(s.ship!.crew).toBeGreaterThan(0);
      expect(s.ship!.sail || s.ship!.oars).toBeTruthy(); // au moins un mode de propulsion
    }
  });

  // MDG 12 l.87, l.89
  it.each([
    ['barque-fluviale', { crew: 2, manoeuvre: 2 }],
    ['barge-fluviale', { crew: 4, manoeuvre: 0 }],
  ] as const)('profil naval de %s', (id, profil) => {
    expect(findVehicleById(id)?.ship).toMatchObject(profil);
  });

  // MSRC 07 l.174-178 ; MDG 12 l.87-91
  it.each([
    ['barque-fluviale', 10, 5, 4, 25],
    ['esquif', 15, 10, 6, 35],
    ['barge-fluviale', 20, 15, 8, 100],
    ['grande-barge', 30, 25, 6, 180],
    ['bateau-de-patrouille', 25, 20, 9, 420],
  ] as const)('gabarits sourcés de %s', (id, lengthM, fluvialLengthM, fluvialMovement, fluvialEnc) => {
    expect(findVehicleById(id)?.ship).toMatchObject({ lengthM, fluvialLengthM, fluvialMovement, fluvialEnc });
  });

  it.each([undefined, null, 0])('le schéma refuse un Mouvement fluvial de %s dans un gabarit déclaré', (fluvialMovement) => {
    const barque = findVehicleById('barque-fluviale')!;
    expect(schemaDesVehicules.safeParse([{ ...barque, ship: { ...barque.ship!, fluvialMovement } }]).success).toBe(false);
  });

  it('le schéma accepte une coque maritime sans gabarit fluvial', () => {
    expect(schemaDesVehicules.safeParse([findVehicleById('cogue')]).success).toBe(true);
  });

  it('les bateaux de la table n’occupent qu’une fiche par type', () => {
    expect(findVehicleById('barge')).toBeUndefined();
    expect(findVehicleById('chaloupe')).toBeUndefined();
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
    const cogue = vehicles.find((v) => v.id === 'cogue')!; // voile, E45/B50
    const c = vehicleCombatant(cogue)!;
    expect(c.bodyShape).toBe('vehicule');
    expect(c.wounds.max).toBe(50);
    expect(c.characteristics.endurance).toBe(45);
    // un coup à d100=15 sur un voilier touche le Gréement (MDG 13)
    expect(shipHitLocation(rigDuNavire(cogue.ship!)!, 15)).toBe('greement');
  });
});

describe('Table de Localisation d’une COQUE — vocabulaire fermé, résolution fail-fast', () => {
  const hulls = vehicles.filter((v) => v.hull);

  it('les coques ne portent qu’un id de table CONNU (absent = `navire` MDG 13, seule autre valeur `navire-fluvial` MSRC 7)', () => {
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
  const hulls = vehicles.filter((v) => v.hull);

  it('les coques ne portent qu’un id de jeu CHARGÉ (absent = `ship-criticals` MDG 13, seule autre valeur `river-criticals`)', () => {
    expect(shipCritSetIds()).toEqual(['ship-criticals', 'river-criticals']);
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
