/**
 * LA SAUVEGARDE SUR LE BANC DU NOYAU (#3058) : l'écriture d'un emplacement (`snapshotSave`, règles maison comprises), sa
 * relecture (`lireSave`) et son chargement (`chargerLaSave`, règles maison posées), sans stockage d'hôte.
 */
import { loadRuleOverrides, ruleOverrides } from '../../engine/policy';
import type { Banc } from '../banc.testkit';
import { chargerLaSave, exporterLaSauvegarde, lireSave, snapshotSave } from './save';

/** Le texte de la save de l'état du banc. */
export function sauverLeBanc(banc: Banc): string {
  return exporterLaSauvegarde(snapshotSave(banc.getState(), '2026-11-03T00:00:00.000Z', ruleOverrides()));
}

/** Charge la save `texte` sur le banc ; lève si elle est refusée. */
export function chargerSurLeBanc(banc: Banc, texte: string): void {
  const lue = lireSave(texte);
  if (typeof lue === 'string') throw new Error(`save refusée : ${lue}`);
  const { etat, regles } = chargerLaSave(lue);
  banc.setState(etat);
  loadRuleOverrides(regles);
}
