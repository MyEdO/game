import { describe, it, expect } from 'vitest';
import { bodyShapeOf, creatureToCombatant, statblockToCombatant } from '../noyau/monde/spawn';
import { findCreatureById } from '../data';

// LDB 76 l.15-29.
// bodyShapeOf délègue à bodyShapeForSpecies.
describe('bodyShapeOf — forme du corps dérivée de l’espèce (LDB 76 l.15-29)', () => {
  it('mappe les formes canoniques depuis le bestiaire', () => {
    expect(bodyShapeOf('araignee-geante')).toBe('araignee');
    expect(bodyShapeOf('serpent')).toBe('serpent');
    expect(bodyShapeOf('loup')).toBe('quadrupede');
    expect(bodyShapeOf('cheval')).toBe('quadrupede');
    expect(bodyShapeOf('ogre')).toBe('humanoide');
  });
  it('défaut humanoïde pour un nom inconnu (table par défaut, pas d’invention)', () => {
    expect(bodyShapeOf('Créature inexistante xyz')).toBe('humanoide');
  });
  it('creatureToCombatant : bodyShape posé sur le Combattant', () => {
    const spider = findCreatureById('araignee-geante');
    if (spider) expect(creatureToCombatant(spider, 'a', { x: 0, y: 0 }).bodyShape).toBe('araignee');
    const snake = findCreatureById('serpent');
    if (snake) expect(creatureToCombatant(snake, 's', { x: 0, y: 0 }).bodyShape).toBe('serpent');
  });
});

describe('statblockToCombatant — bodyShape dérivée de l’espèce AUTHORÉE (#142 LOT 5), jamais du label', () => {
  it('espèce authorée non-humanoïde → table de localisation de CETTE espèce', () => {
    const sb = { type: 'statblock' as const, label: 'Bête sauvage', char: { B: 10 } };
    expect(statblockToCombatant(sb, 'x', { x: 0, y: 0 }, { species: 'loup' }).bodyShape).toBe('quadrupede');
    expect(statblockToCombatant(sb, 'y', { x: 0, y: 0 }, { species: 'araignee-geante' }).bodyShape).toBe('araignee');
  });

  it('renommer le label ne change RIEN à la forme du corps (le label est de l’affichage)', () => {
    const shapeArachnee = (label: string) => statblockToCombatant({ type: 'statblock', label, char: { B: 10 } }, 'z', { x: 0, y: 0 }, { species: 'araignee-geante' }).bodyShape;
    expect(shapeArachnee('serpent')).toBe('araignee'); // label coïncidant avec un id de créature ≠ id
    expect(shapeArachnee('Grosse Araignée')).toBe('araignee');
  });

  it('sans espèce authorée → repli humanoïde', () => {
    expect(statblockToCombatant({ type: 'statblock', label: 'Cultiste', char: { B: 10 } }, 'w', { x: 0, y: 0 }).bodyShape).toBe('humanoide');
  });
});
