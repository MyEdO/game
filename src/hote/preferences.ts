/**
 * LA PERSISTANCE DES PRÉFÉRENCES d'un hôte (#3041), sur le `Stockage` qu'il fournit : la table et la validation sont
 * celles du noyau (`noyau/preferences.ts`) ; seules les valeurs qui s'écartent de leur défaut s'écrivent. Un stockage
 * absent (`null`) ou qui lève : la valeur reste effective pour la session.
 */
import { poserLesPreferencesPersistees, preferenceDef, preferencesAPersister, type Preference, type PrefValue } from '../noyau/index';
import { lireDictionnaire, type Stockage } from '../lib/stockage';

const CLE = 'wfrp4.prefs';

/** Pose les préférences persistées dans `stockage` (`poserLesPreferencesPersistees`). */
export function chargerLesPreferences(stockage: Stockage | null): void {
  const persiste = lireDictionnaire(stockage, CLE);
  if (persiste) poserLesPreferencesPersistees(persiste);
}

/** Écrit `valeur` dans la préférence `id` et persiste la table dans `stockage` ; rend son entrée, `undefined` pour un
 *  id inconnu (rien n'est écrit). */
export function reglerUnePreference(stockage: Stockage | null, id: string, valeur: PrefValue): Preference | undefined {
  const def = preferenceDef(id);
  if (!def) return undefined;
  def.set(valeur);
  const persistees = preferencesAPersister();
  try {
    if (Object.keys(persistees).length) stockage?.setItem(CLE, JSON.stringify(persistees));
    else stockage?.removeItem(CLE);
  } catch {
    // quota plein / stockage indisponible : la valeur reste effective pour la session
  }
  return def;
}
