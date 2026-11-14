import { describe, expect, it } from 'vitest';
import { emblemeDuPorteur } from './index';
import { emblemeDe } from './equipementDessine';
import { ficheDEntite } from './monde/sceneNpc';
import { sceneEntitySchema } from '../data/schemas/defs-scenes/scene';
import { entityAppearanceSchema } from '../data/schemas/grammaire/valeurs';
import { creatures } from '../data';
import { setDataset } from '../data/overrides';

describe('emblème des porteurs (#3155)', () => {
  const taureau = { id: 'taureau-rouge' } as const;
  const crane = { id: 'tete-de-mort-rouge' } as const;

  it('la fiche conserve l’emblème de l’entité malgré une apparence de preset', () => {
    const ent = sceneEntitySchema.parse({ id: 'e', kind: 'personnage', presetId: 'p', pos: { x: 1, y: 1 }, appearance: { embleme: taureau } });
    const preset = { id: 'p', label: 'P', base: { id: 'humain' }, profil: {}, apparence: entityAppearanceSchema.parse({ sex: 'F', embleme: crane }) };
    const ficheDeLue = (lue: ReturnType<typeof sceneEntitySchema.parse>) => ficheDEntite({ id: lue.id, kind: lue.kind, pos: lue.pos, presetId: lue.presetId, appearance: lue.appearance }, () => preset);
    const fiche = ficheDeLue(ent);
    expect(emblemeDe(fiche.appearanceOverride, fiche.creatureId)).toEqual(taureau);
    expect(fiche.appearanceOverride?.sex).toBe('F');
    const sansEmbleme = sceneEntitySchema.parse({ ...ent, appearance: undefined });
    const ficheSansEmbleme = ficheDeLue(sansEmbleme);
    expect(emblemeDe(ficheSansEmbleme.appearanceOverride, ficheSansEmbleme.creatureId)).toEqual(crane);
  });

  it('l’emblème prend la créature en repli et l’apparence du porteur en priorité', () => {
    const originales = creatures.slice();
    try {
      setDataset('creatures', originales.map(c => c.id === 'humain' ? { ...c, appearance: { ...c.appearance, embleme: taureau } } : c));
      expect(emblemeDe(undefined, 'humain')).toEqual(taureau);
      expect(emblemeDe({ embleme: crane }, 'humain')).toEqual(crane);
    } finally {
      setDataset('creatures', originales);
    }
  });

  it('un id périmé ne projette aucun emblème', () => {
    expect(emblemeDuPorteur({ id: 'embleme-perime' })).toBeUndefined();
    expect(emblemeDe({ embleme: { id: 'embleme-perime' } }, undefined)).toBeUndefined();
  });
});

