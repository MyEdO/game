/**
 * Le tirage d'une cargaison aléatoire (#3578 L5) : `rollSeasonalCargo(voie, saison, rng)` tire au dé du document
 * de la colonne (`cargaisons-aleatoires.json`) et rend la marchandise que désigne la rangée tirée.
 * MDG 15 l.404-418 ; MSRC 13 l.69-78
 */
import { describe, it, expect } from 'vitest';
import { cargaisonsAleatoires } from '../data';
import { rollSeasonalCargo, tableDesCargaisons, type Voie } from './cargo';
import { deFixe, deSelonLaPlage } from './dice.testkit';
import { facesDuDe, deDeLaTableTiree } from './tables';
import type { Season } from './travelStages';

describe('rollSeasonalCargo — la colonne de la voie et de la saison, à son dé', () => {
  it('voie mer, printemps : un jet de 3 rend les Céréales (MDG 15 l.408, « 01-05 »)', () => {
    expect(rollSeasonalCargo('mer', 'printemps', deFixe(3)).id).toBe('cereales');
  });

  it('chaque borne de chaque rangée rend la cargaison de cette rangée, dans le document de SA colonne', () => {
    for (const t of cargaisonsAleatoires) {
      const voie = t.voie as Voie;
      const saison = t.saison as Season;
      expect(tableDesCargaisons(voie, saison).id).toBe(t.id);
      for (const r of t.entries) {
        expect(rollSeasonalCargo(voie, saison, deFixe(r.min)).id, `${t.id} › ${r.min}`).toBe(r.id);
        expect(rollSeasonalCargo(voie, saison, deFixe(r.max)).id, `${t.id} › ${r.max}`).toBe(r.id);
      }
    }
  });

  it('le dé lancé est celui du document : la plage tirée finit sur sa face la plus haute', () => {
    for (const t of cargaisonsAleatoires) {
      const hautes: number[] = [];
      rollSeasonalCargo(t.voie as Voie, t.saison as Season, deSelonLaPlage((_min, max) => (hautes.push(max), max)));
      expect(hautes, `${t.id} (${t.die})`).toEqual([facesDuDe(deDeLaTableTiree(t))]);
    }
  });
});
