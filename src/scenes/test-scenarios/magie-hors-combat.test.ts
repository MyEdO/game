import { describe, it, expect } from 'vitest';
import { scenario } from './magie-hors-combat';
import { findSpell } from '../../data';
import { layerTiles } from '../../state/scene';
import { knowsCastingSkill, isArcaneSpell, isMagicMissile, castInfo } from '../../engine/magic';
const scenarioConstruit = scenario.construire();

/** Le scénario doit être JOUABLE hors combat : les lanceurs maîtrisent réellement leur Compétence
 *  (sinon les boutons « Lancer/Focaliser » échoueraient sur « ne maîtrise pas »), et le groupe offre
 *  bien les 3 cas (sort d'Arcane focalisable, bénédiction de soin, Projectile magique combat-only). */
describe('Scénario Magie hors combat', () => {
  const party = scenario.construire().party;
  const [wiz, priest] = party; // groupe construit = [wiz, priest], ordre fixé (pregenParty)

  it('est un scénario d’EXPLORATION (pas d’autoCombat)', () => {
    expect(scenario.autoCombat).toBeUndefined();
    expect(party.every((h) => h.kind === 'hero')).toBe(true);
  });

  it('la scène compilée (buildScene) est une arène 14×9 plate, départ héros en (2,4), sans combat', () => {
    const scene = scenarioConstruit.scene;
    expect(scene.id).toBe('test-magie-hors-combat');
    expect(scene.dimensions).toEqual({ w: 14, h: 9 });
    expect(scene.layers).toHaveLength(1);
    expect(layerTiles(scene, 0).every((t) => t === 'herbe')).toBe(true); // remplissage plat par défaut
    expect(scene.entities.find((e) => e.kind === 'heroStart')?.pos).toEqual({ x: 2, y: 4 });
    expect(scene.encounters).toHaveLength(0); // pas de rencontre : exploration pure
    expect(scene.startMessage?.texte).toContain('Exploration');
  });

  it('le Sorcier maîtrise l’incantation et la Focalisation, et connaît un Sort d’Arcane focalisable', () => {
    expect(knowsCastingSkill(wiz, 'langue', 'magick')).toBe(true);
    expect(knowsCastingSkill(wiz, 'focalisation')).toBe(true);
    const arme = findSpell('Armure Aethyrique')!;
    expect(wiz.spells).toContain('armure-aethyrique'); // runtime = id de sort
    expect(isArcaneSpell(arme)).toBe(true); // → bouton « ✨ Focaliser »
    expect(isMagicMissile(arme)).toBe(false); // non offensif → lançable hors combat
  });

  it('le Prêtre maîtrise la Prière et porte une Bénédiction de soin (effet modélisé)', () => {
    const heal = findSpell('Bénédiction de Guérison')!;
    expect(castInfo(heal).skill).toBe('priere');
    expect(knowsCastingSkill(priest, 'priere')).toBe(true);
    expect(priest.spells).toContain('benediction-de-guerison'); // runtime = id de sort
    expect(isMagicMissile(heal)).toBe(false);
  });

  it('un allié est blessé (cible visible pour la Guérison) et un Projectile magique reste combat-only', () => {
    expect(wiz.wounds.current).toBeLessThan(wiz.wounds.max);
    expect(isMagicMissile(findSpell('Fléchette')!)).toBe(true); // affiché « en combat » sur la fiche
  });
});
