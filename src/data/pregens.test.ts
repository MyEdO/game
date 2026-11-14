import { describe, it, expect } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import type { RNG } from '../engine/dice';
import { pretire, pretires, idDuPretire, richesseDuPretire, GROUPE_VITRINE, groupeVitrine } from './pregens';
import type { PregenDef } from './index';
import { pregens } from './index';
import { meta } from './schemas/defs/pregens';
import { validateDataset } from './schemas/validate';
import { versDisque } from './schemas/grammaire/prose';

/** Un RNG qui rend toujours la borne basse (`'min'`) ou haute (`'max'`) du tirage demandé. */
const borne = (cote: 'min' | 'max'): RNG => ({ int: (min, max) => (cote === 'min' ? min : max) });

describe('prétirés officiels — fiches imprimées figées (#3884)', () => {
  it('la forme est celle de la fiche : EXACTEMENT ces champs, aucun choix de création', () => {
    expect(Object.keys(meta).sort()).toEqual([
      'age', 'carrieres', 'charAdvances', 'fate', 'initiales', 'motivation', 'resilience', 'richesse',
      'sex', 'skills', 'species', 'spells', 'talents', 'trappings', 'xp',
    ]);
  });

  it('chaque prétiré se bâtit, à l’id stable de son entrée', () => {
    for (const d of pregens) {
      const h = pretire(idsDeTest, d.id);
      expect(h.id, d.id).toBe(idDuPretire(d.id));
      expect([h.kind, h.label, h.species], d.id).toEqual(['heros', d.label, d.species.id]);
      expect(h.careerHistory, d.id).toEqual(Object.keys(d.carrieres));
    }
    expect(pretires(idsDeTest).map((h) => h.id)).toEqual(pregens.map((d) => idDuPretire(d.id)));
  });

  it('un id inconnu lève', () => {
    expect(() => pretire(idsDeTest, 'inconnu')).toThrow(/inconnu/);
  });

  it('les ids sont uniques et l’id de héros en dérive', () => {
    expect(new Set(pregens.map((d) => d.id)).size).toBe(pregens.length);
    expect(idDuPretire('x')).toBe('pretire-x');
  });

  it('une entrée sans `source` est refusée au parse', () => {
    const disque = versDisque(pregens);
    expect(validateDataset('pregens.json', disque)).toBeNull();
    const sansSource = disque.map(({ source: _source, ...d }) => d);
    expect(validateDataset('pregens.json', sansSource)).not.toBeNull();
  });

  it('`GROUPE_VITRINE` désigne des prétirés, bâtis dans son ordre', () => {
    for (const id of GROUPE_VITRINE) expect(pregens.some((d) => d.id === id), id).toBe(true);
    expect(groupeVitrine(idsDeTest).map((h) => h.id)).toEqual(GROUPE_VITRINE.map(idDuPretire));
  });

  it('aucune dotation texte n’imprime une quantité aux dés (elle est un `count.roll`, tiré à l’engagement)', () => {
    for (const d of pregens) for (const t of d.trappings) if ('text' in t) expect(t.text, d.id).not.toMatch(/\d+d\d+/);
  });

  it('`richesseDuPretire` tire la somme imprimée dans sa monnaie, bornes comprises', () => {
    const d = { richesse: { monnaie: 'silver', count: { roll: { n: 3, sides: 10 } } } } as PregenDef;
    expect(richesseDuPretire(d, borne('min'))).toEqual({ gold: 0, silver: 3, brass: 0 });
    expect(richesseDuPretire(d, borne('max'))).toEqual({ gold: 0, silver: 30, brass: 0 });
  });
});
