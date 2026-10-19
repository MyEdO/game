/**
 * Préférences de CALQUES de l'éditeur — DEUX couches : le défaut (tout ce que la scène porte est
 * visible et cliquable) puis le choix EXPLICITE de l'auteur, persisté en ÉCART au défaut. Un calque
 * éteint cache l'élément ET bloque son clic : ce couplage est le contrat, il se vérifie ici.
 */
import { describe, it, expect } from 'vitest';
import { emptyScene, type SceneEffectZone } from '../../noyau/monde/scene';
import { DEFAULT_LAYERS, hitAt } from './editorState';
import { effectiveLayers, layerChoicesFrom } from './editorLayers';

/** Zone DESCRIPTIVE : un nom de pièce, sans aucune mécanique (`isDescriptiveZone`). */
const piece: SceneEffectZone = {
  id: 'zn-salle',
  label: 'Salle commune',
  area: { kind: 'rect', x: 1, y: 1, w: 3, h: 3 },
  z: 0,
};

/** Zone MÉCANIQUE : un piège. Même calque que la pièce — c'est son ENCRE qui diffère, pas son calque. */
const piege: SceneEffectZone = {
  id: 'zn-piege',
  label: 'Fosse',
  area: { kind: 'rect', x: 5, y: 5, w: 2, h: 2 },
  z: 0,
  onCross: [{ op: 'wounds', amount: 5 }],
};

describe('calques de l’éditeur — tout ce que la scène porte s’ouvre visible', () => {
  it('chaque calque part ALLUMÉ : rien n’est caché derrière une case à cocher à deviner', () => {
    expect(Object.values(DEFAULT_LAYERS).every(Boolean)).toBe(true);
  });

  it('aux calques de défaut, pièce ET piège sont cliquables sur la carte', () => {
    const scene = { ...emptyScene(10, 10), effectZones: [piece, piege] };
    expect(hitAt(scene, { x: 2, y: 2 }, DEFAULT_LAYERS)).toEqual({ type: 'effectZone', idx: 0 });
    expect(hitAt(scene, { x: 5, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'effectZone', idx: 1 });
  });

  it('éteindre le calque des zones les rend cliquables À TRAVERS — le clic passe au dessous', () => {
    const scene = { ...emptyScene(10, 10), effectZones: [piece, piege] };
    const éteint = { ...DEFAULT_LAYERS, zones: false };
    expect(hitAt(scene, { x: 2, y: 2 }, éteint)).toBeNull();
    expect(hitAt(scene, { x: 5, y: 5 }, éteint)).toBeNull();
  });
});

describe('calques de l’éditeur — le choix explicite de l’auteur l’emporte et se retient', () => {
  it('éteindre un calque se retient, le rallumer efface le choix', () => {
    const éteint = layerChoicesFrom({ ...DEFAULT_LAYERS, zones: false });
    expect(éteint).toEqual({ zones: false });
    expect(effectiveLayers(éteint).zones).toBe(false);

    const rallumé = layerChoicesFrom({ ...DEFAULT_LAYERS, zones: true });
    expect(rallumé).toEqual({}); // revenu au défaut : plus rien à retenir
    expect(effectiveLayers(rallumé).zones).toBe(true);
  });

  it('un choix ne porte QUE sur son calque : les autres restent au défaut', () => {
    expect(effectiveLayers({ roofs: false })).toEqual({ ...DEFAULT_LAYERS, roofs: false });
  });
});
