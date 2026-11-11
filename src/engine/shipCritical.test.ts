import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { rollShipCritical, resolveShipCriticalHit, shipCritEntryCodexCategory } from './shipCritical';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, type ShipCritKey } from '../data/shipCriticals';
import { exposition as expositionNavale } from '../data/schemas/defs/ship-criticals';
import { exposition as expositionFluviale } from '../data/schemas/defs/river-criticals';
import { suiteAvecPas } from '../data/schemas/grammaire/cle-d-espace';
import { applyOps } from './ops';
import { stacks } from './conditions';
import { vehicleCombatant } from './vehicle';
import { findVehicleById } from '../data';
import { makeRNG } from './dice';
import { desDuTest } from './dice.testkit';

const ship = () => vehicleCombatant(findVehicleById('diligence')!)!; // E45 / B50, comme proxy de coque

describe('rollShipCritical (MDG 13) — code générique sur ship-criticals.json', () => {
  it("Coque 8 → Voie d'eau 1 (Éclats 6) : op condition voie-d-eau, posée via applyOps", () => {
    const r = rollShipCritical('coque', makeRNG(1), 8);
    expect(r.id).toBe('voie-d-eau-au-dessus-de-la-ligne-de-flottaison'); // réf par id, jamais le label
    expect(r.shrapnel).toBe(6);
    expect(r.ops).toEqual([{ op: 'condition', id: { id: 'voie-d-eau' }, value: 1 }]);
    const c = ship();
    applyOps(c, r.ops, { idNeuf: idsDeTest, rng: desDuTest }); // l'appelant applique → l'État NAVAL data-driven se pose
    expect(stacks(c, 'voie-d-eau')).toBe(1);
  });

  it('Cargaison 3 → En flammes 1 ; Cargaison 10 → En flammes 3 + 1d10 Critiques de Coque', () => {
    const fire1 = rollShipCritical('cargaison', makeRNG(1), 3);
    expect(fire1.ops).toEqual([{ op: 'condition', id: { id: 'en-flammes-navire' }, value: 1 }]);
    const c = ship();
    applyOps(c, fire1.ops, { idNeuf: idsDeTest, rng: desDuTest });
    expect(stacks(c, 'en-flammes-navire')).toBe(1);

    const boom = rollShipCritical('cargaison', makeRNG(7), 10);
    expect(boom.id).toBe('explosion-du-depot-de-munitions');
    expect(boom.ops).toEqual([{ op: 'condition', id: { id: 'en-flammes-navire' }, value: 3 }]);
    expect(boom.extraHullCrits).toBeGreaterThanOrEqual(1); // 1d10
    expect(boom.extraHullCrits).toBeLessThanOrEqual(10);
  });

  it('Gréement 10 → Mât brisé, Éclats 10 (rendu pour l’équipage, pas appliqué au navire)', () => {
    const r = rollShipCritical('greement', makeRNG(1), 10);
    expect(r.id).toBe('mat-brise');
    expect(r.shrapnel).toBe(10);
    expect(r.ops).toEqual([]); // aucun État sur la coque ; le Mât brisé est narratif (note)
    expect(r.note).toContain('Éclats 10'); // l'effet verbatim est conservé
  });

  it('d10 tiré quand non imposé (seedé, déterministe)', () => {
    const r = rollShipCritical('avirons', makeRNG(3));
    expect(r.roll).toBeGreaterThanOrEqual(1);
    expect(r.roll).toBeLessThanOrEqual(10);
    expect(r.label).toBeTruthy();
  });
});

describe('resolveShipCriticalHit — brain du coup critique naval (localisation → coque ou équipage)', () => {
  it('voilier, d100=15 → Gréement → Critique de coque (pas l’équipage)', () => {
    const h = resolveShipCriticalHit('voile', makeRNG(1), 15, 2); // loc 15 = gréement ; d10=2 → Voiles trouées
    expect(h.location).toBe('greement');
    expect(h.crewHit).toBe(false);
    expect(h.crit?.id).toBe('voiles-trouees');
  });
  it('d100≤9 → Équipage → la touche revient à un marin (Critique de personnage, appelant)', () => {
    const h = resolveShipCriticalHit('mixte', makeRNG(1), 5);
    expect(h.location).toBe('equipage');
    expect(h.crewHit).toBe(true);
    expect(h.crit).toBeUndefined();
  });
  it('bateau à avirons, d100=15 → Avirons (≠ voilier) → Critique des avirons', () => {
    const h = resolveShipCriticalHit('avirons', makeRNG(1), 15, 3); // d10=3 → Avirons dégradés
    expect(h.location).toBe('avirons');
    expect(h.crit?.id).toBe('avirons-degrades');
  });
});

describe('shipCritEntryCodexCategory — la catégorie de chaque table est celle que déclare l’exposition du jeu', () => {
  const LOCALISATIONS: ShipCritKey[] = ['avirons', 'greement', 'coque', 'equipements', 'cargaison', 'gouvernail', 'superstructure'];
  it.each([
    { jeu: SHIP_CRIT_SET, exposition: expositionNavale },
    { jeu: RIVER_CRIT_SET, exposition: expositionFluviale },
  ])('$jeu.id', ({ jeu, exposition }) => {
    const declarees = 'niche' in exposition.edit ? exposition.edit.niche.categories : {};
    expect(Object.keys(declarees)).toHaveLength(5);
    for (const loc of LOCALISATIONS) {
      const attendue = Object.keys(declarees).find((c) => declarees[c] === suiteAvecPas('tables', { champ: loc }));
      expect(shipCritEntryCodexCategory(jeu.id, loc), `${jeu.id}/${loc}`).toBe(attendue);
    }
  });
});
