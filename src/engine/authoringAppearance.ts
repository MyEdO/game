/**
 * Types d'APPARENCE — couche NEUTRE partagée : l'éditeur/scène (`noyau`) AUTHORE `EntityAppearance`, le
 * Combattant (`engine`) PORTE l'override brut (`Combatant.appearanceOverride`) et l'apparence résolue
 * (`Combatant.appearance`). Vivent ici (moteur) pour qu'aucun consommateur n'inverse les couches
 * (#187, #2884). Structurels purs (aucune valeur de rendu).
 */

import type { z } from 'zod';
import type { entityAppearanceSchema, Sexe } from '../data/schemas/grammaire/valeurs';

/** Vocabulaire (marque NOMINALE, #406) : id d'espèce jouable, de créature ou de race d'apparence
 *  (`especeDApparenceSchema`) — jamais un `SpeciesData.label` (« Humains (Reiklander) »). UNE seule
 *  monnaie : un littéral `string` (dont un `.label`) n'est plus assignable à `Appearance.species`
 *  (échec STRUCTUREL). Producteur sanctionné : `especeDApparence` (pont règles→apparence,
 *  `src/data/index.ts`). */
export type EspeceDApparence = string & { readonly __especeDApparence: unique symbol };

/** Surcharge d'apparence : l'entrée de son schéma (`entityAppearanceSchema`), ses identifiants nus. */
export type EntityAppearance = z.input<typeof entityAppearanceSchema>;

/** Descripteur d'apparence COSMÉTIQUE RÉSOLU (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: EspeceDApparence;
  sex: Sexe;
}
