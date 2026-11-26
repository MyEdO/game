/**
 * Le pont repose la session d'édition sous le catalogue courant avant chaque geste (`sessionSousLeCatalogue`, fossile 9
 * du plan `docs/plans/2026-11-25-composition-d-un-jeu.md`, #5070) : une écriture au seam entre deux `editer` fait juger
 * le geste suivant sous le catalogue neuf, dont l'index des ids se lit à son identité (`parserSousCatalogue`). Fixture :
 * une caraque dans un bassin, retirée au seam (`setDataset`) entre deux gestes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { table, type Reponse } from './pont.testkit';
import type { Bouton, Choix, Formulaire, Ligne, Plan } from '../../../src/hote/elements';
import type { ZonesDeLEditeur } from '../../../src/hote/editeur';
import { buildScene } from '../../../src/noyau/mapSpec';
import paquetDeTest from '../../../src/scenes/fixtures/paquet-de-test.json';
import { datasetArray, resetData, setDataset } from '../../../src/data/overrides';

afterEach(() => resetData());

/** Les textes des lignes de validation (`validation/<rang>`) des zones de l'éditeur que rend `r`. */
const textesDe = (r: Reponse): string[] =>
  Object.values((r as unknown as { vue: { zones: ZonesDeLEditeur } }).vue.zones).flat().flatMap((el: Ligne | Choix | Bouton | Formulaire | Plan) => (el.type === 'ligne' && /^validation\/\d+$/.test(el.id) ? [el.texte] : []));

/** Un bassin où mouille une caraque. */
const bassinALaCaraque = () => ({
  ...buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', metresPerTile: 2 }),
  entities: [{ id: 'n', kind: 'personnage' as const, pos: { x: 12, y: 12 }, vehicule: { id: 'caraque' }, facing: 'N' as const }],
});

describe('le pont repose la session d’édition sous le catalogue courant', () => {
  it('la caraque retirée du seam entre deux gestes, sa validation se juge sous le catalogue neuf', () => {
    const { appel } = table();
    const ouverte = appel('editer', { ouvrir: paquetDeTest.id, projet: JSON.stringify({ ...paquetDeTest, scenes: [bassinALaCaraque(), ...paquetDeTest.scenes] }) });
    expect(ouverte.ok, JSON.stringify(ouverte).slice(0, 600)).toBe(true);
    expect(textesDe(ouverte).filter((t) => t.includes('caraque')), 'la caraque est au catalogue de l’ouverture').toEqual([]);

    setDataset('vehicles', datasetArray('vehicles').filter((v) => v.id !== 'caraque'));
    const sansElle = appel('editer', { edition: { geste: 'outil', outil: { mode: 'selection' } } });
    expect(textesDe(sansElle).filter((t) => t.includes('caraque')), 'la validation juge sous le catalogue neuf').toEqual([
      expect.stringContaining('« caraque » est absent du catalogue des véhicules (vehicles.json).'),
    ]);
  });

  it('une partie d’essai ouverte, le geste suivant de l’éditeur se juge encore sous le catalogue neuf', () => {
    const { appel } = table();
    appel('editer', { ouvrir: paquetDeTest.id, projet: JSON.stringify({ ...paquetDeTest, scenes: [bassinALaCaraque(), ...paquetDeTest.scenes] }) });
    const testee = appel('editer', { edition: { geste: 'tester' } });
    expect(testee.ok, JSON.stringify(testee).slice(0, 400)).toBe(true);
    expect(appel('demarrer', { essai: true }).ok).toBe(true);
    setDataset('vehicles', datasetArray('vehicles').filter((v) => v.id !== 'caraque'));
    const apres = appel('editer', { edition: { geste: 'outil', outil: { mode: 'selection' } } });
    expect(textesDe(apres).filter((t) => t.includes('« caraque » est absent')), 'la validation juge sous le catalogue neuf').toHaveLength(1);
  });
});
