/**
 * LES CONSÉQUENCES PAR LE PONT (#4574 lot 3) : la rangée d'un jet de cascade publie, dans `projection.jets`, les faits
 * que son étape a appliqués, tels que Godot les reçoit en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Pont } from './pont';
import { imposerLesD100 } from '../../../src/noyau/battleRng.testkit';
import { surUnBancHorsTest } from '../../../src/noyau/banc.testkit';
import { recueillirLesRumeurs } from '../../../src/noyau/innFlow';
import { createHero } from '../../../src/engine/character';
import { idsDeTest } from '../../../src/engine/idsDeTest.testkit';
import { buildScene } from '../../../src/noyau/mapSpec';
import { ecrireLaSauvegarde } from '../../../src/hote/sauvegardes';
import { snapshotSave } from '../../../src/noyau/persistance/save';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; vi.restoreAllMocks(); });

describe('projection.jets[].consequences', () => {
  it('les rumeurs d’auberge ratées (EDOC 8 l.133) : l’Exténué appliqué, sur la rangée du jet', () => {
    const sauvegarde = surUnBancHorsTest((banc) => {
      const g = banc.getState;
      g().fixerLeGroupe([createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', seed: 11, id: 'h-artur' })]);
      g().chargerLeProjet({
        scenes: [buildScene({ id: 'auberge-a', label: 'Auberge du Cerf', desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] })], entryId: 'auberge-a', projet: null,
        worldMap: { id: 'm', label: 'Le Reik', routes: [], places: [{ id: 'A', label: 'Auberge du Cerf', pos: { x: 0, y: 0 }, scene: { id: 'auberge-a' }, services: [{ id: 'cerf', kind: { id: 'auberge' } }] }] },
      });
      recueillirLesRumeurs(g, banc.setState, 'cerf');
      imposerLesD100(100);
      g().jetLancer('cascade');
      vi.restoreAllMocks();
      return snapshotSave(g(), '2026-11-22T20:00:00Z', {});
    });
    const { pont, appel, stockage } = table();
    ouvert = pont;
    expect(ecrireLaSauvegarde(stockage, 1, sauvegarde)).toBe(true);
    const { suite } = drainer(appel, appel('charger', { charger: 1, graine: 7 }));
    const json = JSON.parse(JSON.stringify(suite.vue.projection.jets)) as typeof suite.vue.projection.jets;
    expect(json.flatMap((j) => j.lignes.flatMap((l) => l.consequences ?? []))).toEqual([
      { genre: 'etat', valeur: 1, qui: 'h-artur', ton: 'echec', detail: { id: 'extenue' } },
    ]);
  });
});
