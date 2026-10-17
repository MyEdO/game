/**
 * PRÉFÉRENCES DE CALQUES de l'éditeur — le défaut (`DEFAULT_LAYERS`, tout visible) surchargé par les
 * choix EXPLICITES de l'auteur, persistés. Seul l'ÉCART au défaut est stocké : rallumer un calque
 * revenu à sa valeur de défaut efface le choix, et la préférence d'une carte n'en suit pas une autre.
 */
import { persistedAtom } from '../persistedAtom';
import { DEFAULT_LAYERS, type Layers } from './editorState';

const LAYER_KEYS = Object.keys(DEFAULT_LAYERS) as (keyof Layers)[];

/** Choix explicites de l'auteur — sous-ensemble des calques, chacun forcé à sa valeur voulue. */
export type LayerChoices = Partial<Layers>;

function parseChoices(raw: string): LayerChoices {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return {};
    const out: LayerChoices = {};
    for (const k of LAYER_KEYS) {
      const v = (data as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export const layerChoicesAtom = persistedAtom<LayerChoices>('wfrp4.editor.layers', {}, parseChoices, (v) => JSON.stringify(v));

/** Calques EFFECTIFS : défaut, surchargé par l'auteur. */
export function effectiveLayers(choices: LayerChoices): Layers {
  return { ...DEFAULT_LAYERS, ...choices };
}

/** Écart des calques voulus au défaut — ce qui se persiste. */
export function layerChoicesFrom(wanted: Layers): LayerChoices {
  const out: LayerChoices = {};
  for (const k of LAYER_KEYS) if (wanted[k] !== DEFAULT_LAYERS[k]) out[k] = wanted[k];
  return out;
}

/** Calques de l'éditeur + poseur compatible `Dispatch<SetStateAction<Layers>>` (`StatusBar`). */
export function useEditorLayers(): [Layers, (update: Layers | ((prev: Layers) => Layers)) => void] {
  const choices = layerChoicesAtom.use();
  const layers = effectiveLayers(choices);
  const setLayers = (update: Layers | ((prev: Layers) => Layers)) => {
    const wanted = typeof update === 'function' ? update(layers) : update;
    layerChoicesAtom.set(layerChoicesFrom(wanted));
  };
  return [layers, setLayers];
}
