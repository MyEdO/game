/**
 * CONTRAT DE FRAÎCHEUR (#1692), part du RENDU : une écriture au seam (`setDataset`) est vue par le bake
 * du monde (`worldBakeDeps`) et par l'arche solaire (`sunJeuHalfArcMin`), sans rechargement. Les
 * lecteurs de la donnée et des règles : `src/data/fraicheur-datasets.test.ts`.
 *
 * Restauration `afterEach` par le seam lui-même : aucun test ne touche un dataset autrement.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { props, findPropById } from '../../../data/index';
import { setDataset, datasetArray } from '../../../data/overrides';
import { emptyScene, sceneMetresPerTile } from '../../../noyau/monde/scene';
import { worldBakeDeps } from './sceneMeshes';
import { sunJeuHalfArcMin } from './sunJeu';

const DECORS_LIVRES = [...props];
const PHASES_LIVREES = structuredClone(datasetArray('calendarPhases'));

afterEach(() => {
  setDataset('calendarPhases', structuredClone(PHASES_LIVREES));
  setDataset('props', DECORS_LIVRES);
});

describe('#1692 — une édition au seam est SERVIE aux lecteurs', () => {
  it('un décor ÉDITÉ : `findPropById` rend la NOUVELLE entrée ET le READ-SET du bake porte une dep NEUVE', () => {
    // La scène pose un décor VOLUMIQUE : `worldBakeDeps` y lit sa RECETTE (`propRecipeDeps`), donc la
    // fraîcheur se MESURE sur la dep elle-même — pas seulement sur l'identité rendue par l'accesseur.
    // L'édition porte donc sur ce qui CUIT (la recette) : un libellé seul ne recuit rien, par dessein.
    const scene = emptyScene('scene-test', 6, 6);
    scene.entities = [{ id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 2, y: 2 } } as (typeof scene.entities)[number]];
    const mpt = sceneMetresPerTile(scene);
    const depsAvant = worldBakeDeps(scene, mpt);
    const avant = findPropById('tonneau')!;
    expect(depsAvant).toContain(avant.volume); // la recette du tonneau EST une dep du bake

    setDataset('props', props.map((p) => (p.id === 'tonneau' ? { ...p, label: 'Tonneau ébréché', volume: { ...p.volume! } } : p)));
    const apres = findPropById('tonneau')!;
    expect(apres.label).toBe('Tonneau ébréché');
    expect(apres).not.toBe(avant);

    const depsApres = worldBakeDeps(scene, mpt);
    expect(depsApres.length).toBe(depsAvant.length);
    expect(depsApres.some((d, i) => d !== depsAvant[i]), 'aucune dep du bake n’a bougé : le monde resterait cuit sur l’ancien décor').toBe(true);
    expect(depsApres).toContain(apres.volume);
  });

  it('ISOLANT : un décor édité HORS de sa recette ne fait bouger AUCUNE dep du bake', () => {
    // Contrepartie du cas précédent : il assère qu'une dep CHANGE, ce qui ne vaut que si toute
    // édition ne les fait pas toutes changer. Ici l'édition ne touche QUE le libellé — la recette
    // (`volume`) garde son identité —, et le read-set doit être identique élément par élément.
    const scene = emptyScene('scene-test', 6, 6);
    scene.entities = [{ id: 'p1', kind: 'prop', ref: 'tonneau', pos: { x: 2, y: 2 } } as (typeof scene.entities)[number]];
    const mpt = sceneMetresPerTile(scene);
    const depsAvant = worldBakeDeps(scene, mpt);

    setDataset('props', props.map((p) => (p.id === 'tonneau' ? { ...p, label: 'Tonneau signé' } : p)));
    expect(findPropById('tonneau')!.label).toBe('Tonneau signé');

    const depsApres = worldBakeDeps(scene, mpt);
    expect(depsApres.length).toBe(depsAvant.length);
    expect(depsApres.filter((d, i) => d !== depsAvant[i]), 'le bake se déclencherait sur une édition qui ne cuit rien').toEqual([]);
  });
});

describe('#1692 — les vues DÉRIVÉES d’un dataset suivent son édition', () => {
  it('les phases du jour ÉDITÉES : aube, crépuscule, créneau de départ et arche solaire suivent', () => {
    setDataset('calendarPhases', datasetArray('calendarPhases').map((p) => (
      p.id === 'aube' ? { ...p, seuil: 360 } : p.id === 'crepuscule' ? { ...p, seuil: 1140 } : p)));
    expect(sunJeuHalfArcMin()).toBe(12 * 60 - 360);
  });
});
