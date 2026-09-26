import { describe, it, expect } from 'vitest';
import { bodyShapeOf, creatureToCombatant, statblockToCombatant } from './spawn';
import { findCreatureById } from '../data';

// Forme du corps → Tableau de Localisation (LDB 76 l.15-29, « Point d'Impact des Créatures »).
// Dérivée du gabarit rigué de la créature (bodyPlanById) ; serpent/araignée = Localisations Alternatives.
describe('bodyShapeOf — forme du corps dérivée du gabarit (LDB 76 l.15-29)', () => {
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

// #142 LOT 5 : statblockToCombatant dérivait la forme du corps depuis `sb.label` (prose d'AUTEUR) au
// lieu de l'espèce AUTHORÉE (id stable) — tout statbloc d'auteur recevait la table humanoïde, et
// renommer le libellé changeait silencieusement la table si le nom coïncidait avec un id de créature.
describe('statblockToCombatant — bodyShape dérivée de l’espèce AUTHORÉE (#142 LOT 5), jamais du label', () => {
  it('espèce authorée non-humanoïde → table de localisation de CETTE espèce', () => {
    const sb = { type: 'statblock' as const, label: 'Bête sauvage', char: { B: 10 } };
    expect(statblockToCombatant(sb, 'x', { x: 0, y: 0 }, { species: 'loup' }).bodyShape).toBe('quadrupede');
    expect(statblockToCombatant(sb, 'y', { x: 0, y: 0 }, { species: 'araignee' }).bodyShape).toBe('araignee');
  });

  it('renommer le label ne change RIEN à la forme du corps (le label est de l’affichage)', () => {
    const shapeArachnee = (label: string) => statblockToCombatant({ type: 'statblock', label, char: { B: 10 } }, 'z', { x: 0, y: 0 }, { species: 'araignee' }).bodyShape;
    expect(shapeArachnee('serpent')).toBe('araignee'); // label coïncidant avec un id de créature ≠ id
    expect(shapeArachnee('Grosse Araignée')).toBe('araignee');
  });

  it('sans espèce authorée → repli humanoïde (comportement historique, aucune invention)', () => {
    expect(statblockToCombatant({ type: 'statblock', label: 'Cultiste', char: { B: 10 } }, 'w', { x: 0, y: 0 }).bodyShape).toBe('humanoide');
  });
});
