// Lecture de la couche de campagne CHARGÉE dans le store (#767), pour les lecteurs d'`ui` et de `gameIso` :
// le narratif de la partie (`state.campaignNarratif`, posé par `loadProject`) passé aux résolveurs de
// `./resolveursDuNarratif`, qui prennent leur narratif en argument (#2817).
import type { NarratifBlock, PresetPnj } from './campaignNarratif';
import { presetDuNarratif } from './resolveursDuNarratif';
// Import de `useGame` au top-level mais lu UNIQUEMENT dans les fonctions (usage runtime différé) :
// le cycle store → campaignData → store ne se résout que par la liaison vivante ESM.
import { useGame } from './store';

/** Preset de PNJ pré-composé de la campagne chargée — couche-SEULEMENT (n'existe pas dans `src/data`). */
export function presetPnjById(id: string): PresetPnj | undefined {
  return presetDuNarratif(useGame.getState().campaignNarratif)(id);
}

/** Les états de campagne déclarés par la campagne chargée (`narratif.etats`) — couche-SEULEMENT. */
export function etatsDeLaCampagne(): NarratifBlock['etats'] {
  return useGame.getState().campaignNarratif?.etats ?? [];
}
