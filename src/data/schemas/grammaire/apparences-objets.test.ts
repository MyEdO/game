import { describe, expect, it } from 'vitest';
import { giveTrappingSchema } from '../defs-scenes/effets';
import { gameOpSchema } from './mecanique';
import { apparencesAdmissibles } from '../../../engine/items';
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

  it('refuse les apparences connues étrangères à leur objet dans les trois formes d’auteur', () => {
    const refus = [
      giveTrappingSchema.safeParse({ type: 'giveTrapping', trappingId: 'arme-simple', apparence: { id: 'cape' } }),
      gameOpSchema.safeParse({ op: 'giveTrapping', trappingId: 'arme-simple', apparence: { id: 'cape' } }),
      sceneSchema.safeParse(scene({ 'arme-simple': 'cape' })),
    ];
    for (const r of refus) {
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.message).toContain('arme-simple');
        expect(r.error.message).toContain('cape');
      }
    }
  });

  it('les trois portes acceptent exactement la liste canonique pour un objet', () => {
    for (const apparence of apparencesAdmissibles({ trappingId: 'arme-simple' })) {
      expect(giveTrappingSchema.safeParse({ type: 'giveTrapping', trappingId: 'arme-simple', apparence: { id: apparence.id } }).success).toBe(true);
      expect(gameOpSchema.safeParse({ op: 'giveTrapping', trappingId: 'arme-simple', apparence: { id: apparence.id } }).success).toBe(true);
      expect(entityAppearanceSchema.safeParse({ apparencesObjets: { 'arme-simple': apparence.id } }).success).toBe(true);
    }
  });

  it('un custom sans identité de catalogue n’admet aucune apparence', () => {
    for (const [schema, discriminant] of [[giveTrappingSchema, { type: 'giveTrapping' }], [gameOpSchema, { op: 'giveTrapping' }]] as const) {
      expect(schema.safeParse({ ...discriminant, custom: 'Souvenir' }).success).toBe(true);
      const refus = schema.safeParse({ ...discriminant, custom: 'Souvenir', apparence: { id: 'cape' } });
      expect(refus.success).toBe(false);
      if (!refus.success) expect(refus.error.message).toContain('custom');
    }
  });

  it('refuse une clé inconnue sur EntityAppearance', () => {
    expect(entityAppearanceSchema.safeParse({ champInconnu: {} }).success).toBe(false);
  });
});
