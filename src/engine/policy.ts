/**
 * LECTEUR du registre des RÈGLES OPTIONNELLES (« règles maison ») — SOURCE UNIQUE de la valeur
 * effective d'une règle.
 *
 * Le CATALOGUE (libellé, aide, groupe, forme du contrôle, défaut, bornes, action attachée) vit en
 * DONNÉE : `src/data/reglesOptionnelles.json` (schéma `src/data/schemas/defs/reglesOptionnelles.ts`,
 * éditable au Compendium). Ce module ne garde que les TYPES et la lecture : `rule(id)` = surcharge
 * runtime ⊕ défaut de la donnée. Le panneau in-game (`hote/reglesMaison`) écrit la
 * surcharge par `setRule` et la PERSISTE ; il se RÉ-GÉNÈRE depuis le registre (un contrôle par entrée
 * selon `kind`), donc ajouter une règle = ajouter une entrée au JSON, et elle apparaît
 * automatiquement en jeu. Module FEUILLE pur : aucune dépendance store/UI (la persistance vit dans
 * hote/, pas ici — le moteur reste pur).
 *
 * Réf. : la citation de chaque règle est portée par son champ `ref` (livre + chapitre, et la ligne
 * quand le passage en porte une) ; les formes réelles sont mesurées au schéma de la donnée.
 */
import reglesOptionnellesJson from '../data/reglesOptionnelles.json';
import { datasetDe, type EntreeDe } from '../data/datasets';
import type * as reglesOptionnellesDef from '../data/schemas/defs/reglesOptionnelles';
import { valeurConforme, type FormeDeControle } from '../data/schemas/defs/reglesOptionnelles';
import { bumperDataset, indexParId } from '../data/versionDataset';
import type { IdsParEspace, ValeurDeRegle } from '../data/schemas/_ids.generated';
import { t } from '../i18n';

/** Id d'une règle optionnelle : l'espace `reglesOptionnelles.json` de `IdsParEspace` — un id retiré du dataset ne compile plus. */
export type RegleOptionnelleId = IdsParEspace['reglesOptionnelles.json'];

/** Une règle optionnelle du registre, au type de son schéma (`data/schemas/defs/reglesOptionnelles.ts`) et à la forme
 *  de son contrôle, que ce schéma refuse incomplète (`ecartsDeLaRegle`). L'ACTION attachée (`action`) est rendue
 *  sous sa rangée quand la règle vaut `when` ; son `run` nomme l'action du store, que le moteur n'appelle jamais : la
 *  vue la résout génériquement sur le store (`HouseRulesModal`). */
export type OptionalRule = EntreeDe<typeof reglesOptionnellesDef> & FormeDeControle;

/** Le genre du contrôle d'une règle optionnelle (`FormeDeControle`). */
export type RuleKind = OptionalRule['kind'];

/** Valeur d'une règle optionnelle SANS sa règle — surcharges stockées, persistées ou saisies, que `valeurConforme`
 *  juge contre leur règle. La valeur d'UNE règle est `ValeurDeRegle[id]`. */
export type RuleValue = OptionalRule['default'];

/**
 * LE registre, LU de la donnée. Ajouter une règle optionnelle = ajouter une entrée à
 * `src/data/reglesOptionnelles.json` (et un SEUL point de lecture dans son module métier via
 * `rule(id)`). Les règles de Test pilotent `testPolicy.getTestPolicy()`. La MÊME référence de
 * tableau que le module JSON (singleton ESM) : une édition au Compendium (`setDataset`, splice en
 * place) est vue en direct par le moteur.
 */
export const OPTIONAL_RULES = datasetDe<typeof reglesOptionnellesDef>(reglesOptionnellesJson) as OptionalRule[];

const regleParId = indexParId('reglesOptionnelles', OPTIONAL_RULES);
const overrides = new Map<string, RuleValue>();

/** Définition d'une règle (métadonnée pour l'auto-rendu du panneau). */
export function ruleDef(id: string): OptionalRule | undefined {
  return regleParId(id);
}

/** La règle `id` du registre ; un id hors du registre LÈVE (#1463 LD.1, #2995). */
function regleExigee(id: string): OptionalRule {
  const regle = regleParId(id);
  if (!regle) throw new Error(t('houseRules.refus.inconnue', { id }));
  return regle;
}

/** Valeur EFFECTIVE d'une règle, au type de SA règle (`ValeurDeRegle`) : surcharge runtime si présente, sinon défaut.
 *  Toute surcharge passe `valeurConforme` (`setRule`, `loadRuleOverrides`), tout défaut le schéma de la donnée. */
export function rule<I extends RegleOptionnelleId>(id: I): ValeurDeRegle[I];
export function rule(id: RegleOptionnelleId): RuleValue {
  const regle = regleExigee(id);
  return overrides.has(id) ? overrides.get(id)! : regle.default;
}

/** Surcharge runtime écrite par le CODE, au type de SA règle (`ValeurDeRegle`). */
export function setRule<I extends RegleOptionnelleId>(id: I, value: ValeurDeRegle[I]): void {
  surcharger(id, value);
}

/** Surcharge runtime d'une valeur SAISIE hors du code (panneau in-game, harnais de recette), que seul le runtime
 *  juge contre sa règle. */
export function surchargerUneSaisie(id: RegleOptionnelleId, value: RuleValue): void {
  surcharger(id, value);
}

/** Écriture et lecture jugent par le même verdict (`refusDeSurcharge`) : un id hors du registre ou une valeur non
 *  conforme LÈVE (#1463 LD.1). */
function surcharger(id: RegleOptionnelleId, value: RuleValue): void {
  const refus = refusDeSurcharge(id, value);
  if (refus) throw new Error(refus);
  overrides.set(id, value);
  bumperDataset('reglesOptionnelles');
}

/** Retire la surcharge → retour au défaut. */
export function resetRule(id: RegleOptionnelleId): void {
  regleExigee(id);
  if (overrides.delete(id)) bumperDataset('reglesOptionnelles');
}

/** Un jeu de règles typé par id du registre, chaque valeur au type de SA règle (scénario, lancement). */
export type JeuDeRegles = { readonly [I in RegleOptionnelleId]?: ValeurDeRegle[I] };

/** Les ids d'un jeu de règles. */
export const idsDuJeu = (regles: JeuDeRegles): RegleOptionnelleId[] => Object.keys(regles) as RegleOptionnelleId[];

/** Pose chaque règle d'un jeu de règles (`setRule`). */
export function poserLesRegles(regles: JeuDeRegles): void {
  for (const id of idsDuJeu(regles)) setRule(id, regles[id]!);
}

/** Snapshot des surcharges (pour persistance). */
export function ruleOverrides(): Record<string, RuleValue> {
  return Object.fromEntries(overrides);
}

/** Pourquoi la surcharge `v` de la règle `id` ne se pose pas — un id hors du registre, ou une valeur non conforme à
 *  sa règle (`valeurConforme`) —, `undefined` si elle se pose. SEUL juge d'une surcharge : écriture (`setRule`),
 *  chargement (`loadRuleOverrides`) et documents persistés (`refusDesSurcharges`). */
function refusDeSurcharge(id: string, v: unknown): string | undefined {
  const regle = regleParId(id);
  if (!regle) return t('houseRules.refus.inconnue', { id });
  return valeurConforme(regle, v) ? undefined : t('houseRules.refus.valeur', { valeur: JSON.stringify(v), id });
}

/** Une surcharge refusée : l'id qu'elle nomme et la raison du refus. */
export interface RefusDeSurcharge {
  id: string;
  raison: string;
}

/** Les surcharges refusées d'un jeu venu d'HORS du corpus (sauvegarde, `localStorage`, en-tête d'une partie de
 *  l'hôte texte), dans l'ordre du jeu ; `[]` = le jeu se charge entier. */
export function refusDesSurcharges(o: Readonly<Record<string, unknown>>): RefusDeSurcharge[] {
  return Object.entries(o).flatMap(([id, v]) => {
    const raison = refusDeSurcharge(id, v);
    return raison ? [{ id, raison }] : [];
  });
}

/** Remplace les surcharges (depuis la persistance). Un jeu que `refusDesSurcharges` refuse LÈVE, sans rien
 *  remplacer : l'appelant élague d'abord (`noyau/persistance/elagage`) (#1463 LD.1). */
export function loadRuleOverrides(o: Readonly<Record<string, unknown>>): void {
  const refus = refusDesSurcharges(o);
  if (refus.length) throw new Error(refus.map((r) => r.raison).join(' ; '));
  overrides.clear();
  for (const [k, v] of Object.entries(o)) overrides.set(k, v as RuleValue);
}
