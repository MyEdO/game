import { describe, expect, it } from 'vitest';
import { entityAppearanceSchema } from './valeurs';
import { sceneSchema } from '../defs-scenes/scene';
import { emptyScene } from '../../../noyau/monde/scene';

const scene = (apparencesObjets: Record<string, string>) => ({
  ...emptyScene('scene-test', 2, 2),
  entities: [{ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, appearance: { apparencesObjets } }],
});

describe('apparences d’objets d’auteur : références validées au parse de scène', () => {
  it('ne matérialise aucune table sans choix', () => {
    expect(entityAppearanceSchema.parse({})).not.toHaveProperty('apparencesObjets');
  });

  it('préserve les ids de trapping et d’apparence dans un aller-retour JSON de scène', () => {
    const document = scene({ 'arme-simple': 'hache_naine' });
    const resultat = sceneSchema.safeParse(JSON.parse(JSON.stringify(document)));
    expect(resultat.success, JSON.stringify(resultat.error?.issues)).toBe(true);
    if (resultat.success) expect(resultat.data).toMatchObject({ entities: document.entities });
  });

  it('refuse une apparence inconnue à la porte de scène', () => {
    const resultat = sceneSchema.safeParse(scene({ 'arme-simple': 'apparence-inconnue' }));
    expect(resultat.success).toBe(false);
    expect(JSON.stringify(resultat.error?.issues)).toContain('apparence-inconnue');
  });

  it('refuse une clé de trapping inconnue', () => {
    expect(sceneSchema.safeParse(scene({ 'trapping-inconnu': 'hache_naine' })).success).toBe(false);
  });

  it('accepte un id connu dont l’admission sera jugée par le résolveur de rendu', () => {
    expect(sceneSchema.safeParse(scene({ 'arme-simple': 'zweihander' })).success).toBe(true);
  });

  it('refuse une clé inconnue sur EntityAppearance', () => {
    expect(entityAppearanceSchema.safeParse({ champInconnu: {} }).success).toBe(false);
  });
});
