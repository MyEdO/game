/**
 * ENGAGEMENTS DE BANC (#3370) : un brouillon complet de création, et son engagement sous un id posé, pour les bancs qui
 * composent le groupe par les gestes `partyAddHero` / `partyReplaceHero`, où le noyau bâtit le héros.
 */
import { newDraft, type CreatorDraft } from './brouillon';
import { fillDraftDefaults } from './defauts';
import type { HerosEngage } from './engagement';

let complet: CreatorDraft | null = null;

/** Un brouillon complet (`fillDraftDefaults` jusqu'à la présentation), nommé `label`. */
export function brouillonComplet(label = 'Aventurier'): CreatorDraft {
  complet ??= fillDraftDefaults(newDraft(4242), 'presentation');
  return { ...complet, label };
}

/** L'engagement du brouillon complet nommé `label`, sous l'id `id`. */
export const engage = (id: string, label = `Héros ${id}`): HerosEngage => ({ brouillon: brouillonComplet(label), id });
