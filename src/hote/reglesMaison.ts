/**
 * LA PERSISTANCE DES RÈGLES MAISON d'un hôte (#3041), sur le `Stockage` qu'il fournit : élagage, pose et verrou sont
 * ceux du noyau (`noyau/reglesMaison.ts`). Un chargement qui élague réécrit le jeu élagué et CUMULE son TÉMOIN dans le
 * même `Stockage` (#1463 LD.1, `hote/temoin.ts`) ; `prendreLeTemoinDesReglesMaison` le consomme. Un stockage absent
 * (`null`) ou qui lève : la surcharge reste effective pour la session.
 */
import {
  poserLesReglesMaisonPersistees, retablirUneRegleMaison, ruleOverrides, surchargerUneRegleMaison,
  type Jeu, type RegleOptionnelleId, type RetraitsDElagage, type RuleValue,
} from '../noyau/index';
import { lireDictionnaire, type Stockage } from '../lib/stockage';
import { prendreLeTemoin, temoigner, TEMOIN_DES_RETRAITS } from './temoin';

const CLE_DES_REGLES = 'wfrp4.house-rules';
const CLE_DU_TEMOIN = 'wfrp4.house-rules.temoin';

/** Pose les règles maison persistées dans `stockage` ; celles que le registre courant refuse sortent du stockage, et
 *  leur témoin y est cumulé (`hote/temoin.ts`). */
export function chargerLesReglesMaison(stockage: Stockage | null): void {
  const persiste = lireDictionnaire(stockage, CLE_DES_REGLES);
  if (!persiste) return;
  const retraits = poserLesReglesMaisonPersistees(persiste);
  if (!retraits) return;
  enregistrer(stockage);
  temoigner(stockage, CLE_DU_TEMOIN, TEMOIN_DES_RETRAITS, retraits);
}

/** Repose les règles maison du joueur : celles que `stockage` persiste (`chargerLesReglesMaison`), aucune s'il n'en
 *  persiste pas ; sans stockage (`null`), celles de la session restent. */
export function reposerLesReglesMaison(stockage: Stockage | null): void {
  if (!stockage) return;
  if (lireDictionnaire(stockage, CLE_DES_REGLES)) chargerLesReglesMaison(stockage);
  else poserLesReglesMaisonPersistees({});
}

/** Le témoin des règles retirées par les chargements depuis la dernière prise, RETIRÉ de `stockage` : `null` sans
 *  retrait. */
export function prendreLeTemoinDesReglesMaison(stockage: Stockage | null): RetraitsDElagage | null {
  return prendreLeTemoin(stockage, CLE_DU_TEMOIN, TEMOIN_DES_RETRAITS);
}

/** Surcharge la règle `id` sous le verrou de `etat` (`surchargerUneRegleMaison`) et persiste ; rien sinon. */
export function reglerUneRegleMaison(stockage: Stockage | null, etat: Pick<Jeu, 'battle'>, id: RegleOptionnelleId, valeur: RuleValue): void {
  if (surchargerUneRegleMaison(etat, id, valeur)) enregistrer(stockage);
}

/** Remet la règle `id` à son défaut sous le verrou de `etat` (`retablirUneRegleMaison`) et persiste ; rien sinon. */
export function remettreUneRegleMaison(stockage: Stockage | null, etat: Pick<Jeu, 'battle'>, id: RegleOptionnelleId): void {
  if (retablirUneRegleMaison(etat, id)) enregistrer(stockage);
}

function enregistrer(stockage: Stockage | null): void {
  try {
    stockage?.setItem(CLE_DES_REGLES, JSON.stringify(ruleOverrides()));
  } catch {
    // quota plein / stockage indisponible : la surcharge reste effective pour la session
  }
}
