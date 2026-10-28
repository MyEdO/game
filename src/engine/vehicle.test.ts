import { describe, it, expect } from 'vitest';
import { makeRNG, type RNG } from './dice';
import { findVehicleById } from '../data';
import {
  vehicleCombatant,
  applyVehicleProblem,
  repairVehicleAttempt,
  forcedPaceCheck,
  forcedPaceBeastCheck,
  ligneAllureForcee,
} from './vehicle';
import { modDeRegle, refDeRegle } from './reglesChiffrees';
import { desEnSuite } from './dice.testkit';

/** RNG SCRIPTÉ : rend les jets dans l'ordre exact de consommation (aucun clamp — un jet de trop ou de
 *  moins rend `undefined` et fait échouer le test, ce qui EST le contrat mesuré). */
const script = (...vals: number[]): RNG => desEnSuite(vals);

describe('véhicule-à-coque (Combatant à PV)', () => {
  it('bâtit une coque depuis la facette hull (Diligence E45/B50)', () => {
    const diligence = findVehicleById('diligence')!;
    const c = vehicleCombatant(diligence)!;
    expect(c.id).toBe('vehicle-diligence');
    expect(c.label).toBe('Diligence');
    expect(c.bodyShape).toBe('vehicule');
    expect(c.characteristics.endurance).toBe(45);
    expect(c.wounds).toEqual({ current: 50, max: 50, base: 50 });
    expect(c.psychImmune).toBe(true);
  });

  it('sans facette hull → pas de coque (transport sans entité à PV)', () => {
    const transport = { ...findVehicleById('diligence')!, hull: undefined }; // entrée éditable sans `hull` (LDB 306)
    expect(vehicleCombatant(transport)).toBeUndefined();
  });

  it('Problème « Accident » (96-100) inflige 2d10 − Bonus d\'Endurance à la coque (min 1)', () => {
    const c = vehicleCombatant(findVehicleById('diligence')!)!; // BE = 4
    // makeRNG seedé : l'`applyOps`/`wounds` consomme le même flux que le test — on vérifie le RÉSULTAT.
    const r = applyVehicleProblem(c, 96, makeRNG(7));
    expect(r.entry.id).toBe('accident');
    const dealt = 50 - c.wounds.current;
    expect(dealt).toBeGreaterThanOrEqual(1); // 2d10 (2..20) − 4, plancher 1
    expect(dealt).toBeLessThanOrEqual(16);
  });

  it('Problème « Incontrôlable » (1-50) n\'endommage PAS la coque', () => {
    const c = vehicleCombatant(findVehicleById('diligence')!)!;
    const r = applyVehicleProblem(c, 10, makeRNG(1));
    expect(r.entry.id).toBe('incontrolable');
    expect(c.wounds.current).toBe(50); // aucun vehicleWounds
  });

  it('Problème « Cassé » (80-95) applique 1d10 − BE (min 1) et journalise', () => {
    const c = vehicleCombatant(findVehicleById('charrette')!)!; // E25/B10, BE = 2
    const r = applyVehicleProblem(c, 85, makeRNG(3));
    expect(r.entry.id).toBe('casse');
    expect(c.wounds.current).toBeLessThan(10);
    expect(c.wounds.current).toBeGreaterThanOrEqual(0);
    expect(r.lines.length).toBeGreaterThan(0);
  });
});

describe('réparation terrestre d’un véhicule (EDOC 07 l.349-353)', () => {
  it('matériaux/outils/installations réunis + Test réussi → (1d10 + DR) points rendus en 1 heure', () => {
    // Métier 50, jet 31 → réussite à +2 DR ; puis 1d10 = 6 → 8 points.
    const r = repairVehicleAttempt({ valeurMetier: 50, degatsSubis: 20, materiaux: true, outils: true, installations: true, rng: script(31, 6) });
    expect(r.possible).toBe(true);
    expect(r.test?.sl).toBe(2);
    expect(r.restaure).toBe(8);
    expect(r.heures).toBe(1);
    expect(r.degatsRestants).toBe(12);
  });

  it('la restauration est bornée par les Dégâts réellement subis', () => {
    const r = repairVehicleAttempt({ valeurMetier: 50, degatsSubis: 3, materiaux: true, outils: true, installations: true, rng: script(31, 6) });
    expect(r.restaure).toBe(3);
    expect(r.degatsRestants).toBe(0);
  });

  it('Test raté : l’heure est consommée (MAISON — l.353 attache l’heure à « chaque réparation »), aucun point rendu', () => {
    const r = repairVehicleAttempt({ valeurMetier: 50, degatsSubis: 20, materiaux: true, outils: true, installations: true, rng: script(71) });
    expect(r.test?.success).toBe(false);
    expect(r.restaure).toBe(0);
    expect(r.heures).toBe(1);
    expect(r.degatsRestants).toBe(20);
  });

  it('une seule des trois conditions matérielles manquante → aucun jet, aucune heure', () => {
    for (const manque of ['materiaux', 'outils', 'installations'] as const) {
      const p = { valeurMetier: 50, degatsSubis: 20, materiaux: true, outils: true, installations: true, rng: script() };
      const r = repairVehicleAttempt({ ...p, [manque]: false });
      expect(r.possible, manque).toBe(false);
      expect(r.test, manque).toBeUndefined();
      expect(r.heures, manque).toBe(0);
      expect(r.degatsRestants, manque).toBe(20);
    }
  });
});

describe('course forcée d’un attelage (EDOC 07 l.229, l.253)', () => {
  it('pénalité cumulative par kilomètre DÉJÀ couru, lue à sa fiche ; réussite → aucune bête éprouvée', () => {
    const parKm = modDeRegle('allure-forcee-attelage', 'par-km');
    const r = forcedPaceCheck({ valeurConduite: 45, kmDejaCourus: 2, animaux: [{ valeurResistance: 40 }], rng: script(20) });
    expect(r.ligne?.value).toBe(2 * parKm);
    expect(r.conduite.target).toBe(45 + 2 * parKm);
    expect(r.retourAuPas).toBe(false);
    expect(r.animaux).toEqual([]);
  });

  it('échec du conducteur : retour au pas + un Test de Résistance PAR animal', () => {
    // Conduite 45 (jet 60 → échec), puis Résistance 40 : jet 20 (réussi) et jet 45 (raté).
    const r = forcedPaceCheck({
      valeurConduite: 45,
      animaux: [{ valeurResistance: 40 }, { valeurResistance: 40 }],
      rng: script(60, 20, 45),
    });
    expect(r.ligne).toBeNull();
    expect(r.retourAuPas).toBe(true);
    expect(r.animaux).toHaveLength(2);
    expect(r.animaux[0].etats).toEqual([]);
    expect(r.animaux[1].etats).toEqual(['extenue']);
    expect(r.animaux[1].blessures).toBe(0);
  });

  it('Échec Impressionnant au Test de Résistance → un État Exténué SUPPLÉMENTAIRE', () => {
    // Résistance 40, jet 85 → −4 DR.
    const r = forcedPaceCheck({ valeurConduite: 45, animaux: [{ valeurResistance: 40 }], rng: script(60, 85) });
    expect(r.animaux[0].resistance.sl).toBe(-4);
    expect(r.animaux[0].etats).toEqual(['extenue', 'extenue']);
    expect(r.animaux[0].blessures).toBe(0);
  });

  it('le modificateur de l.229 est une SOURCE UNIQUE (le 1ᵉʳ km ne nomme aucune ligne)', () => {
    expect(ligneAllureForcee(0)).toBeNull();
    expect(ligneAllureForcee(3)).toMatchObject({ ref: refDeRegle('allure-forcee-attelage'), value: 3 * modDeRegle('allure-forcee-attelage', 'par-km') });
    // Le composeur ne recalcule rien : il délègue au même résolveur.
    expect(forcedPaceCheck({ valeurConduite: 45, kmDejaCourus: 3, animaux: [], rng: script(20) }).ligne).toEqual(ligneAllureForcee(3));
  });

  it('le jet de bête est EXTRACTIBLE (forcedPaceBeastCheck) et rend le MÊME résultat que le composeur', () => {
    // Résistance 40, jet 85 (−4 DR) : Échec Impressionnant → Exténué + Exténué supplémentaire (l.253).
    const seul = forcedPaceBeastCheck({ valeurResistance: 40 }, script(85));
    const parLeComposeur = forcedPaceCheck({ valeurConduite: 45, animaux: [{ valeurResistance: 40 }], rng: script(60, 85) });
    expect(seul.etats).toEqual(['extenue', 'extenue']);
    expect(parLeComposeur.animaux[0].etats).toEqual(seul.etats);
    expect(parLeComposeur.animaux[0].resistance.roll).toBe(seul.resistance.roll);
  });

  it('Échec Stupéfiant → 1d10 Blessures réduites du Bonus d’Endurance, minimum 1', () => {
    // Résistance 40, jet 100 → −6 DR ; 1d10 = 8, BE 3 → 5 Blessures.
    const r = forcedPaceCheck({ valeurConduite: 45, animaux: [{ valeurResistance: 40, be: 3 }], rng: script(60, 100, 8) });
    expect(r.animaux[0].resistance.sl).toBe(-6);
    expect(r.animaux[0].blessures).toBe(5);
    // 1d10 = 2, BE 9 → plancher à 1.
    const plancher = forcedPaceCheck({ valeurConduite: 45, animaux: [{ valeurResistance: 40, be: 9 }], rng: script(60, 100, 2) });
    expect(plancher.animaux[0].blessures).toBe(1);
  });
});
