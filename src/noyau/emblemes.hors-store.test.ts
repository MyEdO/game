import { describe, expect, it } from 'vitest';
import { equipementDessine, equipementDEntite, emblemeDuPorteur } from './index';
import { ficheDEntite } from './monde/sceneNpc';
import { sceneEntitySchema } from '../data/schemas/defs-scenes/scene';
import { entityAppearanceSchema } from '../data/schemas/grammaire/valeurs';
import { creatures, findTrappingById } from '../data';
import { setDataset } from '../data/overrides';
import { emptyArmour } from '../engine/items';
import type { Combatant } from '../engine/types';

const porteur = (over: Partial<Combatant>): Combatant => ({ weapons: [], items: [], armour: emptyArmour(0), ...over }) as unknown as Combatant;

describe('emblème des porteurs (#3155)', () => {
  const taureau = { id: 'taureau-rouge' };
  const crane = { id: 'tete-de-mort-rouge' };

  it('la fiche conserve l’emblème de l’entité malgré une apparence de preset', () => {
    const ent = sceneEntitySchema.parse({ id: 'e', kind: 'personnage', presetId: 'p', pos: { x: 1, y: 1 }, appearance: { embleme: taureau } });
    const preset = { id: 'p', label: 'P', base: 'humain', profil: {}, apparence: entityAppearanceSchema.parse({ sex: 'F', embleme: crane }) };
    const ficheDeLue = (lue: ReturnType<typeof sceneEntitySchema.parse>) => ficheDEntite({ id: lue.id, kind: lue.kind, pos: lue.pos, presetId: lue.presetId, appearance: lue.appearance }, () => preset);
    const fiche = ficheDeLue(ent);
    expect(equipementDessine(fiche).embleme).toEqual(taureau);
    expect(fiche.appearanceOverride?.sex).toBe('F');
    const sansEmbleme = sceneEntitySchema.parse({ ...ent, appearance: undefined });
    expect(equipementDessine(ficheDeLue(sansEmbleme)).embleme).toEqual(crane);
  });

  it('les deux projections prennent la créature en repli et leur porteur en priorité', () => {
    const originales = creatures.slice();
    try {
      setDataset('creatures', originales.map(c => c.id === 'humain' ? { ...c, appearance: { ...c.appearance, embleme: taureau } } : c));
      expect(equipementDessine(porteur({ creatureId: 'humain' })).embleme).toEqual(taureau);
      expect(equipementDEntite(findTrappingById, 'humain').embleme).toEqual(taureau);
      expect(equipementDessine(porteur({ creatureId: 'humain', appearanceOverride: { embleme: crane } })).embleme).toEqual(crane);
      expect(equipementDEntite(findTrappingById, 'humain', { embleme: crane }).embleme).toEqual(crane);
    } finally {
      setDataset('creatures', originales);
    }
  });

  it('un id périmé ne projette aucun emblème', () => {
    expect(emblemeDuPorteur({ id: 'embleme-perime' })).toBeUndefined();
    expect(equipementDEntite(findTrappingById, undefined, { embleme: { id: 'embleme-perime' } }).embleme).toBeUndefined();
  });
});

